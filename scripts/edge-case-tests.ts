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
  console.log("EDGE CASE & DEEP TESTING")
  console.log("=".repeat(70) + "\n")

  const tenant = await prisma.tenant.findFirst({ include: { settings: true } })
  if (!tenant) {
    console.log("ERROR: No tenant found!")
    return
  }

  // =============================================
  // TEST 1: BILL-PAYMENT RELATIONSHIP INTEGRITY
  // =============================================
  console.log("\n--- BILL-PAYMENT RELATIONSHIP TESTS ---\n")

  // Check BillPayment records have valid payment and bill references
  const allBillPayments = await prisma.billPayment.findMany({
    include: {
      payment: { select: { id: true } },
      bill: { select: { id: true } },
    },
  })

  const orphanedBillPayments = allBillPayments.filter((bp) => !bp.payment)
  if (orphanedBillPayments.length > 0) {
    log("Orphaned BillPayments", "FAIL", `${orphanedBillPayments.length} BillPayment records without parent payment`)
  } else {
    log("Orphaned BillPayments", "PASS", "No orphaned BillPayment records")
  }

  const billPaymentsWithMissingBill = allBillPayments.filter((bp) => !bp.bill)
  if (billPaymentsWithMissingBill.length > 0) {
    log("BillPayments Missing Bill", "FAIL", `${billPaymentsWithMissingBill.length} BillPayment records without bill`)
  } else {
    log("BillPayments Missing Bill", "PASS", "All BillPayments have valid bills")
  }

  // =============================================
  // TEST 2: ADVANCE BALANCE CONSISTENCY
  // =============================================
  console.log("\n--- ADVANCE BALANCE TESTS ---\n")

  // Check for negative advance balances
  const negativeAdvances = await prisma.unitAdvanceBalance.findMany({
    where: {
      OR: [
        { advanceDues: { lt: 0 } },
        { advanceUtilities: { lt: 0 } },
      ],
    },
    include: { unit: true },
  })
  if (negativeAdvances.length > 0) {
    log("Negative Advance Balances", "FAIL", `${negativeAdvances.length} units have negative advance balance`)
    negativeAdvances.forEach((a) => {
      console.log(`   - ${a.unit.unitNumber}: Dues=${a.advanceDues}, Util=${a.advanceUtilities}`)
    })
  } else {
    log("Negative Advance Balances", "PASS", "No negative advance balances")
  }

  // Check if advance applied on bills matches reality
  const billsWithAdvance = await prisma.bill.findMany({
    where: {
      OR: [
        { advanceDuesApplied: { gt: 0 } },
        { advanceUtilApplied: { gt: 0 } },
      ],
    },
    include: { unit: true },
  })
  log("Bills with Advance Applied", "PASS", `${billsWithAdvance.length} bills have advance deductions`)

  // =============================================
  // TEST 3: PAYMENT AMOUNT CONSISTENCY
  // =============================================
  console.log("\n--- PAYMENT CONSISTENCY TESTS ---\n")

  // Check if payment totalAmount matches sum of components
  const payments = await prisma.payment.findMany({
    take: 100,
  })

  let paymentMismatchCount = 0
  for (const payment of payments) {
    const componentSum =
      Number(payment.electricAmount) +
      Number(payment.waterAmount) +
      Number(payment.duesAmount) +
      Number(payment.pastDuesAmount) +
      Number(payment.spAssessmentAmount) +
      Number(payment.advanceDuesAmount) +
      Number(payment.advanceUtilAmount) +
      Number(payment.otherAdvanceAmount)

    const diff = Math.abs(Number(payment.totalAmount) - componentSum)
    if (diff > 0.01) {
      paymentMismatchCount++
      if (paymentMismatchCount <= 3) {
        console.log(`   Found: OR# ${payment.orNumber} - Components: ${componentSum.toFixed(2)}, Total: ${Number(payment.totalAmount).toFixed(2)}`)
      }
    }
  }

  if (paymentMismatchCount > 0) {
    log("Payment Component Sum", "FAIL", `${paymentMismatchCount} payments have component sum mismatch`)
  } else {
    log("Payment Component Sum", "PASS", "All payment totals match component sums")
  }

  // Check BillPayment totalAmount matches components
  const billPayments = await prisma.billPayment.findMany({
    take: 200,
  })

  let bpMismatchCount = 0
  for (const bp of billPayments) {
    const componentSum =
      Number(bp.electricAmount) +
      Number(bp.waterAmount) +
      Number(bp.duesAmount) +
      Number(bp.penaltyAmount) +
      Number(bp.spAssessmentAmount) +
      Number(bp.otherAmount)

    const diff = Math.abs(Number(bp.totalAmount) - componentSum)
    if (diff > 0.01) {
      bpMismatchCount++
    }
  }

  if (bpMismatchCount > 0) {
    log("BillPayment Component Sum", "FAIL", `${bpMismatchCount} BillPayments have component sum mismatch`)
  } else {
    log("BillPayment Component Sum", "PASS", "All BillPayment totals match component sums")
  }

  // =============================================
  // TEST 4: BILL AMOUNT EDGE CASES
  // =============================================
  console.log("\n--- BILL AMOUNT EDGE CASES ---\n")

  // Check for bills with very large amounts (potential data entry errors)
  const largeBills = await prisma.bill.findMany({
    where: {
      totalAmount: { gt: 100000 },
    },
    include: { unit: true },
  })
  if (largeBills.length > 0) {
    log("Large Bills (>₱100k)", "WARN", `${largeBills.length} bills exceed ₱100,000`)
    largeBills.slice(0, 3).forEach((b) => {
      console.log(`   - ${b.unit.unitNumber} ${b.billNumber}: ₱${Number(b.totalAmount).toFixed(2)}`)
    })
  } else {
    log("Large Bills (>₱100k)", "PASS", "No unusually large bills")
  }

  // Check for bills where paidAmount > totalAmount (should not happen after fix)
  const overpaidBills = await prisma.bill.findMany({
    where: {},
    include: { unit: true },
  })

  let stillOverpaid = 0
  for (const bill of overpaidBills) {
    if (Number(bill.paidAmount) > Number(bill.totalAmount) + 0.01) {
      stillOverpaid++
      if (stillOverpaid <= 3) {
        console.log(`   Found: ${bill.billNumber} - Paid: ${Number(bill.paidAmount).toFixed(2)} > Total: ${Number(bill.totalAmount).toFixed(2)}`)
      }
    }
  }

  if (stillOverpaid > 0) {
    log("Overpaid Bills (paidAmount > total)", "WARN", `${stillOverpaid} bills show overpayment`)
  } else {
    log("Overpaid Bills (paidAmount > total)", "PASS", "No bills with paidAmount > totalAmount")
  }

  // =============================================
  // TEST 5: UNIT-OWNER RELATIONSHIP
  // =============================================
  console.log("\n--- UNIT-OWNER RELATIONSHIP TESTS ---\n")

  // Check for units with bills but no owner
  const unitsWithBillsNoOwner = await prisma.unit.findMany({
    where: {
      ownerId: null,
      bills: {
        some: {},
      },
    },
    include: {
      _count: { select: { bills: true } },
    },
  })

  if (unitsWithBillsNoOwner.length > 0) {
    log("Units with Bills but No Owner", "WARN", `${unitsWithBillsNoOwner.length} units have bills but no owner assigned`)
    unitsWithBillsNoOwner.slice(0, 3).forEach((u) => {
      console.log(`   - ${u.unitNumber}: ${u._count.bills} bills`)
    })
  } else {
    log("Units with Bills but No Owner", "PASS", "All units with bills have owners")
  }

  // Check for owners with no units
  const ownersWithNoUnits = await prisma.owner.findMany({
    where: {
      units: {
        none: {},
      },
    },
  })

  if (ownersWithNoUnits.length > 0) {
    log("Owners with No Units", "WARN", `${ownersWithNoUnits.length} owners have no units assigned`)
  } else {
    log("Owners with No Units", "PASS", "All owners have at least one unit")
  }

  // =============================================
  // TEST 6: DATE CONSISTENCY
  // =============================================
  console.log("\n--- DATE CONSISTENCY TESTS ---\n")

  // Check for bills where dueDate < statementDate
  const invalidDueDates = await prisma.bill.findMany({
    where: {},
    select: {
      id: true,
      billNumber: true,
      statementDate: true,
      dueDate: true,
    },
  })

  let invalidDateCount = 0
  for (const bill of invalidDueDates) {
    if (bill.dueDate < bill.statementDate) {
      invalidDateCount++
      if (invalidDateCount <= 3) {
        console.log(`   Found: ${bill.billNumber} - Due: ${bill.dueDate.toISOString().split("T")[0]} < Statement: ${bill.statementDate.toISOString().split("T")[0]}`)
      }
    }
  }

  if (invalidDateCount > 0) {
    log("Invalid Due Dates", "FAIL", `${invalidDateCount} bills have dueDate before statementDate`)
  } else {
    log("Invalid Due Dates", "PASS", "All bills have valid date sequence")
  }

  // Check for payments with future dates
  const futurePayments = await prisma.payment.findMany({
    where: {
      paymentDate: { gt: new Date() },
    },
  })

  if (futurePayments.length > 0) {
    log("Future-Dated Payments", "WARN", `${futurePayments.length} payments have future dates`)
  } else {
    log("Future-Dated Payments", "PASS", "No future-dated payments")
  }

  // =============================================
  // TEST 7: METER READING SEQUENCE
  // =============================================
  console.log("\n--- METER READING SEQUENCE TESTS ---\n")

  // Check if present readings from last month = previous readings this month
  const electricReadings = await prisma.electricReading.findMany({
    orderBy: [{ unitId: "asc" }, { billingPeriod: "asc" }],
    take: 500,
  })

  let readingGapCount = 0
  let lastUnitId = ""
  let lastPresent = 0

  for (const reading of electricReadings) {
    if (reading.unitId === lastUnitId) {
      // Same unit, check sequence
      const expectedPrevious = lastPresent
      const actualPrevious = Number(reading.previousReading)
      if (Math.abs(expectedPrevious - actualPrevious) > 0.01) {
        readingGapCount++
        if (readingGapCount <= 3) {
          console.log(`   Gap: Unit ${reading.unitId} - Expected prev: ${expectedPrevious}, Actual: ${actualPrevious}`)
        }
      }
    }
    lastUnitId = reading.unitId
    lastPresent = Number(reading.presentReading)
  }

  if (readingGapCount > 0) {
    log("Reading Sequence Gaps", "WARN", `${readingGapCount} electric readings have sequence gaps`)
  } else {
    log("Reading Sequence Gaps", "PASS", "All electric readings have proper sequence")
  }

  // =============================================
  // TEST 8: TENANT SETTINGS VALIDATION
  // =============================================
  console.log("\n--- TENANT SETTINGS TESTS ---\n")

  const settings = tenant.settings
  if (!settings) {
    log("Tenant Settings", "FAIL", "No tenant settings found!")
  } else {
    const issues: string[] = []

    // Check for invalid rates
    if (Number(settings.electricRate) <= 0) issues.push("electricRate is 0 or negative")
    if (Number(settings.associationDuesRate) <= 0) issues.push("associationDuesRate is 0 or negative")
    if (Number(settings.penaltyRate) <= 0) issues.push("penaltyRate is 0 or negative")
    if (Number(settings.penaltyRate) > 0.5) issues.push(`penaltyRate is ${Number(settings.penaltyRate) * 100}% (>50%, very high!)`)

    // Check water tiers are in order
    const resTiers = [
      Number(settings.waterResTier1Max),
      Number(settings.waterResTier2Max),
      Number(settings.waterResTier3Max),
      Number(settings.waterResTier4Max),
      Number(settings.waterResTier5Max),
      Number(settings.waterResTier6Max),
    ]

    for (let i = 1; i < resTiers.length; i++) {
      if (resTiers[i] <= resTiers[i - 1]) {
        issues.push(`Water tier ${i + 1} max (${resTiers[i]}) <= tier ${i} max (${resTiers[i - 1]})`)
      }
    }

    if (issues.length > 0) {
      log("Tenant Settings Validation", "WARN", issues.join("; "))
    } else {
      log("Tenant Settings Validation", "PASS", "All settings look valid")
    }
  }

  // =============================================
  // SUMMARY
  // =============================================
  console.log("\n" + "=".repeat(70))
  console.log("EDGE CASE TEST SUMMARY")
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
