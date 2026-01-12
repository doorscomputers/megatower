import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/**
 * This script tests the penalty calculation logic
 * to verify it matches Ma'am Rose's Excel formula
 */
async function main() {
  const tenant = await prisma.tenant.findFirst({ include: { settings: true } })
  if (!tenant?.settings) {
    console.log("No tenant settings found")
    return
  }

  const penaltyRate = Number(tenant.settings.penaltyRate)
  console.log("=== PENALTY CALCULATION TEST ===\n")
  console.log(`Settings penaltyRate: ${penaltyRate} (${penaltyRate * 100}%)\n`)

  // Simulate Ma'am Rose's formula
  // September bill (2 months overdue in November): 10% simple interest
  // October bill (1 month overdue): grace period, no interest
  // December: September 3 months, October 2 months

  const testPrincipal = 3000 // Test with 3000 peso principal

  console.log("=== SIMULATION: Generating December bill ===\n")
  console.log("Unpaid September bill: ₱3000 (3 months old, 2 months past grace)")
  console.log("Unpaid October bill: ₱2500 (2 months old, 1 month past grace)\n")

  // Simulating the billing generate route logic
  // For September bill when generating December bills:
  // billingMonth = Sept = 2025-09-01
  // currentMonth = Dec = 2025-12-01
  // monthsOverdue = (12-9) - 1 = 2
  // Interest applies since monthsOverdue >= 2

  // For October bill when generating December bills:
  // billingMonth = Oct = 2025-10-01
  // currentMonth = Dec = 2025-12-01
  // monthsOverdue = (12-10) - 1 = 1
  // NO interest since monthsOverdue < 2

  const bills = [
    { month: "September", principal: 3000, monthsOverdue: 2 },
    { month: "October", principal: 2500, monthsOverdue: 1 },
  ]

  let cumulativeInterest = 0
  let interestAppliedCount = 0

  for (const bill of bills) {
    console.log(`Processing ${bill.month} bill:`)
    console.log(`  Principal: ₱${bill.principal}`)
    console.log(`  Months overdue: ${bill.monthsOverdue}`)

    if (bill.monthsOverdue >= 2 && bill.principal > 0) {
      if (interestAppliedCount === 0) {
        // First bill with interest: simple 10%
        cumulativeInterest = bill.principal * penaltyRate
        console.log(`  First interest: ₱${bill.principal} × ${penaltyRate} = ₱${cumulativeInterest.toFixed(2)}`)
      } else {
        // Subsequent: compound formula
        const newInterest = (cumulativeInterest + bill.principal * penaltyRate) * (1 + penaltyRate)
        console.log(`  Compound: (${cumulativeInterest.toFixed(2)} + ${bill.principal} × ${penaltyRate}) × ${1 + penaltyRate}`)
        console.log(`  = (${cumulativeInterest.toFixed(2)} + ${(bill.principal * penaltyRate).toFixed(2)}) × ${1 + penaltyRate}`)
        console.log(`  = ${(cumulativeInterest + bill.principal * penaltyRate).toFixed(2)} × ${1 + penaltyRate}`)
        console.log(`  = ₱${newInterest.toFixed(2)}`)
        cumulativeInterest = newInterest
      }
      interestAppliedCount++
    } else {
      console.log(`  No interest (grace period, monthsOverdue = ${bill.monthsOverdue} < 2)`)
    }
    console.log()
  }

  console.log("=== RESULTS ===\n")
  console.log(`Total penalty on December bill: ₱${cumulativeInterest.toFixed(2)}`)
  console.log(`This should be ~10% of September's unpaid principal (₱3000)`)
  console.log(`Expected: ₱${(3000 * 0.1).toFixed(2)}`)
  console.log(`Match: ${Math.abs(cumulativeInterest - 3000 * 0.1) < 0.01 ? "YES ✓" : "NO ✗"}`)

  // Now check what's actually in the DB
  console.log("\n=== CHECKING ACTUAL DB DATA ===\n")

  const decBill = await prisma.bill.findFirst({
    where: { billingMonth: new Date(Date.UTC(2025, 11, 1)) }, // December 2025
    include: { unit: true },
  })

  if (decBill) {
    console.log(`Found December bill: ${decBill.billNumber}`)
    console.log(`Unit: ${decBill.unit.unitNumber}`)
    console.log(`Penalty: ₱${Number(decBill.penaltyAmount).toFixed(2)}`)
  } else {
    console.log("No December 2025 bills found")

    // Check what bills exist
    const allMonths = await prisma.bill.groupBy({
      by: ["billingMonth"],
      _count: { id: true },
      orderBy: { billingMonth: "asc" },
    })
    console.log("\nBilling months in database:")
    for (const m of allMonths) {
      console.log(`  ${m.billingMonth.toISOString().split("T")[0]}: ${m._count.id} bills`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
