/**
 * Test penalty calculation with real unit data
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("\n=== Penalty Calculation Test ===\n")

  // Get tenant settings
  const tenant = await prisma.tenant.findFirst({
    include: { settings: true },
  })

  if (!tenant?.settings) {
    console.log("No tenant settings found!")
    return
  }

  const penaltyRate = Number(tenant.settings.penaltyRate)
  console.log(`Penalty Rate: ${penaltyRate} (${penaltyRate * 100}%)\n`)

  // Find a unit with unpaid bills
  const unit = await prisma.unit.findFirst({
    where: { unitNumber: "M2-GF-16" },
  })

  if (!unit) {
    console.log("Unit not found!")
    return
  }

  // Simulate billing for January 2026
  const billingPeriod = new Date(Date.UTC(2026, 0, 1)) // January 2026
  console.log(`Simulating billing for: ${billingPeriod.toISOString().split("T")[0]}`)

  // Get all unpaid bills for this unit
  const previousBills = await prisma.bill.findMany({
    where: {
      unitId: unit.id,
      status: { in: ["UNPAID", "PARTIAL"] },
    },
    orderBy: { billingMonth: "asc" },
  })

  console.log(`\nFound ${previousBills.length} unpaid bills:\n`)

  let previousBalance = 0
  let cumulativeInterest = 0
  let interestAppliedCount = 0

  for (const prevBill of previousBills) {
    const billMonth = prevBill.billingMonth
    const monthsOverdue =
      (billingPeriod.getFullYear() - billMonth.getFullYear()) * 12 +
      (billingPeriod.getMonth() - billMonth.getMonth()) - 1

    const unpaidBalance = Math.max(0, Number(prevBill.balance))
    previousBalance += unpaidBalance

    // Calculate unpaid principal (bill total minus penalty already included)
    const billPrincipal = Number(prevBill.totalAmount) - Number(prevBill.penaltyAmount)
    const paidAmount = Number(prevBill.paidAmount)
    const totalWithPenalty = Number(prevBill.totalAmount)
    const unpaidRatio =
      totalWithPenalty > 0 ? Math.max(0, totalWithPenalty - paidAmount) / totalWithPenalty : 1
    const unpaidPrincipal = billPrincipal * unpaidRatio

    console.log(`Bill: ${prevBill.billNumber}`)
    console.log(`  Billing Month: ${billMonth.toISOString().split("T")[0]}`)
    console.log(`  Months Overdue: ${monthsOverdue}`)
    console.log(`  Balance: ₱${unpaidBalance.toFixed(2)}`)
    console.log(`  Bill Principal (total - penalty): ₱${billPrincipal.toFixed(2)}`)
    console.log(`  Unpaid Principal: ₱${unpaidPrincipal.toFixed(2)}`)

    if (monthsOverdue >= 2 && unpaidPrincipal > 0) {
      if (interestAppliedCount === 0) {
        cumulativeInterest = unpaidPrincipal * penaltyRate
        console.log(`  → Interest (first): ₱${cumulativeInterest.toFixed(2)} = ${unpaidPrincipal.toFixed(2)} × ${penaltyRate}`)
      } else {
        const prevInterest = cumulativeInterest
        cumulativeInterest = (cumulativeInterest + unpaidPrincipal * penaltyRate) * (1 + penaltyRate)
        console.log(`  → Interest (compound): ₱${cumulativeInterest.toFixed(2)} = (${prevInterest.toFixed(2)} + ${(unpaidPrincipal * penaltyRate).toFixed(2)}) × 1.1`)
      }
      interestAppliedCount++
    } else {
      console.log(`  → NO interest (monthsOverdue=${monthsOverdue} < 2)`)
    }
    console.log("")
  }

  console.log("=== Result ===")
  console.log(`Previous Balance Sum: ₱${previousBalance.toFixed(2)}`)
  console.log(`Total Penalty: ₱${cumulativeInterest.toFixed(2)}`)
  console.log(`Interest Applied to ${interestAppliedCount} bill(s)`)

  // Compare with what the current penalty calculation SHOULD produce
  console.log("\n=== Expected Penalty Calculation ===")
  console.log("Based on Ma'am Rose's formula:")
  console.log("- September bill (2 months overdue from Nov): Principal × 10%")
  console.log("- October bill (1 month overdue from Nov): NO interest (grace period)")

  // September bill is 2 months from November
  const septBill = previousBills.find((b) => b.billingMonth.getMonth() === 8)
  if (septBill) {
    const septPrincipal = Number(septBill.totalAmount) - Number(septBill.penaltyAmount)
    console.log(`\nSeptember Principal: ₱${septPrincipal.toFixed(2)}`)
    console.log(`Expected Interest: ₱${(septPrincipal * penaltyRate).toFixed(2)} (${septPrincipal.toFixed(2)} × 10%)`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
