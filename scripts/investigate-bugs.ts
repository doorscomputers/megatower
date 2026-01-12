import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("\n=== INVESTIGATING BILL BALANCE BUGS ===\n")

  // Get the problematic bills
  const bills = await prisma.bill.findMany({
    where: { billNumber: { in: ["MT-202510-0043", "MT-202510-0052"] } },
    include: {
      unit: true,
      payments: {
        include: {
          payment: true,
        },
      },
    },
  })

  for (const b of bills) {
    console.log("=" .repeat(50))
    console.log(`Bill: ${b.billNumber}`)
    console.log(`Unit: ${b.unit.unitNumber}`)
    console.log(``)
    console.log(`  Total Amount:    ₱${Number(b.totalAmount).toFixed(2)}`)
    console.log(`  Paid Amount:     ₱${Number(b.paidAmount).toFixed(2)}`)
    console.log(`  Balance:         ₱${Number(b.balance).toFixed(2)}`)
    console.log(`  Expected:        ₱${(Number(b.totalAmount) - Number(b.paidAmount)).toFixed(2)}`)
    console.log(`  Status:          ${b.status}`)
    console.log(``)
    console.log(`  Payments Applied: ${b.payments.length}`)

    let totalFromPayments = 0
    for (const bp of b.payments) {
      totalFromPayments += Number(bp.totalAmount)
      console.log(`    - BillPayment: ₱${Number(bp.totalAmount).toFixed(2)} (from OR# ${bp.payment.orNumber})`)
      console.log(`      Electric: ₱${Number(bp.electricAmount).toFixed(2)}`)
      console.log(`      Water: ₱${Number(bp.waterAmount).toFixed(2)}`)
      console.log(`      Dues: ₱${Number(bp.duesAmount).toFixed(2)}`)
      console.log(`      Penalty: ₱${Number(bp.penaltyAmount).toFixed(2)}`)
    }

    console.log(``)
    console.log(`  Sum from BillPayments: ₱${totalFromPayments.toFixed(2)}`)
    console.log(`  Bill.paidAmount:       ₱${Number(b.paidAmount).toFixed(2)}`)
    console.log(``)

    // Check if this is overpayment
    const overpayment = Number(b.paidAmount) - Number(b.totalAmount)
    if (overpayment > 0) {
      console.log(`  ⚠️ OVERPAYMENT: ₱${overpayment.toFixed(2)}`)
      console.log(`  This should have been stored in UnitAdvanceBalance!`)
    }
  }

  // Check advance balances for these units
  console.log("\n=== CHECKING ADVANCE BALANCES ===\n")
  const unitIds = bills.map((b) => b.unitId)
  const advanceBalances = await prisma.unitAdvanceBalance.findMany({
    where: { unitId: { in: unitIds } },
    include: { unit: true },
  })

  if (advanceBalances.length === 0) {
    console.log("No advance balances found for these units")
  } else {
    for (const ab of advanceBalances) {
      console.log(`Unit: ${ab.unit.unitNumber}`)
      console.log(`  Advance Dues: ₱${Number(ab.advanceDues).toFixed(2)}`)
      console.log(`  Advance Utilities: ₱${Number(ab.advanceUtilities).toFixed(2)}`)
    }
  }

  console.log("\n=== PENALTY ISSUE INVESTIGATION ===\n")

  // Get a sample of bills with small penalties
  const billsWithSmallPenalty = await prisma.bill.findMany({
    where: { penaltyAmount: { gt: 0, lt: 10 } },
    include: { unit: true },
    take: 5,
  })

  console.log("Sample bills with very small penalties:\n")
  for (const b of billsWithSmallPenalty) {
    const principalEstimate = Number(b.totalAmount) - Number(b.penaltyAmount)
    const expectedPenalty = principalEstimate * 0.10
    console.log(`${b.unit.unitNumber} ${b.billNumber}`)
    console.log(`  Billing Month: ${b.billingMonth.toISOString().split("T")[0]}`)
    console.log(`  Total: ₱${Number(b.totalAmount).toFixed(2)}`)
    console.log(`  Penalty: ₱${Number(b.penaltyAmount).toFixed(2)}`)
    console.log(`  If 10% penalty on principal: ₱${expectedPenalty.toFixed(2)}`)
    console.log(`  Penalty is ${((Number(b.penaltyAmount) / principalEstimate) * 100).toFixed(3)}% of principal`)
    console.log(``)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
