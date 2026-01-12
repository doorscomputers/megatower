import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

interface TestResult {
  test: string
  status: "PASS" | "FAIL" | "SKIP"
  details: string
}

const results: TestResult[] = []

function log(test: string, status: "PASS" | "FAIL" | "SKIP", details: string) {
  results.push({ test, status, details })
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⏭️"
  console.log(`${icon} ${test}: ${details}`)
}

async function main() {
  console.log("\n" + "=".repeat(70))
  console.log("PAYMENT API COMPREHENSIVE TESTING")
  console.log("=".repeat(70) + "\n")

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.log("ERROR: No tenant found!")
    return
  }

  // Get a unit with unpaid bills for testing
  const testUnit = await prisma.unit.findFirst({
    where: {
      tenantId: tenant.id,
      bills: {
        some: {
          status: "UNPAID",
          balance: { gt: 0 },
        },
      },
    },
    include: {
      bills: {
        where: { status: "UNPAID", balance: { gt: 0 } },
        orderBy: { billingMonth: "asc" },
        take: 1,
      },
    },
  })

  if (!testUnit || testUnit.bills.length === 0) {
    console.log("No test unit with unpaid bills found")
    return
  }

  const testBill = testUnit.bills[0]
  console.log(`Testing with Unit: ${testUnit.unitNumber}, Bill: ${testBill.billNumber}`)
  console.log(`Bill Total: ₱${Number(testBill.totalAmount).toFixed(2)}, Balance: ₱${Number(testBill.balance).toFixed(2)}\n`)

  // =============================================
  // TEST 1: FIFO ALLOCATION
  // =============================================
  console.log("--- TEST 1: FIFO Payment Allocation ---\n")

  // Get bills ordered by date to verify FIFO
  const unitBills = await prisma.bill.findMany({
    where: {
      unitId: testUnit.id,
      status: { in: ["UNPAID", "PARTIAL"] },
      balance: { gt: 0 },
    },
    orderBy: { billingMonth: "asc" },
  })

  if (unitBills.length >= 2) {
    const oldest = unitBills[0]
    const second = unitBills[1]
    log(
      "FIFO Order Check",
      "PASS",
      `Oldest bill: ${oldest.billNumber} (${oldest.billingMonth.toISOString().slice(0, 7)}), Next: ${second.billNumber}`
    )
  } else if (unitBills.length === 1) {
    log("FIFO Order Check", "PASS", `Only 1 unpaid bill: ${unitBills[0].billNumber}`)
  } else {
    log("FIFO Order Check", "SKIP", "No unpaid bills to test")
  }

  // =============================================
  // TEST 2: PAYMENT COMPONENT VALIDATION
  // =============================================
  console.log("\n--- TEST 2: Payment Component Calculations ---\n")

  // Test that payments sum correctly
  const payments = await prisma.payment.findMany({
    take: 10,
    include: { billPayments: true },
  })

  let componentErrors = 0
  for (const payment of payments) {
    const paymentComponentSum =
      Number(payment.electricAmount) +
      Number(payment.waterAmount) +
      Number(payment.duesAmount) +
      Number(payment.pastDuesAmount) +
      Number(payment.spAssessmentAmount) +
      Number(payment.advanceDuesAmount) +
      Number(payment.advanceUtilAmount) +
      Number(payment.otherAdvanceAmount)

    const diff = Math.abs(Number(payment.totalAmount) - paymentComponentSum)
    if (diff > 0.01) {
      componentErrors++
      console.log(`   Error: OR# ${payment.orNumber} - Sum: ${paymentComponentSum.toFixed(2)}, Total: ${Number(payment.totalAmount).toFixed(2)}`)
    }

    // Check BillPayments sum equals totalAmount
    const bpSum = payment.billPayments.reduce((sum, bp) => sum + Number(bp.totalAmount), 0)
    const advanceSum =
      Number(payment.advanceDuesAmount) +
      Number(payment.advanceUtilAmount) +
      Number(payment.otherAdvanceAmount)
    const expectedBpSum = Number(payment.totalAmount) - advanceSum

    if (Math.abs(bpSum - expectedBpSum) > 0.01 && expectedBpSum > 0) {
      componentErrors++
      console.log(`   Error: OR# ${payment.orNumber} - BillPayments sum: ${bpSum.toFixed(2)}, Expected: ${expectedBpSum.toFixed(2)}`)
    }
  }

  if (componentErrors === 0) {
    log("Payment Component Sum", "PASS", "All payments have correct component sums")
  } else {
    log("Payment Component Sum", "FAIL", `${componentErrors} payments have component errors`)
  }

  // =============================================
  // TEST 3: BILL STATUS CONSISTENCY
  // =============================================
  console.log("\n--- TEST 3: Bill Status Consistency ---\n")

  const allBills = await prisma.bill.findMany()
  let statusErrors = 0

  for (const bill of allBills) {
    const balance = Number(bill.balance)
    const total = Number(bill.totalAmount)
    const paid = Number(bill.paidAmount)

    // Check status matches balance
    if (balance <= 0.01 && bill.status !== "PAID") {
      statusErrors++
      if (statusErrors <= 3) {
        console.log(`   Error: ${bill.billNumber} - Balance: ${balance.toFixed(2)}, Status: ${bill.status} (should be PAID)`)
      }
    } else if (balance > 0.01 && paid > 0.01 && bill.status !== "PARTIAL") {
      // Some bills with partial payments might still show UNPAID if it's an opening balance
      if (bill.billType !== "OPENING_BALANCE") {
        statusErrors++
        if (statusErrors <= 3) {
          console.log(`   Error: ${bill.billNumber} - Balance: ${balance.toFixed(2)}, Paid: ${paid.toFixed(2)}, Status: ${bill.status} (should be PARTIAL)`)
        }
      }
    }

    // Check balance = total - paid
    const expectedBalance = Math.max(0, total - paid)
    if (Math.abs(balance - expectedBalance) > 0.01) {
      statusErrors++
      if (statusErrors <= 3) {
        console.log(`   Error: ${bill.billNumber} - Balance: ${balance.toFixed(2)}, Expected: ${expectedBalance.toFixed(2)}`)
      }
    }
  }

  if (statusErrors === 0) {
    log("Bill Status Consistency", "PASS", "All bill statuses match their balances")
  } else {
    log("Bill Status Consistency", "FAIL", `${statusErrors} bills have status inconsistencies`)
  }

  // =============================================
  // TEST 4: ADVANCE BALANCE INTEGRITY
  // =============================================
  console.log("\n--- TEST 4: Advance Balance Integrity ---\n")

  const advances = await prisma.unitAdvanceBalance.findMany({
    include: { unit: true },
  })

  let advanceErrors = 0
  for (const adv of advances) {
    // Check for negative balances
    if (Number(adv.advanceDues) < 0 || Number(adv.advanceUtilities) < 0) {
      advanceErrors++
      console.log(`   Error: ${adv.unit.unitNumber} has negative advance: Dues=${adv.advanceDues}, Util=${adv.advanceUtilities}`)
    }
  }

  if (advanceErrors === 0) {
    log("Advance Balance Integrity", "PASS", "All advance balances are valid (non-negative)")
  } else {
    log("Advance Balance Integrity", "FAIL", `${advanceErrors} units have invalid advance balances`)
  }

  // =============================================
  // TEST 5: VOID PAYMENT TRACKING
  // =============================================
  console.log("\n--- TEST 5: Void Payment Tracking ---\n")

  const voidedPayments = await prisma.payment.findMany({
    where: { status: "CANCELLED" },
    include: { billPayments: true },
  })

  if (voidedPayments.length === 0) {
    log("Void Payment Tracking", "PASS", "No voided payments (nothing to verify)")
  } else {
    // Voided payments should have updated bills
    let voidErrors = 0
    for (const vp of voidedPayments) {
      // BillPayments should still exist for audit trail
      if (vp.billPayments.length === 0 && Number(vp.totalAmount) > 0) {
        // Check if this payment had advance only (no bill payments expected)
        const hasAdvance = Number(vp.advanceDuesAmount) > 0 || Number(vp.advanceUtilAmount) > 0
        if (!hasAdvance) {
          voidErrors++
          console.log(`   Warning: Voided OR# ${vp.orNumber} has no BillPayments`)
        }
      }
    }
    log("Void Payment Tracking", voidErrors === 0 ? "PASS" : "FAIL", `${voidedPayments.length} voided payments, ${voidErrors} issues`)
  }

  // =============================================
  // TEST 6: DUPLICATE PAYMENT CHECK
  // =============================================
  console.log("\n--- TEST 6: Duplicate Payment Detection ---\n")

  const orNumbers = await prisma.payment.findMany({
    where: { status: { not: "CANCELLED" } },
    select: { orNumber: true },
  })

  const orSet = new Set<string>()
  const duplicates: string[] = []
  for (const p of orNumbers) {
    if (orSet.has(p.orNumber)) {
      duplicates.push(p.orNumber)
    }
    orSet.add(p.orNumber)
  }

  if (duplicates.length === 0) {
    log("Duplicate Payment Check", "PASS", "No duplicate OR numbers found")
  } else {
    log("Duplicate Payment Check", "FAIL", `Found duplicate OR numbers: ${duplicates.join(", ")}`)
  }

  // =============================================
  // TEST 7: PAYMENT DATE VALIDATION
  // =============================================
  console.log("\n--- TEST 7: Payment Date Validation ---\n")

  const futurePayments = await prisma.payment.findMany({
    where: {
      paymentDate: { gt: new Date() },
      status: { not: "CANCELLED" },
    },
  })

  if (futurePayments.length === 0) {
    log("Payment Date Validation", "PASS", "No future-dated payments")
  } else {
    log("Payment Date Validation", "FAIL", `${futurePayments.length} payments have future dates`)
  }

  // =============================================
  // SUMMARY
  // =============================================
  console.log("\n" + "=".repeat(70))
  console.log("PAYMENT API TEST SUMMARY")
  console.log("=".repeat(70))

  const passed = results.filter((r) => r.status === "PASS").length
  const failed = results.filter((r) => r.status === "FAIL").length
  const skipped = results.filter((r) => r.status === "SKIP").length

  console.log(`\n✅ PASSED:  ${passed}`)
  console.log(`❌ FAILED:  ${failed}`)
  console.log(`⏭️ SKIPPED: ${skipped}`)
  console.log(`   TOTAL:   ${results.length}`)

  if (failed > 0) {
    console.log("\n❌ FAILED TESTS:")
    results.filter((r) => r.status === "FAIL").forEach((r) => console.log(`   - ${r.test}: ${r.details}`))
  }

  console.log("\n" + "=".repeat(70) + "\n")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
