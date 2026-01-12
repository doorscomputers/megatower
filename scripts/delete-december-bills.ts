/**
 * Delete December 2025 bills to allow regeneration
 *
 * Usage: npx tsx scripts/delete-december-bills.ts
 */

import { PrismaClient } from '@prisma/client'
import { createBillingPeriod } from '../lib/timezone'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Deleting December 2025 Bills ===\n')

  const decemberPeriod = createBillingPeriod(2025, 12)
  console.log('Billing Period:', decemberPeriod.toISOString())

  // Find December bills (exclude opening balance bills)
  const decemberBills = await prisma.bill.findMany({
    where: {
      billingMonth: decemberPeriod,
      billType: { not: 'OPENING_BALANCE' }
    },
    include: {
      unit: { select: { unitNumber: true } }
    }
  })

  console.log(`Found ${decemberBills.length} December 2025 bills to delete`)

  if (decemberBills.length === 0) {
    console.log('No December bills to delete.')
    return
  }

  // Show which bills will be deleted
  console.log('\nBills to delete:')
  decemberBills.slice(0, 5).forEach(b => {
    console.log(`  ${b.unit?.unitNumber}: ${b.billNumber} - ₱${Number(b.totalAmount).toFixed(2)}`)
  })
  if (decemberBills.length > 5) {
    console.log(`  ... and ${decemberBills.length - 5} more`)
  }

  // Delete related records first
  const billIds = decemberBills.map(b => b.id)

  // Delete BillPayments
  const deletedBillPayments = await prisma.billPayment.deleteMany({
    where: { billId: { in: billIds } }
  })
  console.log(`\nDeleted ${deletedBillPayments.count} BillPayment records`)

  // Delete Penalties
  const deletedPenalties = await prisma.penalty.deleteMany({
    where: { billId: { in: billIds } }
  })
  console.log(`Deleted ${deletedPenalties.count} Penalty records`)

  // Delete Bills
  const deletedBills = await prisma.bill.deleteMany({
    where: { id: { in: billIds } }
  })
  console.log(`Deleted ${deletedBills.count} Bill records`)

  console.log('\n=== Done ===')
  console.log('You can now regenerate December 2025 bills.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
