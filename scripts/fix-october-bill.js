const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function fixBill(unitNumber) {
  console.log(`Fixing October bill for ${unitNumber}...`)

  const unit = await p.unit.findFirst({ where: { unitNumber } })
  if (!unit) {
    console.log('Unit not found!')
    return
  }

  // Get October 2025 bill
  const bill = await p.bill.findFirst({
    where: {
      unitId: unit.id,
      billingMonth: new Date('2025-10-01')
    }
  })

  if (!bill) {
    console.log('October bill not found!')
    return
  }

  // Calculate correct total (without previous balance baked in)
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

  console.log('Current total:', Number(bill.totalAmount).toFixed(2))
  console.log('Correct total:', correctTotal.toFixed(2))
  console.log('Current paid:', Number(bill.paidAmount).toFixed(2))

  // Calculate new balance
  const newBalance = correctTotal - Number(bill.paidAmount)
  const newStatus = newBalance <= 0.01 ? 'PAID' : (Number(bill.paidAmount) > 0 ? 'PARTIAL' : 'UNPAID')

  console.log('New balance:', newBalance.toFixed(2))
  console.log('New status:', newStatus)

  // Update the bill
  await p.bill.update({
    where: { id: bill.id },
    data: {
      totalAmount: correctTotal,
      balance: Math.max(0, newBalance),
      status: newStatus
    }
  })

  console.log('\nBill fixed!')

  await p.$disconnect()
}

const unit = process.argv[2] || 'M2-2F-16'
fixBill(unit).catch(console.error)
