const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-16' },
    include: { owner: true }
  })

  if (!unit) {
    console.log('Unit not found')
    return
  }

  console.log('=== UNIT M2-2F-16 ===')
  console.log('Owner:', unit.owner?.lastName, unit.owner?.firstName)

  console.log('\n=== PAYMENTS ===')
  const payments = await prisma.payment.findMany({
    where: { unitId: unit.id },
    orderBy: { paymentDate: 'desc' }
  })

  let totalPaid = 0
  for (const p of payments) {
    console.log(p.paymentDate.toISOString().slice(0,10), 'OR#' + p.orNumber, Number(p.totalAmount).toFixed(2))
    totalPaid += Number(p.totalAmount)
  }
  console.log('TOTAL PAID:', totalPaid.toFixed(2))

  console.log('\n=== BILLS ===')
  const bills = await prisma.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  let totalBilled = 0
  let totalBalance = 0
  for (const b of bills) {
    console.log(b.billingMonth.toISOString().slice(0,7), 'Total:', Number(b.totalAmount).toFixed(2), 'Paid:', Number(b.paidAmount).toFixed(2), 'Balance:', Number(b.balance).toFixed(2), b.status)
    totalBilled += Number(b.totalAmount)
    totalBalance += Number(b.balance)
  }
  console.log('TOTAL BILLED:', totalBilled.toFixed(2))
  console.log('TOTAL BALANCE:', totalBalance.toFixed(2))

  console.log('\n=== BILL-PAYMENT ALLOCATIONS ===')
  const billPayments = await prisma.billPayment.findMany({
    where: { payment: { unitId: unit.id } },
    include: {
      bill: { select: { billingMonth: true } },
      payment: { select: { orNumber: true } }
    }
  })

  if (billPayments.length === 0) {
    console.log('*** NO ALLOCATIONS FOUND - THIS IS THE BUG! ***')
  } else {
    for (const bp of billPayments) {
      console.log('OR#' + bp.payment.orNumber, '->', bp.bill.billingMonth.toISOString().slice(0,7), Number(bp.amount).toFixed(2))
    }
  }

  console.log('\n=== ADVANCE BALANCE ===')
  const advance = await prisma.unitAdvanceBalance.findFirst({
    where: { unitId: unit.id }
  })
  if (advance) {
    console.log('Advance Dues:', Number(advance.advanceDues).toFixed(2))
    console.log('Advance Util:', Number(advance.advanceUtilities).toFixed(2))
  } else {
    console.log('No advance balance')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
