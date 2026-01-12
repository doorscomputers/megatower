/**
 * Final status check for September and October billing
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(70))
  console.log('FINAL BILLING STATUS REPORT')
  console.log('='.repeat(70))

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found!')
    process.exit(1)
  }

  // September Bills Summary
  const septBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: {
        gte: new Date('2025-09-01'),
        lt: new Date('2025-10-01')
      }
    },
    include: {
      unit: { select: { unitNumber: true } },
      payments: true
    },
    orderBy: { unit: { unitNumber: 'asc' } }
  })

  console.log('\n' + '─'.repeat(70))
  console.log('SEPTEMBER 2025 BILLS')
  console.log('─'.repeat(70))
  console.log(`${'Unit'.padEnd(12)} ${'Bill#'.padEnd(18)} ${'Total'.padStart(12)} ${'Paid'.padStart(12)} ${'Balance'.padStart(12)} ${'Status'.padStart(10)}`)
  console.log('─'.repeat(70))

  let septTotal = 0
  let septPaid = 0

  for (const bill of septBills) {
    const total = Number(bill.totalAmount)
    const paid = Number(bill.paidAmount)
    const balance = Number(bill.balance)
    septTotal += total
    septPaid += paid

    console.log(
      `${bill.unit.unitNumber.padEnd(12)} ` +
      `${bill.billNumber.padEnd(18)} ` +
      `₱${total.toLocaleString().padStart(10)} ` +
      `₱${paid.toLocaleString().padStart(10)} ` +
      `₱${balance.toLocaleString().padStart(10)} ` +
      `${bill.status.padStart(10)}`
    )
  }

  console.log('─'.repeat(70))
  console.log(
    `${'TOTAL'.padEnd(12)} ${' '.padEnd(18)} ` +
    `₱${septTotal.toLocaleString().padStart(10)} ` +
    `₱${septPaid.toLocaleString().padStart(10)} ` +
    `₱${(septTotal - septPaid).toLocaleString().padStart(10)}`
  )

  // October Bills Summary
  const octBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: {
        gte: new Date('2025-10-01'),
        lt: new Date('2025-11-01')
      }
    },
    include: {
      unit: { select: { unitNumber: true } }
    },
    orderBy: { unit: { unitNumber: 'asc' } }
  })

  console.log('\n' + '─'.repeat(70))
  console.log('OCTOBER 2025 BILLS')
  console.log('─'.repeat(70))
  console.log(`${'Unit'.padEnd(12)} ${'Bill#'.padEnd(18)} ${'Electric'.padStart(10)} ${'Water'.padStart(8)} ${'Dues'.padStart(10)} ${'Prev Bal'.padStart(10)} ${'Total'.padStart(12)}`)
  console.log('─'.repeat(70))

  let octTotal = 0

  for (const bill of octBills) {
    const electric = Number(bill.electricAmount)
    const water = Number(bill.waterAmount)
    const dues = Number(bill.associationDues)
    const prevBal = Number(bill.penaltyAmount) // Previous balance/penalties
    const total = Number(bill.totalAmount)
    octTotal += total

    console.log(
      `${bill.unit.unitNumber.padEnd(12)} ` +
      `${bill.billNumber.padEnd(18)} ` +
      `₱${electric.toLocaleString().padStart(8)} ` +
      `₱${water.toLocaleString().padStart(6)} ` +
      `₱${dues.toLocaleString().padStart(8)} ` +
      `₱${prevBal.toLocaleString().padStart(8)} ` +
      `₱${total.toLocaleString().padStart(10)}`
    )
  }

  console.log('─'.repeat(70))
  console.log(
    `${'TOTAL'.padEnd(12)} ${' '.padEnd(18)} ` +
    `${' '.padStart(10)} ${' '.padStart(8)} ${' '.padStart(10)} ${' '.padStart(10)} ` +
    `₱${octTotal.toLocaleString().padStart(10)}`
  )

  // September Payments
  const septPayments = await prisma.payment.findMany({
    where: {
      tenantId: tenant.id,
      paymentDate: {
        gte: new Date('2025-09-01'),
        lt: new Date('2025-10-01')
      }
    },
    include: {
      unit: { select: { unitNumber: true } }
    },
    orderBy: { unit: { unitNumber: 'asc' } }
  })

  console.log('\n' + '─'.repeat(70))
  console.log('SEPTEMBER 2025 PAYMENTS')
  console.log('─'.repeat(70))
  console.log(`${'Unit'.padEnd(12)} ${'OR#'.padEnd(15)} ${'Electric'.padStart(10)} ${'Water'.padStart(8)} ${'Dues'.padStart(10)} ${'SP'.padStart(8)} ${'Total'.padStart(12)}`)
  console.log('─'.repeat(70))

  let payTotal = 0

  for (const payment of septPayments) {
    const electric = Number(payment.electricAmount)
    const water = Number(payment.waterAmount)
    const dues = Number(payment.duesAmount)
    const sp = Number(payment.spAssessmentAmount)
    const total = Number(payment.totalAmount)
    payTotal += total

    console.log(
      `${payment.unit.unitNumber.padEnd(12)} ` +
      `${(payment.orNumber || '').padEnd(15)} ` +
      `₱${electric.toLocaleString().padStart(8)} ` +
      `₱${water.toLocaleString().padStart(6)} ` +
      `₱${dues.toLocaleString().padStart(8)} ` +
      `₱${sp.toLocaleString().padStart(6)} ` +
      `₱${total.toLocaleString().padStart(10)}`
    )
  }

  console.log('─'.repeat(70))
  console.log(
    `${'TOTAL'.padEnd(12)} ${' '.padEnd(15)} ` +
    `${' '.padStart(10)} ${' '.padStart(8)} ${' '.padStart(10)} ${' '.padStart(8)} ` +
    `₱${payTotal.toLocaleString().padStart(10)}`
  )

  // Summary
  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`
September 2025:
  - Bills Generated: ${septBills.length}
  - Total Billed: ₱${septTotal.toLocaleString()}
  - Total Paid: ₱${septPaid.toLocaleString()}
  - Outstanding: ₱${(septTotal - septPaid).toLocaleString()}
  - Payments: ${septPayments.length} (₱${payTotal.toLocaleString()})

October 2025:
  - Bills Generated: ${octBills.length}
  - Total Billed: ₱${octTotal.toLocaleString()}
  - (Includes any unpaid September balances + penalties)
`)

  console.log('='.repeat(70))
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
