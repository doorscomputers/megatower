import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Delete October 2025 Bills for 2nd Floor ===\n')

  // Get tenant
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found!')
    return
  }

  // Get all 2nd floor units
  const units = await prisma.unit.findMany({
    where: {
      tenantId: tenant.id,
      unitNumber: { contains: '2F' },
      isActive: true
    },
    select: { id: true, unitNumber: true }
  })

  console.log(`Found ${units.length} 2nd floor units`)
  const unitIds = units.map(u => u.id)

  // Find October bills
  const octBills = await prisma.bill.findMany({
    where: {
      unitId: { in: unitIds },
      billingMonth: {
        gte: new Date('2025-10-01'),
        lt: new Date('2025-11-01')
      }
    },
    include: {
      unit: { select: { unitNumber: true } }
    }
  })

  console.log(`Found ${octBills.length} October 2025 bills to delete\n`)

  if (octBills.length === 0) {
    console.log('No October bills to delete.')
    return
  }

  // Show what will be deleted
  console.log('Bills to delete:')
  octBills.forEach(b => {
    console.log(`- ${b.unit.unitNumber} | Total: ₱${Number(b.totalAmount).toFixed(2)} | Status: ${b.status}`)
  })

  // Delete in transaction
  console.log('\nDeleting...')

  await prisma.$transaction(async (tx) => {
    const billIds = octBills.map(b => b.id)

    // Delete any BillPayment allocations (shouldn't be any since unpaid)
    const deletedBP = await tx.billPayment.deleteMany({
      where: { billId: { in: billIds } }
    })
    if (deletedBP.count > 0) {
      console.log(`Deleted ${deletedBP.count} BillPayment records`)
    }

    // Delete the bills
    const deletedBills = await tx.bill.deleteMany({
      where: { id: { in: billIds } }
    })
    console.log(`Deleted ${deletedBills.count} Bill records`)
  })

  console.log('\n=== Delete Complete ===')
  console.log('You can now regenerate October bills in the Generate Bills page.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
