import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Fixing September 2025 Bill Balances ===\n')

  // Get all September 2025 bills for 2F units that are PAID but have balance
  const septBills = await prisma.bill.findMany({
    where: {
      billingMonth: new Date('2025-09-01'),
      unit: { unitNumber: { startsWith: 'M2-2F' } },
      status: 'PAID',
      balance: { gt: 0 }
    },
    include: { unit: { select: { unitNumber: true } } },
    orderBy: { unit: { unitNumber: 'asc' } }
  })

  console.log(`Found ${septBills.length} September bills to fix\n`)

  for (const bill of septBills) {
    // If PAID and paidAmount >= totalAmount, balance should be 0
    if (Number(bill.paidAmount) >= Number(bill.totalAmount)) {
      await prisma.bill.update({
        where: { id: bill.id },
        data: { balance: 0 }
      })
      console.log(`${bill.unit.unitNumber}: Fixed balance 0 (was ₱${Number(bill.balance).toFixed(2)})`)
    }
  }

  // Also fix M2-2F-5 which we set to PARTIAL with 28.73 balance
  // Let me verify this is correct

  console.log('\n=== Verification ===')
  const allSeptBills = await prisma.bill.findMany({
    where: {
      billingMonth: new Date('2025-09-01'),
      unit: { unitNumber: { startsWith: 'M2-2F' } }
    },
    include: { unit: { select: { unitNumber: true } } },
    orderBy: { unit: { unitNumber: 'asc' } }
  })

  for (const b of allSeptBills) {
    console.log(`${b.unit.unitNumber}: Total=₱${Number(b.totalAmount).toFixed(2)}, Paid=₱${Number(b.paidAmount).toFixed(2)}, Balance=₱${Number(b.balance).toFixed(2)}, Status=${b.status}`)
  }

  console.log('\n=== Fix Complete ===')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
