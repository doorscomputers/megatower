/**
 * Fix M2-2F-16 advance payment of ₱0.48
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-16' }
  })

  if (!unit) return

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) return

  console.log('=== Adding ₱0.48 Advance for M2-2F-16 ===\n')

  // Check if advance balance exists
  let advanceBalance = await prisma.unitAdvanceBalance.findFirst({
    where: { unitId: unit.id }
  })

  if (advanceBalance) {
    // Update existing
    advanceBalance = await prisma.unitAdvanceBalance.update({
      where: { id: advanceBalance.id },
      data: {
        advanceUtilities: 0.48  // The ₱0.48 was an advance payment
      }
    })
    console.log('Updated advance balance:')
  } else {
    // Create new
    advanceBalance = await prisma.unitAdvanceBalance.create({
      data: {
        tenantId: tenant.id,
        unitId: unit.id,
        advanceDues: 0,
        advanceUtilities: 0.48
      }
    })
    console.log('Created advance balance:')
  }

  console.log(`  Advance Dues: ₱${Number(advanceBalance.advanceDues).toFixed(2)}`)
  console.log(`  Advance Utilities: ₱${Number(advanceBalance.advanceUtilities).toFixed(2)}`)

  // Also update the payment record to reflect the advance
  const payment = await prisma.payment.findFirst({
    where: { unitId: unit.id, orNumber: '21958-16' }
  })

  if (payment) {
    await prisma.payment.update({
      where: { id: payment.id },
      data: {
        advanceUtilAmount: 0.48
      }
    })
    console.log('\nUpdated payment record with advanceUtilAmount: ₱0.48')
  }

  console.log('\n✓ Advance payment of ₱0.48 now recorded')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
