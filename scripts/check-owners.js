const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  const units = await prisma.unit.findMany({
    where: {
      unitNumber: {
        startsWith: 'M2-2F-'
      }
    },
    include: {
      owner: {
        select: {
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: {
      unitNumber: 'asc'
    }
  })

  // Sort numerically by the last part
  units.sort((a, b) => {
    const numA = parseInt(a.unitNumber.split('-')[2], 10)
    const numB = parseInt(b.unitNumber.split('-')[2], 10)
    return numA - numB
  })

  console.log('M2-2F Units and Owners:')
  console.log('='.repeat(60))
  for (const unit of units) {
    const ownerName = unit.owner.lastName
      ? `${unit.owner.lastName}, ${unit.owner.firstName || ''}`.trim()
      : unit.owner.firstName || 'Unknown'
    console.log(`${unit.unitNumber.padEnd(15)} | ${ownerName}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
