import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const units = await prisma.unit.findMany({
    where: { unitNumber: { startsWith: 'M2-2F' } },
    select: { id: true, unitNumber: true },
    orderBy: { unitNumber: 'asc' }
  })

  console.log('M2-2F Units:')
  for (const unit of units) {
    console.log(`  ${unit.unitNumber}: ${unit.id}`)
  }
  console.log(`Total: ${units.length} units`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
