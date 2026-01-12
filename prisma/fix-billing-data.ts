/**
 * Fix billing data:
 * 1. Delete December 2025 test bills
 * 2. Delete existing September payments and their allocations
 * 3. This allows us to re-run the proper workflow
 *
 * Run with: npx tsx prisma/fix-billing-data.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(60))
  console.log('FIX BILLING DATA')
  console.log('='.repeat(60))

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found!')
    process.exit(1)
  }
  console.log(`Tenant: ${tenant.name}`)

  // Step 1: Check existing December bills
  const decemberBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: {
        gte: new Date('2025-12-01'),
        lt: new Date('2026-01-01')
      }
    }
  })

  console.log(`\nFound ${decemberBills.length} December 2025 bills`)

  if (decemberBills.length > 0) {
    // Delete bill payments for these bills
    const billIds = decemberBills.map(b => b.id)
    const deletedBillPayments = await prisma.billPayment.deleteMany({
      where: { billId: { in: billIds } }
    })
    console.log(`Deleted ${deletedBillPayments.count} bill payment allocations`)

    // Delete the bills
    const deletedBills = await prisma.bill.deleteMany({
      where: { id: { in: billIds } }
    })
    console.log(`Deleted ${deletedBills.count} December bills`)
  }

  // Step 2: Check September payments
  const septPayments = await prisma.payment.findMany({
    where: {
      tenantId: tenant.id,
      paymentDate: {
        gte: new Date('2025-09-01'),
        lt: new Date('2025-10-01')
      }
    },
    include: {
      billPayments: true
    }
  })

  console.log(`\nFound ${septPayments.length} September 2025 payments`)

  // Check how many have bill allocations
  const paymentsWithAlloc = septPayments.filter(p => p.billPayments.length > 0)
  console.log(`Payments with bill allocations: ${paymentsWithAlloc.length}`)

  // Step 3: Delete bill payment allocations for September payments
  const paymentIds = septPayments.map(p => p.id)
  if (paymentIds.length > 0) {
    const deletedAllocs = await prisma.billPayment.deleteMany({
      where: { paymentId: { in: paymentIds } }
    })
    console.log(`Deleted ${deletedAllocs.count} payment allocations`)
  }

  // Step 4: Delete advance balances (will be recreated)
  const deletedAdvances = await prisma.unitAdvanceBalance.deleteMany({
    where: { tenantId: tenant.id }
  })
  console.log(`Deleted ${deletedAdvances.count} advance balance records`)

  // Step 5: Now delete the September payments (will re-import)
  const deletedPayments = await prisma.payment.deleteMany({
    where: {
      tenantId: tenant.id,
      paymentDate: {
        gte: new Date('2025-09-01'),
        lt: new Date('2025-10-01')
      }
    }
  })
  console.log(`Deleted ${deletedPayments.count} September payments`)

  console.log('\n' + '='.repeat(60))
  console.log('DATA CLEANUP COMPLETE')
  console.log('='.repeat(60))
  console.log(`
Next Steps:
1. Generate September 2025 bills first
   - Go to Billing > Generate Bills
   - Select September 2025
   - Generate the bills

2. Then import September payments
   - Run: npx tsx prisma/import-sept-payments.ts

3. Then generate October 2025 bills
   - Go to Billing > Generate Bills
   - Select October 2025
   - Generate the bills
`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
