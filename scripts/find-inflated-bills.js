const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function findInflatedBills() {
  console.log('=== FINDING BILLS WITH INFLATED TOTALS ===\n')

  const bills = await p.bill.findMany({
    include: { unit: true },
    orderBy: [{ unit: { unitNumber: 'asc' } }, { billingMonth: 'asc' }]
  })

  let issueCount = 0

  for (const bill of bills) {
    // Calculate what the total SHOULD be
    const correctTotal = Number(bill.electricAmount) +
                        Number(bill.waterAmount) +
                        Number(bill.associationDues) +
                        Number(bill.parkingFee || 0) +
                        Number(bill.spAssessment || 0) +
                        Number(bill.otherCharges || 0) +
                        Number(bill.penaltyAmount || 0) -
                        Number(bill.discounts || 0) -
                        Number(bill.advanceDuesApplied || 0) -
                        Number(bill.advanceUtilApplied || 0)

    const storedTotal = Number(bill.totalAmount)
    const difference = storedTotal - correctTotal

    // If difference > ₱1, report it
    if (Math.abs(difference) > 1) {
      console.log(`${bill.unit.unitNumber} - ${bill.billingMonth.toISOString().slice(0,7)}:`)
      console.log(`  Stored total: ${storedTotal.toFixed(2)}`)
      console.log(`  Correct total: ${correctTotal.toFixed(2)}`)
      console.log(`  Difference: ${difference.toFixed(2)} (Previous Balance baked in?)`)
      console.log('')
      issueCount++
    }
  }

  console.log(`\n=== FOUND ${issueCount} BILLS WITH INFLATED TOTALS ===`)

  await p.$disconnect()
}

findInflatedBills().catch(console.error)
