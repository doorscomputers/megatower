import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("\n=== Penalty Debug Analysis ===\n")

  // Get tenant settings
  const settings = await prisma.tenantSettings.findFirst()
  const penaltyRate = Number(settings?.penaltyRate) || 0.1
  console.log(`Penalty Rate: ${penaltyRate} (${penaltyRate * 100}%)\n`)

  // Find a unit with penalty and trace the calculation
  const billWithPenalty = await prisma.bill.findFirst({
    where: { penaltyAmount: { gt: 0 } },
    include: { unit: { select: { id: true, unitNumber: true } } },
    orderBy: { billingMonth: "desc" },
  })

  if (!billWithPenalty) {
    console.log("No bills with penalties found!")
    return
  }

  console.log("=== Bill with Penalty ===")
  console.log(`Bill: ${billWithPenalty.billNumber}`)
  console.log(`Unit: ${billWithPenalty.unit.unitNumber}`)
  console.log(`Billing Month: ${billWithPenalty.billingMonth.toISOString().split("T")[0]}`)
  console.log(`Total: ₱${Number(billWithPenalty.totalAmount).toFixed(2)}`)
  console.log(`Penalty: ₱${Number(billWithPenalty.penaltyAmount).toFixed(2)}`)

  // Get ALL bills for this unit (not just unpaid)
  const allBills = await prisma.bill.findMany({
    where: { unitId: billWithPenalty.unit.id },
    orderBy: { billingMonth: "asc" },
  })

  console.log("\n=== All Bills for Unit (Ordered by Date) ===")
  const currentMonth = billWithPenalty.billingMonth

  for (const bill of allBills) {
    const monthsOverdue =
      (currentMonth.getFullYear() - bill.billingMonth.getFullYear()) * 12 +
      (currentMonth.getMonth() - bill.billingMonth.getMonth()) - 1

    const billPrincipal = Number(bill.totalAmount) - Number(bill.penaltyAmount)
    const paidAmount = Number(bill.paidAmount)
    const totalWithPenalty = Number(bill.totalAmount)
    const unpaidRatio = totalWithPenalty > 0 ? Math.max(0, totalWithPenalty - paidAmount) / totalWithPenalty : 1
    const unpaidPrincipal = billPrincipal * unpaidRatio

    const wouldGetInterest = monthsOverdue >= 2 && unpaidPrincipal > 0

    console.log(
      `  ${bill.billNumber} | ${bill.billingMonth.toISOString().split("T")[0]} | Status: ${bill.status} | ` +
      `Balance: ₱${Number(bill.balance).toFixed(2)} | MonthsOverdue: ${monthsOverdue} | ` +
      `UnpaidPrincipal: ₱${unpaidPrincipal.toFixed(2)} | Interest?: ${wouldGetInterest ? "YES" : "NO"}`
    )

    if (wouldGetInterest) {
      const interest = unpaidPrincipal * penaltyRate
      console.log(`    → Expected Interest: ₱${interest.toFixed(2)}`)
    }
  }

  // Simulate the penalty calculation
  console.log("\n=== Simulated Penalty Calculation ===")

  const previousBills = allBills.filter(
    (b) =>
      b.billingMonth < billWithPenalty.billingMonth &&
      (b.status === "UNPAID" || b.status === "PARTIAL")
  )

  console.log(`Previous unpaid bills count: ${previousBills.length}`)

  let cumulativeInterest = 0
  let interestAppliedCount = 0

  for (const prevBill of previousBills) {
    const billMonth = prevBill.billingMonth
    const monthsOverdue =
      (currentMonth.getFullYear() - billMonth.getFullYear()) * 12 +
      (currentMonth.getMonth() - billMonth.getMonth()) - 1

    const billPrincipal = Number(prevBill.totalAmount) - Number(prevBill.penaltyAmount)
    const paidAmount = Number(prevBill.paidAmount)
    const totalWithPenalty = Number(prevBill.totalAmount)
    const unpaidRatio = totalWithPenalty > 0 ? Math.max(0, totalWithPenalty - paidAmount) / totalWithPenalty : 1
    const unpaidPrincipal = billPrincipal * unpaidRatio

    console.log(`\n  Processing: ${prevBill.billNumber}`)
    console.log(`    MonthsOverdue: ${monthsOverdue}`)
    console.log(`    UnpaidPrincipal: ₱${unpaidPrincipal.toFixed(2)}`)

    if (monthsOverdue >= 2 && unpaidPrincipal > 0) {
      if (interestAppliedCount === 0) {
        cumulativeInterest = unpaidPrincipal * penaltyRate
        console.log(`    → First interest: ₱${cumulativeInterest.toFixed(2)} (simple 10%)`)
      } else {
        cumulativeInterest = (cumulativeInterest + unpaidPrincipal * penaltyRate) * (1 + penaltyRate)
        console.log(`    → Compound interest: ₱${cumulativeInterest.toFixed(2)}`)
      }
      interestAppliedCount++
    } else {
      console.log(`    → NO interest (monthsOverdue < 2 or no unpaid principal)`)
    }
  }

  console.log(`\n=== Result ===`)
  console.log(`Calculated Total Penalty: ₱${cumulativeInterest.toFixed(2)}`)
  console.log(`Actual Bill Penalty: ₱${Number(billWithPenalty.penaltyAmount).toFixed(2)}`)
  console.log(`Match: ${Math.abs(cumulativeInterest - Number(billWithPenalty.penaltyAmount)) < 0.01 ? "YES ✓" : "NO ✗"}`)

  // Check if there was any opening balance
  console.log("\n=== Check Opening Balance ===")
  const openingBalances = await prisma.openingBalance.findMany({
    where: { unitId: billWithPenalty.unit.id },
  })

  for (const ob of openingBalances) {
    console.log(`  Opening Balance: ₱${Number(ob.balance).toFixed(2)} for ${ob.billingMonth.toISOString().split("T")[0]}`)
  }
  if (openingBalances.length === 0) {
    console.log("  No opening balances found.")
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
