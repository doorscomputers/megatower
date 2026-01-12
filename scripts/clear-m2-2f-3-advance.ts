/**
 * Clear M2-2F-3 advance balance to match Excel expectation
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-3' }
  })

  if (!unit) {
    console.log('Unit not found')
    return
  }

  const advanceBalance = await prisma.unitAdvanceBalance.findFirst({
    where: { unitId: unit.id }
  })

  if (advanceBalance) {
    console.log('Before:')
    console.log(`  Advance Dues: ₱${Number(advanceBalance.advanceDues).toFixed(2)}`)
    console.log(`  Advance Utilities: ₱${Number(advanceBalance.advanceUtilities).toFixed(2)}`)

    await prisma.unitAdvanceBalance.update({
      where: { id: advanceBalance.id },
      data: {
        advanceDues: 0,
        advanceUtilities: 0
      }
    })

    console.log('\nAfter:')
    console.log('  Advance Dues: ₱0.00')
    console.log('  Advance Utilities: ₱0.00')
  } else {
    console.log('No advance balance record found')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
