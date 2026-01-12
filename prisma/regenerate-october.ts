/**
 * Regenerate October 2025 bills with advance balances applied
 *
 * Run with: npx tsx prisma/regenerate-october.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(60))
  console.log('REGENERATING OCTOBER 2025 BILLS WITH ADVANCES')
  console.log('='.repeat(60))

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found!')
    process.exit(1)
  }

  // Delete existing October bills
  const existingOctBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: {
        gte: new Date('2025-10-01'),
        lt: new Date('2025-11-01')
      }
    }
  })

  if (existingOctBills.length > 0) {
    // Delete bill payments first
    await prisma.billPayment.deleteMany({
      where: { billId: { in: existingOctBills.map(b => b.id) } }
    })

    // Delete the bills
    const deleted = await prisma.bill.deleteMany({
      where: { id: { in: existingOctBills.map(b => b.id) } }
    })
    console.log(`Deleted ${deleted.count} existing October bills`)
  }

  console.log('\nNow run the generate script to create new October bills:')
  console.log('  npx tsx prisma/generate-sept-oct-bills.ts --october')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
