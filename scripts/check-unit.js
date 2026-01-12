const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function checkUnit(unitNumber) {
  console.log('='.repeat(70))
  console.log(`CHECKING: ${unitNumber}`)
  console.log('='.repeat(70))

  const unit = await p.unit.findFirst({
    where: { unitNumber },
    include: { owner: true }
  })

  if (!unit) {
    console.log('Unit not found!')
    return
  }

  console.log('Owner:', unit.owner?.lastName, unit.owner?.firstName)

  console.log('\n=== ALL BILLS ===')
  const bills = await p.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  let totalBilled = 0
  let totalBalance = 0
  for (const b of bills) {
    console.log(b.billingMonth.toISOString().slice(0,7),
      '| Total:', Number(b.totalAmount).toFixed(2).padStart(10),
      '| Paid:', Number(b.paidAmount).toFixed(2).padStart(10),
      '| Balance:', Number(b.balance).toFixed(2).padStart(10),
      '|', b.status)
    totalBilled += Number(b.totalAmount)
    totalBalance += Number(b.balance)
  }
  console.log('TOTAL BILLED:', totalBilled.toFixed(2))
  console.log('TOTAL BALANCE:', totalBalance.toFixed(2))

  console.log('\n=== ALL PAYMENTS ===')
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

  console.log('\n=== BILL-PAYMENT ALLOCATIONS ===')
  const allocations = await p.billPayment.findMany({
    where: { payment: { unitId: unit.id } },
    include: {
      bill: { select: { billingMonth: true } },
      payment: { select: { orNumber: true, paymentDate: true } }
    },
    orderBy: { bill: { billingMonth: 'asc' } }
  })

  let totalAllocated = 0
  for (const a of allocations) {
    console.log('OR#' + a.payment.orNumber, '->', a.bill.billingMonth.toISOString().slice(0,7), Number(a.totalAmount).toFixed(2))
    totalAllocated += Number(a.totalAmount)
  }
  console.log('TOTAL ALLOCATED:', totalAllocated.toFixed(2))

  if (allocations.length === 0) {
    console.log('*** NO ALLOCATIONS - PAYMENTS NOT LINKED TO BILLS! ***')
  }

  await p.$disconnect()
}

const unitToCheck = process.argv[2] || 'M2-2F-16'
checkUnit(unitToCheck).catch(console.error)
