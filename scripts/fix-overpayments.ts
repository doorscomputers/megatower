import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixUnit(unitNumber: string) {
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) return

  const unit = await prisma.unit.findFirst({
    where: { unitNumber, tenantId: tenant.id }
  })
  if (!unit) {
    console.log(`Unit ${unitNumber} not found`)
    return
  }

  console.log(`\n=== Fixing ${unitNumber} ===`)

  // Get all bills for this unit
  const bills = await prisma.bill.findMany({
    where: { unitId: unit.id },
    orderBy: { billingMonth: 'asc' }
  })

  // Get all payments
  const payments = await prisma.payment.findMany({
    where: { unitId: unit.id },
    orderBy: { paymentDate: 'asc' }
  })

  console.log('\nBills:')
  for (const b of bills) {
    const month = b.billingMonth.toISOString().slice(0,7)
    console.log(`  ${month}: Total=${b.totalAmount}, Paid=${b.paidAmount}, Balance=${b.balance}, Status=${b.status}`)
  }

  console.log('\nPayments:')
  let totalPaid = 0
  for (const p of payments) {
    console.log(`  ${p.paymentDate.toISOString().slice(0,10)}: ₱${p.totalAmount}`)
    totalPaid += Number(p.totalAmount)
  }

  let totalBilled = 0
  for (const b of bills) {
    totalBilled += Number(b.totalAmount)
  }

  console.log(`\nTotal Billed: ₱${totalBilled.toFixed(2)}`)
  console.log(`Total Paid: ₱${totalPaid.toFixed(2)}`)
  console.log(`Difference: ₱${(totalPaid - totalBilled).toFixed(2)}`)

  // Fix the balances
  // Sept bill should be marked PAID with balance 0 if overpaid
  const septBill = bills.find(b => b.billingMonth.toISOString().startsWith('2025-09'))
  const octBill = bills.find(b => b.billingMonth.toISOString().startsWith('2025-10'))
  const augBill = bills.find(b => b.billingMonth.toISOString().startsWith('2025-08'))

  if (septBill && Number(septBill.paidAmount) >= Number(septBill.totalAmount)) {
    // Sept is fully paid
    await prisma.bill.update({
      where: { id: septBill.id },
      data: { balance: 0, status: 'PAID' }
    })
    console.log(`\nFixed Sept: Balance=0, Status=PAID`)

    // Calculate overpayment from Sept
    const septOverpay = Number(septBill.paidAmount) - Number(septBill.totalAmount)

    if (octBill && septOverpay > 0) {
      // Apply overpayment to October
      const octTotal = Number(octBill.totalAmount)
      const currentOctPaid = Number(octBill.paidAmount)
      const newOctPaid = currentOctPaid + septOverpay
      const newOctBalance = Math.max(0, octTotal - newOctPaid)
      const newOctStatus = newOctBalance <= 0 ? 'PAID' : (newOctPaid > 0 ? 'PARTIAL' : 'UNPAID')

      await prisma.bill.update({
        where: { id: octBill.id },
        data: {
          paidAmount: Math.min(newOctPaid, octTotal),
          balance: newOctBalance,
          status: newOctStatus
        }
      })
      console.log(`Fixed Oct: Paid=${Math.min(newOctPaid, octTotal).toFixed(2)}, Balance=${newOctBalance.toFixed(2)}, Status=${newOctStatus}`)
    }
  }

  // Also check if Aug bill exists and needs attention
  if (augBill) {
    console.log(`\nAug bill exists: Total=${augBill.totalAmount}, Paid=${augBill.paidAmount}, Balance=${augBill.balance}, Status=${augBill.status}`)
  }
}

async function main() {
  console.log('=== Fixing Overpayment Issues ===')

  await fixUnit('M2-2F-16')
  await fixUnit('M2-2F-17')

  // Verify final state
  console.log('\n\n=== Final Verification ===')

  const tenant = await prisma.tenant.findFirst()
  const bills = await prisma.bill.findMany({
    where: {
      billingMonth: { lte: new Date('2025-10-01') },
      unit: { unitNumber: { in: ['M2-2F-16', 'M2-2F-17'] } },
      balance: { not: 0 }
    },
    include: { unit: { select: { unitNumber: true } } },
    orderBy: [{ unit: { unitNumber: 'asc' } }, { billingMonth: 'asc' }]
  })

  if (bills.length === 0) {
    console.log('All bills fully paid!')
  } else {
    for (const b of bills) {
      console.log(`${b.unit.unitNumber} ${b.billingMonth.toISOString().slice(0,7)}: Balance=₱${Number(b.balance).toFixed(2)}, Status=${b.status}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
