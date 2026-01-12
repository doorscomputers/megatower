import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Cleanup September 2025 Payments for 2nd Floor ===\n')

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

  // Find all September 2025 payments for these units
  const septPayments = await prisma.payment.findMany({
    where: {
      unitId: { in: unitIds },
      paymentDate: {
        gte: new Date('2025-09-01'),
        lte: new Date('2025-09-30')
      }
    },
    include: {
      unit: { select: { unitNumber: true } },
      billPayments: true
    }
  })

  console.log(`Found ${septPayments.length} September 2025 payments to delete\n`)

  if (septPayments.length === 0) {
    console.log('No payments to clean up.')
    return
  }

  // Show what will be deleted
  console.log('Payments to delete:')
  septPayments.forEach(p => {
    console.log(`- ${p.unit.unitNumber} | OR# ${p.orNumber || 'N/A'} | ₱${p.totalAmount} | ${p.billPayments.length} allocations`)
  })

  // Start transaction
  console.log('\nDeleting...')

  await prisma.$transaction(async (tx) => {
    // 1. Delete BillPayment records first (due to foreign key)
    const billPaymentIds = septPayments.flatMap(p => p.billPayments.map(bp => bp.id))
    if (billPaymentIds.length > 0) {
      const deletedBP = await tx.billPayment.deleteMany({
        where: { id: { in: billPaymentIds } }
      })
      console.log(`Deleted ${deletedBP.count} BillPayment records`)
    }

    // 2. Delete Payment records
    const paymentIds = septPayments.map(p => p.id)
    const deletedPayments = await tx.payment.deleteMany({
      where: { id: { in: paymentIds } }
    })
    console.log(`Deleted ${deletedPayments.count} Payment records`)

    // 3. Get all bills for these units that might need resetting
    const bills = await tx.bill.findMany({
      where: {
        unitId: { in: unitIds },
        billingMonth: {
          gte: new Date('2025-08-01'),
          lte: new Date('2025-10-31')
        }
      }
    })

    // 4. Reset bill paidAmount and status
    for (const bill of bills) {
      // Recalculate paidAmount from remaining BillPayments
      const remainingAllocations = await tx.billPayment.findMany({
        where: { billId: bill.id }
      })

      const newPaidAmount = remainingAllocations.reduce(
        (sum, bp) => sum + Number(bp.totalAmount),
        0
      )

      const totalAmount = Number(bill.totalAmount)
      const newBalance = totalAmount - newPaidAmount
      let newStatus: 'PAID' | 'PARTIAL' | 'UNPAID'

      if (newPaidAmount >= totalAmount) {
        newStatus = 'PAID'
      } else if (newPaidAmount > 0) {
        newStatus = 'PARTIAL'
      } else {
        newStatus = 'UNPAID'
      }

      await tx.bill.update({
        where: { id: bill.id },
        data: {
          paidAmount: newPaidAmount,
          balance: Math.max(0, newBalance),
          status: newStatus
        }
      })
    }

    console.log(`Reset ${bills.length} bill records`)
  })

  console.log('\n=== Cleanup Complete ===')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
