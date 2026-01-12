/**
 * Fix M2-2F-16 owner assignment
 * Should be: MR. MARK JAYSON C. PADUA
 * Currently shows: Parfiles, Tirso & Maria Shirley
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Checking M2-2F-16 Owner Assignment ===\n')

  // Find the unit
  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-16' },
    include: { owner: true }
  })

  if (!unit) {
    console.log('Unit M2-2F-16 not found!')
    return
  }

  console.log('Current Unit Data:')
  console.log(`  Unit: ${unit.unitNumber}`)
  console.log(`  Owner ID: ${unit.ownerId}`)
  console.log(`  Current Owner: ${unit.owner?.firstName} ${unit.owner?.lastName}`)

  // Check if Mark Jayson Padua exists as an owner
  const correctOwner = await prisma.owner.findFirst({
    where: {
      OR: [
        { lastName: { contains: 'PADUA', mode: 'insensitive' } },
        { firstName: { contains: 'MARK JAYSON', mode: 'insensitive' } },
        { firstName: { contains: 'PADUA', mode: 'insensitive' } }
      ]
    }
  })

  console.log('\nSearching for Mark Jayson Padua...')
  if (correctOwner) {
    console.log(`  Found: ${correctOwner.firstName} ${correctOwner.lastName} (ID: ${correctOwner.id})`)
  } else {
    console.log('  Not found - will need to create')
  }

  // Check what unit Parfiles is assigned to (maybe swap needed)
  const parfilesOwner = await prisma.owner.findFirst({
    where: {
      OR: [
        { lastName: { contains: 'Parfiles', mode: 'insensitive' } },
        { lastName: { contains: 'PARFILES', mode: 'insensitive' } }
      ]
    },
    include: { units: true }
  })

  if (parfilesOwner) {
    console.log('\nParfiles owner data:')
    console.log(`  Name: ${parfilesOwner.firstName} ${parfilesOwner.lastName}`)
    console.log(`  Units: ${parfilesOwner.units.map(u => u.unitNumber).join(', ')}`)
  }

  // List all 2F units and their owners for reference
  console.log('\n=== All M2-2F Units and Owners ===')
  const units2F = await prisma.unit.findMany({
    where: { unitNumber: { startsWith: 'M2-2F-' } },
    include: { owner: true },
    orderBy: { unitNumber: 'asc' }
  })

  for (const u of units2F) {
    console.log(`  ${u.unitNumber}: ${u.owner?.firstName || 'NO'} ${u.owner?.lastName || 'OWNER'}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
