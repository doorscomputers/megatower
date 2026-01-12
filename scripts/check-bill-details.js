const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function checkBill(unitNumber, month) {
  const unit = await p.unit.findFirst({ where: { unitNumber } })
  if (!unit) {
    console.log('Unit not found!')
    return
  }

  const bills = await p.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  console.log(`=== BILLS FOR ${unitNumber} ===\n`)
  for (const b of bills) {
    console.log('Month:', b.billingMonth.toISOString().slice(0,7))
    console.log('  Electric:', Number(b.electricAmount).toFixed(2))
    console.log('  Water:', Number(b.waterAmount).toFixed(2))
    console.log('  Dues:', Number(b.associationDues).toFixed(2))
    console.log('  Parking:', Number(b.parkingFee || 0).toFixed(2))
    console.log('  SP Assessment:', Number(b.spAssessment || 0).toFixed(2))
    console.log('  Other:', Number(b.otherCharges || 0).toFixed(2))
    console.log('  Penalty:', Number(b.penaltyAmount || 0).toFixed(2))
    console.log('  Discounts:', Number(b.discounts || 0).toFixed(2))
    console.log('  AdvanceDues:', Number(b.advanceDuesApplied || 0).toFixed(2))
    console.log('  AdvanceUtil:', Number(b.advanceUtilApplied || 0).toFixed(2))
    console.log('  ---')
    console.log('  TOTAL:', Number(b.totalAmount).toFixed(2))
    console.log('  Paid:', Number(b.paidAmount).toFixed(2))
    console.log('  Balance:', Number(b.balance).toFixed(2))
    console.log('  Status:', b.status)
    console.log('')
  }

  await p.$disconnect()
}

const unit = process.argv[2] || 'M2-2F-16'
checkBill(unit).catch(console.error)
