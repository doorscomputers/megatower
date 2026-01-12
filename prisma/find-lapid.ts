import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Search for Lapid in owners
  const owners = await prisma.owner.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Lapid', mode: 'insensitive' } },
        { lastName: { contains: 'Lapid', mode: 'insensitive' } },
        { firstName: { contains: 'Richard', mode: 'insensitive' } },
        { firstName: { contains: 'Perlita', mode: 'insensitive' } },
      ]
    },
    include: {
      units: {
        select: { id: true, unitNumber: true, isActive: true }
      }
    }
  })

  console.log('=== Owners matching Lapid/Richard/Perlita ===')
  if (owners.length === 0) {
    console.log('No owners found with those names')
  } else {
    owners.forEach(o => {
      console.log(`${o.lastName}, ${o.firstName}`)
      o.units.forEach(u => {
        console.log(`  - ${u.unitNumber} (active: ${u.isActive})`)
      })
    })
  }

  // Check if there's a unit with owner name containing "Sps" or "Spouses"
  console.log('\n=== Checking for Sps./Spouses in owner names ===')
  const spsOwners = await prisma.owner.findMany({
    where: {
      OR: [
        { firstName: { contains: 'Sps', mode: 'insensitive' } },
        { lastName: { contains: 'Sps', mode: 'insensitive' } },
      ]
    },
    include: {
      units: { select: { unitNumber: true, isActive: true } }
    },
    take: 10
  })

  spsOwners.forEach(o => {
    console.log(`${o.lastName}, ${o.firstName} - Units: ${o.units.map(u => u.unitNumber).join(', ')}`)
  })

  // Check total owners count
  const totalOwners = await prisma.owner.count()
  const totalUnits = await prisma.unit.count({ where: { isActive: true } })
  console.log(`\nTotal owners: ${totalOwners}`)
  console.log(`Total active units: ${totalUnits}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
