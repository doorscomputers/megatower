const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function fixAllBills() {
  console.log('=== FIXING ALL BILL TOTALS ===\n')

  const bills = await p.bill.findMany({
    include: { unit: true },
    orderBy: [{ unit: { unitNumber: 'asc' } }, { billingMonth: 'asc' }]
  })

  let fixedCount = 0

  for (const bill of bills) {
    // Calculate what the total SHOULD be (sum of components)
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
    const difference = Math.abs(storedTotal - correctTotal)

    // If difference > ₱1, fix it
    if (difference > 1) {
      const paidAmount = Number(bill.paidAmount)
      const newBalance = correctTotal - paidAmount
      const newStatus = newBalance <= 0.01 ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'UNPAID')

      console.log(`${bill.unit.unitNumber} - ${bill.billingMonth.toISOString().slice(0,7)}:`)
      console.log(`  Fixing: ${storedTotal.toFixed(2)} -> ${correctTotal.toFixed(2)}`)
      console.log(`  Balance: ${newBalance.toFixed(2)}, Status: ${newStatus}`)

      await p.bill.update({
        where: { id: bill.id },
        data: {
          totalAmount: correctTotal,
          balance: Math.max(0, newBalance),
          status: newStatus
        }
      })

      fixedCount++
    }
  }

  console.log(`\n=== FIXED ${fixedCount} BILLS ===`)

  await p.$disconnect()
}

fixAllBills().catch(console.error)
