const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const m2Units = await prisma.unit.findMany({
    where: {
      isActive: true,
      unitNumber: { startsWith: 'M2-2F' }
    },
    include: { owner: true },
    orderBy: { unitNumber: 'asc' }
  })

  console.log('M2-2F units in database:')
  m2Units.forEach(u => {
    const owner = u.owner ? `${u.owner.firstName} ${u.owner.lastName}` : 'No owner'
    console.log(`${u.unitNumber}: ${owner}`)
  })
  console.log(`\nTotal M2-2F units: ${m2Units.length}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
