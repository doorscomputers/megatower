const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function main() {
  const unit = await p.unit.findFirst({
    where: { unitNumber: 'M2-2F-5' },
    include: { owner: true }
  })

  console.log('=== UNIT M2-2F-5 ===')
  console.log('Owner:', unit.owner?.lastName, unit.owner?.firstName)
  console.log('Area:', Number(unit.area), 'sqm')

  console.log('\n=== ALL BILLS ===')
  const bills = await p.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  for (const b of bills) {
    console.log('\n' + b.billingMonth.toISOString().slice(0,7) + ':')
    console.log('  Electric:', Number(b.electricAmount).toFixed(2))
    console.log('  Water:', Number(b.waterAmount).toFixed(2))
    console.log('  Dues:', Number(b.associationDues).toFixed(2))
    console.log('  ParkingFee:', Number(b.parkingFee || 0).toFixed(2))
    console.log('  SP Assessment:', Number(b.spAssessment || 0).toFixed(2))
    console.log('  Other:', Number(b.otherCharges || 0).toFixed(2))
    console.log('  Discounts:', Number(b.discounts || 0).toFixed(2))
    console.log('  AdvanceDues:', Number(b.advanceDuesApplied || 0).toFixed(2))
    console.log('  AdvanceUtil:', Number(b.advanceUtilApplied || 0).toFixed(2))
    console.log('  Penalty:', Number(b.penaltyAmount).toFixed(2))
    console.log('  Total:', Number(b.totalAmount).toFixed(2))
    console.log('  Paid:', Number(b.paidAmount).toFixed(2))
    console.log('  Balance:', Number(b.balance).toFixed(2))
    console.log('  Status:', b.status)

    // Calculate principal
    const principal = Number(b.electricAmount) + Number(b.waterAmount) + Number(b.associationDues) +
                     Number(b.parkingFee || 0) + Number(b.spAssessment || 0) + Number(b.otherCharges || 0) -
                     Number(b.discounts || 0) - Number(b.advanceDuesApplied || 0) - Number(b.advanceUtilApplied || 0)
    console.log('  CALCULATED PRINCIPAL:', principal.toFixed(2))
  }

  console.log('\n=== PAYMENTS ===')
  const payments = await p.payment.findMany({
    where: { unitId: unit.id },
    orderBy: { paymentDate: 'asc' }
  })

  let totalPaid = 0
  for (const pay of payments) {
    console.log(pay.paymentDate.toISOString().slice(0,10), 'OR#' + pay.orNumber, Number(pay.totalAmount).toFixed(2))
    totalPaid += Number(pay.totalAmount)
  }
  console.log('TOTAL PAYMENTS:', totalPaid.toFixed(2))

  // Check bill-payment allocations
  console.log('\n=== BILL-PAYMENT ALLOCATIONS ===')
  const allocations = await p.billPayment.findMany({
    where: { payment: { unitId: unit.id } },
    include: {
      bill: { select: { billingMonth: true } },
      payment: { select: { orNumber: true } }
    }
  })

  for (const a of allocations) {
    console.log('OR#' + a.payment.orNumber, '->', a.bill.billingMonth.toISOString().slice(0,7), Number(a.totalAmount).toFixed(2))
  }

  await p.$disconnect()
}

main().catch(console.error)
