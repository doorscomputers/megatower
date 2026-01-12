import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Clear Advance Balances for 2nd Floor Units ===\n')

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

  // Find existing advance balances
  const advances = await prisma.unitAdvanceBalance.findMany({
    where: { unitId: { in: unitIds } },
    include: { unit: { select: { unitNumber: true } } }
  })

  console.log(`Found ${advances.length} advance balance records\n`)

  if (advances.length === 0) {
    console.log('No advance balances to clear.')
    return
  }

  // Show what will be cleared
  console.log('Clearing advances:')
  advances.forEach(a => {
    const dues = Number(a.advanceDues)
    const util = Number(a.advanceUtilities)
    if (dues > 0 || util > 0) {
      console.log(`- ${a.unit.unitNumber} | Dues: ₱${dues.toFixed(2)} | Util: ₱${util.toFixed(2)}`)
    }
  })

  // Reset all to zero
  const result = await prisma.unitAdvanceBalance.updateMany({
    where: { unitId: { in: unitIds } },
    data: {
      advanceDues: 0,
      advanceUtilities: 0
    }
  })

  console.log(`\nCleared ${result.count} advance balance records`)
  console.log('\n=== Complete ===')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
