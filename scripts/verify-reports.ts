/**
 * Report Data Verification Script
 * Verifies report calculations match actual database data
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("\n" + "=".repeat(60))
  console.log("REPORT DATA VERIFICATION")
  console.log("=".repeat(60) + "\n")

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.log("ERROR: No tenant found!")
    return
  }

  // ===========================================
  // 1. OUTSTANDING BALANCE REPORT
  // ===========================================
  console.log("1. OUTSTANDING BALANCE VERIFICATION\n")

  // Calculate total outstanding from bills
  const outstandingBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
    },
    include: { unit: true },
  })

  const totalOutstanding = outstandingBills.reduce(
    (sum, b) => sum + Number(b.balance),
    0
  )
  const unitsWithBalance = new Set(outstandingBills.map((b) => b.unitId)).size

  console.log(`   Total Outstanding: ₱${totalOutstanding.toFixed(2)}`)
  console.log(`   Units with Balance: ${unitsWithBalance}`)
  console.log(`   Unpaid Bills: ${outstandingBills.length}`)

  // Breakdown by component
  let electricTotal = 0
  let waterTotal = 0
  let duesTotal = 0
  let penaltyTotal = 0
  let spTotal = 0
  let otherTotal = 0

  for (const bill of outstandingBills) {
    // Get payments for this bill
    const payments = await prisma.billPayment.findMany({
      where: { billId: bill.id },
    })

    const paidElectric = payments.reduce((sum, p) => sum + Number(p.electricAmount), 0)
    const paidWater = payments.reduce((sum, p) => sum + Number(p.waterAmount), 0)
    const paidDues = payments.reduce((sum, p) => sum + Number(p.duesAmount), 0)
    const paidPenalty = payments.reduce((sum, p) => sum + Number(p.penaltyAmount), 0)
    const paidSP = payments.reduce((sum, p) => sum + Number(p.spAssessmentAmount), 0)

    electricTotal += Math.max(0, Number(bill.electricAmount) - paidElectric)
    waterTotal += Math.max(0, Number(bill.waterAmount) - paidWater)
    duesTotal += Math.max(0, Number(bill.associationDues) - paidDues)
    penaltyTotal += Math.max(0, Number(bill.penaltyAmount) - paidPenalty)
    spTotal += Math.max(0, Number(bill.spAssessment) - paidSP)
    otherTotal += Math.max(0, Number(bill.otherCharges) + Number(bill.parkingFee))
  }

  console.log(`\n   Breakdown by Component:`)
  console.log(`   - Electric: ₱${electricTotal.toFixed(2)}`)
  console.log(`   - Water: ₱${waterTotal.toFixed(2)}`)
  console.log(`   - Assoc Dues: ₱${duesTotal.toFixed(2)}`)
  console.log(`   - Penalty: ₱${penaltyTotal.toFixed(2)}`)
  console.log(`   - SP Assessment: ₱${spTotal.toFixed(2)}`)
  console.log(`   - Other/Parking: ₱${otherTotal.toFixed(2)}`)

  // ===========================================
  // 2. COLLECTIONS REPORT
  // ===========================================
  console.log("\n2. COLLECTIONS VERIFICATION\n")

  const thisMonth = new Date()
  const startOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth(), 1)
  const endOfMonth = new Date(thisMonth.getFullYear(), thisMonth.getMonth() + 1, 0)

  const monthlyPayments = await prisma.payment.findMany({
    where: {
      tenantId: tenant.id,
      paymentDate: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  })

  const monthlyTotal = monthlyPayments.reduce(
    (sum, p) => sum + Number(p.totalAmount),
    0
  )

  console.log(`   Month: ${startOfMonth.toLocaleString("default", { month: "long", year: "numeric" })}`)
  console.log(`   Total Payments: ${monthlyPayments.length}`)
  console.log(`   Total Collected: ₱${monthlyTotal.toFixed(2)}`)

  // ===========================================
  // 3. AGING REPORT
  // ===========================================
  console.log("\n3. AGING REPORT VERIFICATION\n")

  const today = new Date()
  let current = 0
  let days30 = 0
  let days60 = 0
  let days90 = 0
  let days90Plus = 0

  for (const bill of outstandingBills) {
    const dueDate = bill.dueDate
    const daysPastDue = Math.floor(
      (today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
    )
    const balance = Number(bill.balance)

    if (daysPastDue <= 0) {
      current += balance
    } else if (daysPastDue <= 30) {
      days30 += balance
    } else if (daysPastDue <= 60) {
      days60 += balance
    } else if (daysPastDue <= 90) {
      days90 += balance
    } else {
      days90Plus += balance
    }
  }

  console.log(`   Current (not past due): ₱${current.toFixed(2)}`)
  console.log(`   1-30 Days: ₱${days30.toFixed(2)}`)
  console.log(`   31-60 Days: ₱${days60.toFixed(2)}`)
  console.log(`   61-90 Days: ₱${days90.toFixed(2)}`)
  console.log(`   90+ Days: ₱${days90Plus.toFixed(2)}`)
  console.log(`   Total: ₱${(current + days30 + days60 + days90 + days90Plus).toFixed(2)}`)

  // ===========================================
  // 4. BILL STATUS SUMMARY
  // ===========================================
  console.log("\n4. BILL STATUS SUMMARY\n")

  const statusCounts = await prisma.bill.groupBy({
    by: ["status"],
    where: { tenantId: tenant.id },
    _count: { id: true },
  })

  for (const status of statusCounts) {
    console.log(`   ${status.status}: ${status._count.id}`)
  }

  // ===========================================
  // 5. FLOOR SUMMARY
  // ===========================================
  console.log("\n5. FLOOR SUMMARY VERIFICATION\n")

  const floors = await prisma.unit.groupBy({
    by: ["floorLevel"],
    where: { tenantId: tenant.id, isActive: true },
    _count: { id: true },
  })

  console.log(`   Floors with units: ${floors.length}`)
  for (const floor of floors.slice(0, 5)) {
    console.log(`   - ${floor.floorLevel}: ${floor._count.id} units`)
  }
  if (floors.length > 5) {
    console.log(`   ... and ${floors.length - 5} more floors`)
  }

  // ===========================================
  // 6. DELINQUENCY CHECK
  // ===========================================
  console.log("\n6. DELINQUENCY CHECK\n")

  // Units with multiple unpaid bills
  const delinquentUnits = outstandingBills.reduce((acc, bill) => {
    acc[bill.unitId] = (acc[bill.unitId] || 0) + 1
    return acc
  }, {} as Record<string, number>)

  const unitsMultipleUnpaid = Object.values(delinquentUnits).filter((count) => count > 1).length
  const maxUnpaidBills = Math.max(...Object.values(delinquentUnits), 0)

  console.log(`   Units with 1 unpaid bill: ${Object.values(delinquentUnits).filter((c) => c === 1).length}`)
  console.log(`   Units with 2+ unpaid bills: ${unitsMultipleUnpaid}`)
  console.log(`   Max unpaid bills for a unit: ${maxUnpaidBills}`)

  // ===========================================
  // SUMMARY
  // ===========================================
  console.log("\n" + "=".repeat(60))
  console.log("REPORT VERIFICATION COMPLETE")
  console.log("=".repeat(60))
  console.log(`\nKey Metrics:`)
  console.log(`- Total Outstanding: ₱${totalOutstanding.toFixed(2)}`)
  console.log(`- Units with Balance: ${unitsWithBalance}`)
  console.log(`- This Month Collections: ₱${monthlyTotal.toFixed(2)}`)
  console.log(`- Delinquent Units (2+ bills): ${unitsMultipleUnpaid}`)
  console.log("")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
