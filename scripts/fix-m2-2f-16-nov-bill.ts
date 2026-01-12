/**
 * Fix M2-2F-16 November bill balance
 * Current: ₱2,130.00
 * Should be: ₱2,160.00 (dues only, Electric and Water were paid)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const novPeriod = new Date('2025-11-01T00:00:00.000Z')

  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-16' }
  })

  if (!unit) return

  const novBill = await prisma.bill.findFirst({
    where: { unitId: unit.id, billingMonth: novPeriod }
  })

  if (!novBill) {
    console.log('November bill not found')
    return
  }

  console.log('Before fix:')
  console.log(`  Total: ₱${Number(novBill.totalAmount).toFixed(2)}`)
  console.log(`  Paid: ₱${Number(novBill.paidAmount).toFixed(2)}`)
  console.log(`  Balance: ₱${Number(novBill.balance).toFixed(2)}`)

  // The correct total should be: Electric + Water + Dues
  // ₱570.52 + ₱200.00 + ₱2,160.00 = ₱2,930.52
  // Paid: ₱770.52 (Electric + Water)
  // Balance should be: ₱2,160.00 (Dues unpaid)
  const correctTotal = 570.52 + 200.00 + 2160.00 // ₱2,930.52
  const correctPaid = 570.52 + 200.00 // ₱770.52
  const correctBalance = 2160.00 // Dues only

  await prisma.bill.update({
    where: { id: novBill.id },
    data: {
      totalAmount: correctTotal,
      paidAmount: correctPaid,
      balance: correctBalance
    }
  })

  console.log('\nAfter fix:')
  console.log(`  Total: ₱${correctTotal.toFixed(2)}`)
  console.log(`  Paid: ₱${correctPaid.toFixed(2)}`)
  console.log(`  Balance: ₱${correctBalance.toFixed(2)}`)
  console.log('\nNow December SOA will show:')
  console.log('  Past Dues Base: ₱2,160.00')
  console.log('  + 10% Penalty: ₱216.00')
  console.log('  = Total Past Dues: ₱2,376.00')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
