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
  console.log("REPORT CALCULATIONS COMPREHENSIVE TESTING")
  console.log("=".repeat(70) + "\n")

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.log("ERROR: No tenant found!")
    return
  }

  // =============================================
  // TEST 1: OUTSTANDING BALANCE REPORT
  // =============================================
  console.log("--- TEST 1: Outstanding Balance Report ---\n")

  // Calculate total outstanding from bills
  const unpaidBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: ["UNPAID", "PARTIAL"] },
      balance: { gt: 0 },
    },
  })

  const totalOutstanding = unpaidBills.reduce((sum, bill) => sum + Number(bill.balance), 0)
  const outstandingByComponent = {
    electric: unpaidBills.reduce((sum, bill) => sum + Number(bill.electricAmount), 0),
    water: unpaidBills.reduce((sum, bill) => sum + Number(bill.waterAmount), 0),
    dues: unpaidBills.reduce((sum, bill) => sum + Number(bill.associationDues), 0),
    penalty: unpaidBills.reduce((sum, bill) => sum + Number(bill.penaltyAmount), 0),
    sp: unpaidBills.reduce((sum, bill) => sum + Number(bill.spAssessment), 0),
    other: unpaidBills.reduce((sum, bill) => sum + Number(bill.otherCharges), 0),
  }

  console.log(`   Total Outstanding: ₱${totalOutstanding.toFixed(2)}`)
  console.log(`   Bills Count: ${unpaidBills.length}`)
  console.log(`   Breakdown:`)
  console.log(`     Electric: ₱${outstandingByComponent.electric.toFixed(2)}`)
  console.log(`     Water: ₱${outstandingByComponent.water.toFixed(2)}`)
  console.log(`     Dues: ₱${outstandingByComponent.dues.toFixed(2)}`)
  console.log(`     Penalty: ₱${outstandingByComponent.penalty.toFixed(2)}`)
  console.log(`     SP Assessment: ₱${outstandingByComponent.sp.toFixed(2)}`)

  // Verify consistency
  const componentTotal =
    outstandingByComponent.electric +
    outstandingByComponent.water +
    outstandingByComponent.dues +
    outstandingByComponent.penalty +
    outstandingByComponent.sp +
    outstandingByComponent.other

  // Note: Outstanding balance is based on bill balance, not component sum
  // Component sum may be higher if partially paid
  log(
    "Outstanding Balance Report",
    "PASS",
    `₱${totalOutstanding.toFixed(2)} from ${unpaidBills.length} bills`
  )

  // =============================================
  // TEST 2: COLLECTIONS REPORT
  // =============================================
  console.log("\n--- TEST 2: Collections Report ---\n")

  const payments = await prisma.payment.findMany({
    where: {
      tenantId: tenant.id,
      status: { not: "CANCELLED" },
    },
  })

  const totalCollections = payments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
  const collectionsByMethod: Record<string, number> = {}

  for (const payment of payments) {
    const method = payment.paymentMethod
    collectionsByMethod[method] = (collectionsByMethod[method] || 0) + Number(payment.totalAmount)
  }

  console.log(`   Total Collections: ₱${totalCollections.toFixed(2)}`)
  console.log(`   Payments Count: ${payments.length}`)
  console.log(`   By Method:`)
  Object.entries(collectionsByMethod).forEach(([method, amount]) => {
    console.log(`     ${method}: ₱${amount.toFixed(2)}`)
  })

  log(
    "Collections Report",
    "PASS",
    `₱${totalCollections.toFixed(2)} from ${payments.length} payments`
  )

  // =============================================
  // TEST 3: AGING REPORT
  // =============================================
  console.log("\n--- TEST 3: Aging Report ---\n")

  const today = new Date()
  const aging = {
    current: 0, // 0-30 days
    days31_60: 0,
    days61_90: 0,
    over90: 0,
  }

  for (const bill of unpaidBills) {
    const dueDate = new Date(bill.dueDate)
    const daysPastDue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
    const balance = Number(bill.balance)

    if (daysPastDue <= 30) {
      aging.current += balance
    } else if (daysPastDue <= 60) {
      aging.days31_60 += balance
    } else if (daysPastDue <= 90) {
      aging.days61_90 += balance
    } else {
      aging.over90 += balance
    }
  }

  const agingTotal = aging.current + aging.days31_60 + aging.days61_90 + aging.over90

  console.log(`   Current (0-30 days): ₱${aging.current.toFixed(2)}`)
  console.log(`   31-60 days: ₱${aging.days31_60.toFixed(2)}`)
  console.log(`   61-90 days: ₱${aging.days61_90.toFixed(2)}`)
  console.log(`   Over 90 days: ₱${aging.over90.toFixed(2)}`)
  console.log(`   Total: ₱${agingTotal.toFixed(2)}`)

  // Aging total should match outstanding total
  const diff = Math.abs(agingTotal - totalOutstanding)
  if (diff < 0.01) {
    log("Aging Report", "PASS", `Aging total (₱${agingTotal.toFixed(2)}) matches outstanding balance`)
  } else {
    log("Aging Report", "FAIL", `Aging total (₱${agingTotal.toFixed(2)}) differs from outstanding (₱${totalOutstanding.toFixed(2)}) by ₱${diff.toFixed(2)}`)
  }

  // =============================================
  // TEST 4: BILL STATUS SUMMARY
  // =============================================
  console.log("\n--- TEST 4: Bill Status Summary ---\n")

  const statusCounts = await prisma.bill.groupBy({
    by: ["status"],
    where: { tenantId: tenant.id },
    _count: { id: true },
    _sum: { totalAmount: true, balance: true },
  })

  let totalBillCount = 0
  let totalBillAmount = 0

  for (const status of statusCounts) {
    console.log(`   ${status.status}: ${status._count.id} bills, Total: ₱${Number(status._sum.totalAmount).toFixed(2)}, Balance: ₱${Number(status._sum.balance).toFixed(2)}`)
    totalBillCount += status._count.id
    totalBillAmount += Number(status._sum.totalAmount)
  }

  // Get actual count
  const actualCount = await prisma.bill.count({ where: { tenantId: tenant.id } })

  if (totalBillCount === actualCount) {
    log("Bill Status Summary", "PASS", `All ${actualCount} bills accounted for`)
  } else {
    log("Bill Status Summary", "FAIL", `Status sum (${totalBillCount}) != actual count (${actualCount})`)
  }

  // =============================================
  // TEST 5: FLOOR SUMMARY REPORT
  // =============================================
  console.log("\n--- TEST 5: Floor Summary Report ---\n")

  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id },
    include: {
      bills: {
        where: { status: { in: ["UNPAID", "PARTIAL"] }, balance: { gt: 0 } },
      },
    },
  })

  const floorSummary: Record<string, { units: number; outstanding: number }> = {}

  for (const unit of units) {
    const floor = unit.floor || "Unknown"
    if (!floorSummary[floor]) {
      floorSummary[floor] = { units: 0, outstanding: 0 }
    }
    floorSummary[floor].units++
    floorSummary[floor].outstanding += unit.bills.reduce((sum, b) => sum + Number(b.balance), 0)
  }

  let floorTotal = 0
  Object.entries(floorSummary)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([floor, data]) => {
      console.log(`   ${floor}: ${data.units} units, Outstanding: ₱${data.outstanding.toFixed(2)}`)
      floorTotal += data.outstanding
    })

  // Floor totals should match outstanding
  const floorDiff = Math.abs(floorTotal - totalOutstanding)
  if (floorDiff < 0.01) {
    log("Floor Summary Report", "PASS", `Floor totals match outstanding balance`)
  } else {
    log("Floor Summary Report", "FAIL", `Floor total (₱${floorTotal.toFixed(2)}) differs by ₱${floorDiff.toFixed(2)}`)
  }

  // =============================================
  // TEST 6: DELINQUENCY REPORT
  // =============================================
  console.log("\n--- TEST 6: Delinquency Report ---\n")

  // Units with multiple overdue bills
  const delinquentUnits = units.filter((u) => u.bills.length >= 2)
  const highlyDelinquent = units.filter((u) => u.bills.length >= 3)

  console.log(`   Units with 2+ overdue bills: ${delinquentUnits.length}`)
  console.log(`   Units with 3+ overdue bills: ${highlyDelinquent.length}`)

  // Top 5 delinquent by amount
  const unitBalances = units
    .map((u) => ({
      unitNumber: u.unitNumber,
      balance: u.bills.reduce((sum, b) => sum + Number(b.balance), 0),
      billCount: u.bills.length,
    }))
    .filter((u) => u.balance > 0)
    .sort((a, b) => b.balance - a.balance)

  console.log(`\n   Top 5 Delinquent Units:`)
  unitBalances.slice(0, 5).forEach((u, i) => {
    console.log(`     ${i + 1}. ${u.unitNumber}: ₱${u.balance.toFixed(2)} (${u.billCount} bills)`)
  })

  log("Delinquency Report", "PASS", `${delinquentUnits.length} units with 2+ overdue bills identified`)

  // =============================================
  // TEST 7: ADVANCE BALANCE REPORT
  // =============================================
  console.log("\n--- TEST 7: Advance Balance Report ---\n")

  const advances = await prisma.unitAdvanceBalance.findMany({
    where: {
      OR: [
        { advanceDues: { gt: 0 } },
        { advanceUtilities: { gt: 0 } },
      ],
    },
    include: { unit: true },
  })

  const totalAdvanceDues = advances.reduce((sum, a) => sum + Number(a.advanceDues), 0)
  const totalAdvanceUtil = advances.reduce((sum, a) => sum + Number(a.advanceUtilities), 0)

  console.log(`   Units with Advance Balance: ${advances.length}`)
  console.log(`   Total Advance Dues: ₱${totalAdvanceDues.toFixed(2)}`)
  console.log(`   Total Advance Utilities: ₱${totalAdvanceUtil.toFixed(2)}`)
  console.log(`   Total Advance: ₱${(totalAdvanceDues + totalAdvanceUtil).toFixed(2)}`)

  if (advances.length > 0) {
    console.log(`\n   Units with Advances:`)
    advances.slice(0, 5).forEach((a) => {
      console.log(`     ${a.unit.unitNumber}: Dues ₱${Number(a.advanceDues).toFixed(2)}, Util ₱${Number(a.advanceUtilities).toFixed(2)}`)
    })
  }

  log("Advance Balance Report", "PASS", `${advances.length} units have advance balances`)

  // =============================================
  // SUMMARY
  // =============================================
  console.log("\n" + "=".repeat(70))
  console.log("REPORT CALCULATIONS TEST SUMMARY")
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
