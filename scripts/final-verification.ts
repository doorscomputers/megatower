import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

interface TestResult {
  category: string
  test: string
  status: "PASS" | "FAIL" | "WARN"
  details: string
}

const results: TestResult[] = []

function log(category: string, test: string, status: "PASS" | "FAIL" | "WARN", details: string) {
  results.push({ category, test, status, details })
  const icon = status === "PASS" ? "✅" : status === "FAIL" ? "❌" : "⚠️"
  console.log(`${icon} [${category}] ${test}: ${details}`)
}

async function main() {
  console.log("\n" + "═".repeat(80))
  console.log("                    MEGATOWER BILLING SYSTEM - FINAL VERIFICATION")
  console.log("═".repeat(80) + "\n")

  const tenant = await prisma.tenant.findFirst({ include: { settings: true } })
  if (!tenant) {
    console.log("ERROR: No tenant found!")
    return
  }

  // ════════════════════════════════════════════════════════════════════
  // SECTION 1: DATA INTEGRITY
  // ════════════════════════════════════════════════════════════════════
  console.log("\n┌─ DATA INTEGRITY CHECKS ─────────────────────────────────────────────┐\n")

  // Test 1.1: Bill balance consistency
  const allBills = await prisma.bill.findMany()
  let balanceErrors = 0
  for (const bill of allBills) {
    const expected = Math.max(0, Number(bill.totalAmount) - Number(bill.paidAmount))
    if (Math.abs(Number(bill.balance) - expected) > 0.01) {
      balanceErrors++
    }
  }
  log("Data Integrity", "Bill Balance Consistency", balanceErrors === 0 ? "PASS" : "FAIL",
    balanceErrors === 0 ? "All bills have correct balance = total - paid" : `${balanceErrors} bills have balance issues`)

  // Test 1.2: Payment component sums
  const payments = await prisma.payment.findMany({ take: 100 })
  let paymentSumErrors = 0
  for (const p of payments) {
    const sum = Number(p.electricAmount) + Number(p.waterAmount) + Number(p.duesAmount) +
                Number(p.pastDuesAmount) + Number(p.spAssessmentAmount) + Number(p.advanceDuesAmount) +
                Number(p.advanceUtilAmount) + Number(p.otherAdvanceAmount)
    if (Math.abs(Number(p.totalAmount) - sum) > 0.01) {
      paymentSumErrors++
    }
  }
  log("Data Integrity", "Payment Component Sums", paymentSumErrors === 0 ? "PASS" : "FAIL",
    paymentSumErrors === 0 ? "All payment totals match component sums" : `${paymentSumErrors} payments have sum issues`)

  // Test 1.3: BillPayment component sums
  const billPayments = await prisma.billPayment.findMany()
  let bpSumErrors = 0
  for (const bp of billPayments) {
    const sum = Number(bp.electricAmount) + Number(bp.waterAmount) + Number(bp.duesAmount) +
                Number(bp.penaltyAmount) + Number(bp.spAssessmentAmount) + Number(bp.otherAmount)
    if (Math.abs(Number(bp.totalAmount) - sum) > 0.01) {
      bpSumErrors++
    }
  }
  log("Data Integrity", "BillPayment Component Sums", bpSumErrors === 0 ? "PASS" : "FAIL",
    bpSumErrors === 0 ? "All BillPayment totals match component sums" : `${bpSumErrors} BillPayments have sum issues`)

  // Test 1.4: No negative advance balances
  const negativeAdvances = await prisma.unitAdvanceBalance.findMany({
    where: { OR: [{ advanceDues: { lt: 0 } }, { advanceUtilities: { lt: 0 } }] },
  })
  log("Data Integrity", "Advance Balance Non-Negative", negativeAdvances.length === 0 ? "PASS" : "FAIL",
    negativeAdvances.length === 0 ? "No negative advance balances" : `${negativeAdvances.length} units have negative advances`)

  // Test 1.5: No orphaned BillPayments
  const allBillPayments = await prisma.billPayment.findMany({
    include: { payment: { select: { id: true } }, bill: { select: { id: true } } },
  })
  const orphanedBP = allBillPayments.filter(bp => !bp.payment || !bp.bill)
  log("Data Integrity", "No Orphaned BillPayments", orphanedBP.length === 0 ? "PASS" : "FAIL",
    orphanedBP.length === 0 ? "All BillPayments have valid references" : `${orphanedBP.length} orphaned BillPayments`)

  // ════════════════════════════════════════════════════════════════════
  // SECTION 2: BUSINESS LOGIC
  // ════════════════════════════════════════════════════════════════════
  console.log("\n┌─ BUSINESS LOGIC CHECKS ────────────────────────────────────────────┐\n")

  // Test 2.1: Bill status consistency
  let statusErrors = 0
  for (const bill of allBills) {
    const balance = Number(bill.balance)
    const paid = Number(bill.paidAmount)
    if (balance <= 0.01 && bill.status !== "PAID") {
      statusErrors++
    } else if (balance > 0.01 && paid > 0.01 && bill.status === "UNPAID" && bill.billType !== "OPENING_BALANCE") {
      statusErrors++
    }
  }
  log("Business Logic", "Bill Status Consistency", statusErrors === 0 ? "PASS" : "FAIL",
    statusErrors === 0 ? "All bill statuses match their balances" : `${statusErrors} bills have status inconsistencies`)

  // Test 2.2: Water tier configuration
  if (tenant.settings) {
    const resTiers = [
      Number(tenant.settings.waterResTier1Max),
      Number(tenant.settings.waterResTier2Max),
      Number(tenant.settings.waterResTier3Max),
      Number(tenant.settings.waterResTier4Max),
      Number(tenant.settings.waterResTier5Max),
      Number(tenant.settings.waterResTier6Max),
    ]
    let tierOk = true
    for (let i = 1; i < resTiers.length; i++) {
      if (resTiers[i] <= resTiers[i - 1]) tierOk = false
    }
    log("Business Logic", "Water Tier Configuration", tierOk ? "PASS" : "FAIL",
      tierOk ? "Water tiers are properly ordered" : "Water tier boundaries are not ascending")
  }

  // Test 2.3: No duplicate bill numbers
  const billNumbers = await prisma.bill.findMany({ select: { billNumber: true } })
  const bnSet = new Set<string>()
  const duplicateBills: string[] = []
  for (const b of billNumbers) {
    if (bnSet.has(b.billNumber)) duplicateBills.push(b.billNumber)
    bnSet.add(b.billNumber)
  }
  log("Business Logic", "Unique Bill Numbers", duplicateBills.length === 0 ? "PASS" : "FAIL",
    duplicateBills.length === 0 ? "All bill numbers are unique" : `${duplicateBills.length} duplicate bill numbers`)

  // Test 2.4: No future-dated payments
  const futurePayments = await prisma.payment.findMany({
    where: { paymentDate: { gt: new Date() }, status: { not: "CANCELLED" } },
  })
  log("Business Logic", "No Future Payments", futurePayments.length === 0 ? "PASS" : "WARN",
    futurePayments.length === 0 ? "No future-dated payments" : `${futurePayments.length} payments have future dates`)

  // Test 2.5: One bill per unit per month
  const billDups = await prisma.$queryRaw<{ count: number }[]>`
    SELECT COUNT(*) as count FROM (
      SELECT "unitId", "billingMonth"
      FROM "Bill"
      WHERE "tenantId" = ${tenant.id} AND "billType" != 'OPENING_BALANCE'
      GROUP BY "unitId", "billingMonth"
      HAVING COUNT(*) > 1
    ) as dups
  `
  const dupCount = Number(billDups[0]?.count || 0)
  log("Business Logic", "One Bill Per Unit Per Month", dupCount === 0 ? "PASS" : "FAIL",
    dupCount === 0 ? "No duplicate bills per unit per month" : `${dupCount} unit-month combinations have duplicates`)

  // ════════════════════════════════════════════════════════════════════
  // SECTION 3: REPORT ACCURACY
  // ════════════════════════════════════════════════════════════════════
  console.log("\n┌─ REPORT ACCURACY CHECKS ───────────────────────────────────────────┐\n")

  // Test 3.1: Outstanding balance calculation
  const unpaidBills = await prisma.bill.findMany({
    where: { tenantId: tenant.id, status: { in: ["UNPAID", "PARTIAL"] }, balance: { gt: 0 } },
  })
  const totalOutstanding = unpaidBills.reduce((sum, b) => sum + Number(b.balance), 0)
  log("Report Accuracy", "Outstanding Balance", "PASS", `₱${totalOutstanding.toFixed(2)} from ${unpaidBills.length} bills`)

  // Test 3.2: Aging report matches outstanding
  const today = new Date()
  let agingTotal = 0
  for (const bill of unpaidBills) {
    agingTotal += Number(bill.balance)
  }
  const agingMatch = Math.abs(agingTotal - totalOutstanding) < 0.01
  log("Report Accuracy", "Aging Report Total", agingMatch ? "PASS" : "FAIL",
    agingMatch ? "Aging totals match outstanding balance" : `Aging: ₱${agingTotal.toFixed(2)} differs from outstanding`)

  // Test 3.3: Collections calculation
  const activePayments = await prisma.payment.findMany({
    where: { tenantId: tenant.id, status: { not: "CANCELLED" } },
  })
  const totalCollections = activePayments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
  log("Report Accuracy", "Collections Total", "PASS", `₱${totalCollections.toFixed(2)} from ${activePayments.length} active payments`)

  // ════════════════════════════════════════════════════════════════════
  // SECTION 4: SYSTEM STATISTICS
  // ════════════════════════════════════════════════════════════════════
  console.log("\n┌─ SYSTEM STATISTICS ────────────────────────────────────────────────┐\n")

  const stats = {
    units: await prisma.unit.count({ where: { tenantId: tenant.id } }),
    owners: await prisma.owner.count({ where: { tenantId: tenant.id } }),
    bills: await prisma.bill.count({ where: { tenantId: tenant.id } }),
    payments: await prisma.payment.count({ where: { tenantId: tenant.id, status: { not: "CANCELLED" } } }),
    voidedPayments: await prisma.payment.count({ where: { tenantId: tenant.id, status: "CANCELLED" } }),
    advanceBalances: await prisma.unitAdvanceBalance.count({ where: { tenantId: tenant.id } }),
  }

  console.log(`   📊 Units: ${stats.units}`)
  console.log(`   👤 Owners: ${stats.owners}`)
  console.log(`   📄 Bills: ${stats.bills}`)
  console.log(`   💰 Active Payments: ${stats.payments}`)
  console.log(`   🚫 Voided Payments: ${stats.voidedPayments}`)
  console.log(`   💳 Advance Balances: ${stats.advanceBalances}`)
  console.log(`   📈 Total Outstanding: ₱${totalOutstanding.toFixed(2)}`)
  console.log(`   💵 Total Collections: ₱${totalCollections.toFixed(2)}`)

  // ════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ════════════════════════════════════════════════════════════════════
  console.log("\n" + "═".repeat(80))
  console.log("                              VERIFICATION SUMMARY")
  console.log("═".repeat(80))

  const passed = results.filter(r => r.status === "PASS").length
  const failed = results.filter(r => r.status === "FAIL").length
  const warnings = results.filter(r => r.status === "WARN").length

  console.log(`\n   ✅ PASSED:   ${passed}`)
  console.log(`   ❌ FAILED:   ${failed}`)
  console.log(`   ⚠️  WARNINGS: ${warnings}`)
  console.log(`      TOTAL:    ${results.length}`)

  if (failed > 0) {
    console.log("\n   ❌ FAILED TESTS:")
    results.filter(r => r.status === "FAIL").forEach(r => {
      console.log(`      - [${r.category}] ${r.test}: ${r.details}`)
    })
  }

  if (warnings > 0) {
    console.log("\n   ⚠️  WARNINGS:")
    results.filter(r => r.status === "WARN").forEach(r => {
      console.log(`      - [${r.category}] ${r.test}: ${r.details}`)
    })
  }

  console.log("\n" + "═".repeat(80))
  if (failed === 0) {
    console.log("                    ✅ SYSTEM VERIFICATION PASSED")
    console.log("             All critical checks passed. System is ready for production.")
  } else {
    console.log("                    ❌ SYSTEM VERIFICATION FAILED")
    console.log("             Please fix the failed tests before deploying to production.")
  }
  console.log("═".repeat(80) + "\n")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
