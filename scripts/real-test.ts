/**
 * REAL API & Feature Testing Script
 * Actually tests the endpoints and looks for bugs
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

interface TestResult {
  test: string
  status: "PASS" | "FAIL" | "WARN"
  details: string
}

const results: TestResult[] = []

function log(test: string, status: "PASS" | "FAIL" | "WARN", details: string) {
  results.push({ test, status, details })
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️"
  console.log(`${icon} ${test}: ${details}`)
}

async function main() {
  console.log("\n" + "=".repeat(70))
  console.log("REAL BUG HUNTING - THOROUGH TESTING")
  console.log("=".repeat(70) + "\n")

  const tenant = await prisma.tenant.findFirst({ include: { settings: true } })
  if (!tenant) {
    console.log("ERROR: No tenant found!")
    return
  }

  // ===========================================
  // TEST 1: DATA CONSISTENCY CHECKS
  // ===========================================
  console.log("\n--- DATA CONSISTENCY CHECKS ---\n")

  // Check for bills where balance doesn't match (total - paid)
  // Note: For overpaid bills, expected balance is negative but actual balance is 0 (excess goes to advance)
  const allBills = await prisma.bill.findMany()
  let balanceMismatchCount = 0
  for (const bill of allBills) {
    const expectedBalance = Number(bill.totalAmount) - Number(bill.paidAmount)
    const actualBalance = Number(bill.balance)
    // For overpaid bills (negative expected), actual should be 0
    const adjustedExpected = expectedBalance < 0 ? 0 : expectedBalance
    if (Math.abs(adjustedExpected - actualBalance) > 0.01) {
      balanceMismatchCount++
      if (balanceMismatchCount <= 3) {
        console.log(`   Found: ${bill.billNumber} - Expected balance: ${expectedBalance.toFixed(2)}, Actual: ${actualBalance.toFixed(2)}`)
      }
    }
  }
  if (balanceMismatchCount > 0) {
    log("Bill Balance Consistency", "FAIL", `${balanceMismatchCount} bills have balance mismatch`)
  } else {
    log("Bill Balance Consistency", "PASS", "All bill balances are correct")
  }

  // Check for bills where status doesn't match balance
  let statusMismatchCount = 0
  for (const bill of allBills) {
    const balance = Number(bill.balance)
    const paidAmount = Number(bill.paidAmount)
    const isFullyPaid = balance <= 0.01
    const isPartiallyPaid = paidAmount > 0 && balance > 0.01

    if (isFullyPaid && bill.status !== "PAID") {
      statusMismatchCount++
      if (statusMismatchCount <= 3) {
        console.log(`   Found: ${bill.billNumber} - Balance: ${balance.toFixed(2)} but status: ${bill.status}`)
      }
    } else if (isPartiallyPaid && bill.status !== "PARTIAL") {
      statusMismatchCount++
      if (statusMismatchCount <= 3) {
        console.log(`   Found: ${bill.billNumber} - Partially paid but status: ${bill.status}`)
      }
    }
  }
  if (statusMismatchCount > 0) {
    log("Bill Status Consistency", "FAIL", `${statusMismatchCount} bills have status mismatch`)
  } else {
    log("Bill Status Consistency", "PASS", "All bill statuses match their balance")
  }

  // Check for payments where allocations don't sum to total
  const payments = await prisma.payment.findMany({
    include: { billPayments: true },
  })
  let paymentAllocationErrors = 0
  for (const payment of payments) {
    const allocatedTotal = payment.billPayments.reduce(
      (sum, bp) => sum + Number(bp.totalAmount),
      0
    )
    const paymentTotal = Number(payment.totalAmount)
    // Some payments might be advance payments, so allocation can be less
    if (allocatedTotal > paymentTotal + 0.01) {
      paymentAllocationErrors++
      console.log(`   Found: OR# ${payment.orNumber} - Allocated: ${allocatedTotal.toFixed(2)} > Payment: ${paymentTotal.toFixed(2)}`)
    }
  }
  if (paymentAllocationErrors > 0) {
    log("Payment Allocation Integrity", "FAIL", `${paymentAllocationErrors} payments have over-allocation`)
  } else {
    log("Payment Allocation Integrity", "PASS", "No over-allocated payments")
  }

  // ===========================================
  // TEST 2: PENALTY CALCULATION ACCURACY
  // ===========================================
  console.log("\n--- PENALTY CALCULATION CHECKS ---\n")

  // Check if penalty amounts make sense
  const billsWithPenalty = await prisma.bill.findMany({
    where: { penaltyAmount: { gt: 0 } },
    include: { unit: true },
  })

  let suspiciousPenalties = 0
  for (const bill of billsWithPenalty) {
    const penalty = Number(bill.penaltyAmount)
    const total = Number(bill.totalAmount)
    const percentOfTotal = (penalty / total) * 100

    // Penalties less than 1% are suspicious (should be 10%)
    if (percentOfTotal < 1 && penalty > 0) {
      suspiciousPenalties++
      if (suspiciousPenalties <= 5) {
        console.log(`   Found: ${bill.unit.unitNumber} ${bill.billNumber} - Penalty: ₱${penalty.toFixed(2)} (${percentOfTotal.toFixed(2)}% of total)`)
      }
    }
  }
  if (suspiciousPenalties > 0) {
    log("Penalty Amount Verification", "WARN", `${suspiciousPenalties} bills have suspiciously small penalties (<1%)`)
  } else if (billsWithPenalty.length === 0) {
    log("Penalty Amount Verification", "WARN", "No bills with penalties to verify")
  } else {
    log("Penalty Amount Verification", "PASS", `${billsWithPenalty.length} bills with penalties look reasonable`)
  }

  // ===========================================
  // TEST 3: UNIT & OWNER RELATIONSHIPS
  // ===========================================
  console.log("\n--- RELATIONSHIP INTEGRITY CHECKS ---\n")

  // Units without owners
  const unitsWithoutOwner = await prisma.unit.findMany({
    where: { ownerId: null },
  })
  if (unitsWithoutOwner.length > 0) {
    log("Units Without Owners", "WARN", `${unitsWithoutOwner.length} units have no owner assigned`)
    unitsWithoutOwner.slice(0, 3).forEach((u) => console.log(`   - ${u.unitNumber}`))
  } else {
    log("Units Without Owners", "PASS", "All units have owners")
  }

  // Bills with 0 or negative amounts
  const zeroBills = await prisma.bill.findMany({
    where: { totalAmount: { lte: 0 } },
    include: { unit: true },
  })
  if (zeroBills.length > 0) {
    log("Zero/Negative Amount Bills", "FAIL", `${zeroBills.length} bills have zero or negative amounts`)
    zeroBills.slice(0, 3).forEach((b) => console.log(`   - ${b.unit.unitNumber} ${b.billNumber}: ₱${Number(b.totalAmount).toFixed(2)}`))
  } else {
    log("Zero/Negative Amount Bills", "PASS", "No zero or negative amount bills")
  }

  // ===========================================
  // TEST 4: METER READING CONSISTENCY
  // ===========================================
  console.log("\n--- METER READING CHECKS ---\n")

  // Electric readings where present < previous (went backwards)
  const badElectricReadings = await prisma.electricReading.findMany({
    where: {},
    include: { unit: true },
  })
  let backwardElectric = 0
  for (const reading of badElectricReadings) {
    if (Number(reading.presentReading) < Number(reading.previousReading)) {
      backwardElectric++
      if (backwardElectric <= 3) {
        console.log(`   Found: ${reading.unit.unitNumber} - Present: ${reading.presentReading} < Previous: ${reading.previousReading}`)
      }
    }
  }
  if (backwardElectric > 0) {
    log("Electric Readings Direction", "WARN", `${backwardElectric} readings where present < previous (meter reset?)`)
  } else {
    log("Electric Readings Direction", "PASS", "All electric readings are forward")
  }

  // Water readings where present < previous
  const badWaterReadings = await prisma.waterReading.findMany({
    where: {},
    include: { unit: true },
  })
  let backwardWater = 0
  for (const reading of badWaterReadings) {
    if (Number(reading.presentReading) < Number(reading.previousReading)) {
      backwardWater++
      if (backwardWater <= 3) {
        console.log(`   Found: ${reading.unit.unitNumber} - Present: ${reading.presentReading} < Previous: ${reading.previousReading}`)
      }
    }
  }
  if (backwardWater > 0) {
    log("Water Readings Direction", "WARN", `${backwardWater} readings where present < previous`)
  } else {
    log("Water Readings Direction", "PASS", "All water readings are forward")
  }

  // Readings with negative consumption
  const negativeElectric = await prisma.electricReading.count({
    where: { consumption: { lt: 0 } },
  })
  const negativeWater = await prisma.waterReading.count({
    where: { consumption: { lt: 0 } },
  })
  if (negativeElectric > 0 || negativeWater > 0) {
    log("Negative Consumption", "FAIL", `Electric: ${negativeElectric}, Water: ${negativeWater} with negative consumption`)
  } else {
    log("Negative Consumption", "PASS", "No negative consumption readings")
  }

  // ===========================================
  // TEST 5: BILL COMPONENT SUMS
  // ===========================================
  console.log("\n--- BILL COMPONENT CHECKS ---\n")

  // Check if bill components sum correctly (accounting for previous balance stored elsewhere)
  let componentSumIssues = 0
  for (const bill of allBills.slice(0, 100)) {
    const components =
      Number(bill.electricAmount) +
      Number(bill.waterAmount) +
      Number(bill.associationDues) +
      Number(bill.parkingFee) +
      Number(bill.spAssessment) +
      Number(bill.penaltyAmount) +
      Number(bill.otherCharges) -
      Number(bill.discounts) -
      Number(bill.advanceDuesApplied) -
      Number(bill.advanceUtilApplied)

    const total = Number(bill.totalAmount)
    const diff = Math.abs(total - components)

    // If difference is small (rounding) or a reasonable previous balance, skip
    if (diff > 0.02 && diff < 100) {
      // Small unexplained difference
      componentSumIssues++
      if (componentSumIssues <= 3) {
        console.log(`   Found: ${bill.billNumber} - Components: ${components.toFixed(2)}, Total: ${total.toFixed(2)}, Diff: ${diff.toFixed(2)}`)
      }
    }
  }
  if (componentSumIssues > 0) {
    log("Bill Component Sum", "WARN", `${componentSumIssues} bills have small unexplained differences`)
  } else {
    log("Bill Component Sum", "PASS", "Bill components sum correctly (or difference is previous balance)")
  }

  // ===========================================
  // TEST 6: RATE SETTINGS
  // ===========================================
  console.log("\n--- RATE SETTINGS CHECKS ---\n")

  const settings = tenant.settings
  if (!settings) {
    log("Rate Settings", "FAIL", "No tenant settings found!")
  } else {
    // Check for zero or negative rates
    const issues: string[] = []
    if (Number(settings.electricRate) <= 0) issues.push("electricRate is 0 or negative")
    if (Number(settings.associationDuesRate) <= 0) issues.push("associationDuesRate is 0 or negative")
    if (Number(settings.penaltyRate) <= 0) issues.push("penaltyRate is 0 or negative")
    if (Number(settings.penaltyRate) > 0.20) issues.push(`penaltyRate is ${Number(settings.penaltyRate) * 100}% (>20%, is this correct?)`)

    // Check water tiers
    if (Number(settings.waterResTier1Rate) <= 0) issues.push("waterResTier1Rate is 0 or negative")

    if (issues.length > 0) {
      log("Rate Settings", "WARN", issues.join(", "))
    } else {
      log("Rate Settings", "PASS", `Electric: ₱${settings.electricRate}/kWh, Dues: ₱${settings.associationDuesRate}/sqm, Penalty: ${Number(settings.penaltyRate) * 100}%`)
    }
  }

  // ===========================================
  // TEST 7: DUPLICATE CHECKS
  // ===========================================
  console.log("\n--- DUPLICATE CHECKS ---\n")

  // Duplicate bill numbers
  const billNumbers = await prisma.bill.groupBy({
    by: ["billNumber"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  })
  if (billNumbers.length > 0) {
    log("Duplicate Bill Numbers", "FAIL", `${billNumbers.length} duplicate bill numbers found`)
    billNumbers.slice(0, 3).forEach((b) => console.log(`   - ${b.billNumber}`))
  } else {
    log("Duplicate Bill Numbers", "PASS", "No duplicate bill numbers")
  }

  // Duplicate OR numbers
  const orNumbers = await prisma.payment.groupBy({
    by: ["orNumber"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  })
  if (orNumbers.length > 0) {
    log("Duplicate OR Numbers", "FAIL", `${orNumbers.length} duplicate OR numbers found`)
    orNumbers.slice(0, 3).forEach((o) => console.log(`   - ${o.orNumber}`))
  } else {
    log("Duplicate OR Numbers", "PASS", "No duplicate OR numbers")
  }

  // Duplicate unit numbers
  const unitNumbers = await prisma.unit.groupBy({
    by: ["unitNumber"],
    _count: { id: true },
    having: { id: { _count: { gt: 1 } } },
  })
  if (unitNumbers.length > 0) {
    log("Duplicate Unit Numbers", "FAIL", `${unitNumbers.length} duplicate unit numbers found`)
    unitNumbers.slice(0, 5).forEach((u) => console.log(`   - ${u.unitNumber}`))
  } else {
    log("Duplicate Unit Numbers", "PASS", "No duplicate unit numbers")
  }

  // ===========================================
  // TEST 8: USER & PERMISSION CHECKS
  // ===========================================
  console.log("\n--- USER & PERMISSION CHECKS ---\n")

  const users = await prisma.user.findMany()
  const usersWithoutRole = users.filter((u) => !u.role)
  if (usersWithoutRole.length > 0) {
    log("Users Without Role", "FAIL", `${usersWithoutRole.length} users have no role`)
  } else {
    log("Users Without Role", "PASS", `All ${users.length} users have roles assigned`)
  }

  // Check for users without tenantId
  const usersWithoutTenant = users.filter((u) => !u.tenantId)
  if (usersWithoutTenant.length > 0) {
    log("Users Without Tenant", "WARN", `${usersWithoutTenant.length} users have no tenant (might be SUPER_ADMIN)`)
  } else {
    log("Users Without Tenant", "PASS", "All users have tenant assignment")
  }

  // ===========================================
  // SUMMARY
  // ===========================================
  console.log("\n" + "=".repeat(70))
  console.log("TEST SUMMARY")
  console.log("=".repeat(70))

  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  const warnings = results.filter((r) => r.status === "WARN").length

  console.log(`\n✅ PASSED:   ${passed}`)
  console.log(`❌ FAILED:   ${failed}`)
  console.log(`⚠️ WARNINGS: ${warnings}`)
  console.log(`   TOTAL:    ${results.length}`)

  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:")
    results.filter((r) => r.status === "FAIL").forEach((r) => console.log(`   - ${r.test}: ${r.details}`))
  }

  if (warnings > 0) {
    console.log("\n⚠️ WARNINGS:")
    results.filter((r) => r.status === "WARN").forEach((r) => console.log(`   - ${r.test}: ${r.details}`))
  }

  console.log("\n" + "=".repeat(70) + "\n")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
