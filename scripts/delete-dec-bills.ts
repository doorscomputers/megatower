/**
 * Delete December 2025 bills so they can be regenerated correctly
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const decPeriod = new Date('2025-12-01T00:00:00.000Z')

  console.log('=== Deleting December 2025 Bills ===\n')

  // Check for bills with payments
  const billsWithPayments = await prisma.bill.findMany({
    where: {
      billingMonth: decPeriod,
      paidAmount: { gt: 0 }
    }
  })

  if (billsWithPayments.length > 0) {
    console.log(`WARNING: ${billsWithPayments.length} bills have payments and cannot be deleted`)
    return
  }

  // Count before deletion
  const count = await prisma.bill.count({
    where: { billingMonth: decPeriod }
  })

  console.log(`Found ${count} December 2025 bills to delete`)

  // Delete bills
  const result = await prisma.bill.deleteMany({
    where: {
      billingMonth: decPeriod,
      paidAmount: 0  // Only delete bills with no payments
    }
  })

  console.log(`Deleted ${result.count} bills`)

  // Verify
  const remaining = await prisma.bill.count({
    where: { billingMonth: decPeriod }
  })

  console.log(`Remaining December 2025 bills: ${remaining}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
