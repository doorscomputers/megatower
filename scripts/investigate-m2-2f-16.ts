import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function investigate() {
  // Get the unit
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

  // Get all payments for this unit
  console.log('\n=== PAYMENTS ===')
  const payments = await prisma.payment.findMany({
    where: { unitId: unit.id },
    orderBy: { paymentDate: 'desc' }
  })

  let totalPaid = 0
  for (const p of payments) {
    console.log(`${p.paymentDate.toISOString().slice(0,10)}: OR#${p.orNumber} - ₱${Number(p.totalAmount).toFixed(2)}`)
    totalPaid += Number(p.totalAmount)
  }
  console.log(`TOTAL PAID: ₱${totalPaid.toFixed(2)}`)

  // Get all bills for this unit
  console.log('\n=== BILLS ===')
  const bills = await prisma.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  let totalBilled = 0
  let totalBalance = 0
  for (const b of bills) {
    const month = b.billingMonth.toISOString().slice(0,7)
    console.log(`${month}: Total=₱${Number(b.totalAmount).toFixed(2)}, Paid=₱${Number(b.paidAmount).toFixed(2)}, Balance=₱${Number(b.balance).toFixed(2)}, Status=${b.status}`)
    totalBilled += Number(b.totalAmount)
    totalBalance += Number(b.balance)
  }
  console.log(`TOTAL BILLED: ₱${totalBilled.toFixed(2)}`)
  console.log(`TOTAL BALANCE: ₱${totalBalance.toFixed(2)}`)

  // Check BillPayment allocations
  console.log('\n=== BILL-PAYMENT ALLOCATIONS ===')
  const billPayments = await prisma.billPayment.findMany({
    where: {
      payment: { unitId: unit.id }
    },
    include: {
      bill: { select: { billingMonth: true, billNumber: true } },
      payment: { select: { orNumber: true, paymentDate: true } }
    }
  })

  if (billPayments.length === 0) {
    console.log('NO BILL-PAYMENT ALLOCATIONS FOUND!')
    console.log('This is the bug - payments exist but are not linked to bills!')
  } else {
    for (const bp of billPayments) {
      const billMonth = bp.bill.billingMonth.toISOString().slice(0,7)
      console.log(`OR#${bp.payment.orNumber} -> Bill ${billMonth}: ₱${Number(bp.amount).toFixed(2)}`)
    }
  }

  // Check UnitAdvanceBalance
  console.log('\n=== ADVANCE BALANCE ===')
  const advance = await prisma.unitAdvanceBalance.findFirst({
    where: { unitId: unit.id }
  })
  if (advance) {
    console.log(`Advance Dues: ₱${Number(advance.advanceDues).toFixed(2)}`)
    console.log(`Advance Utilities: ₱${Number(advance.advanceUtilities).toFixed(2)}`)
  } else {
    console.log('No advance balance record')
  }
}

investigate()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
