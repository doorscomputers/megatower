const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  // Find units with multiple unpaid bills
  const units = await prisma.unit.findMany({
    where: { isActive: true },
    include: {
      bills: {
        where: {
          status: { in: ['UNPAID', 'PARTIAL'] }
        },
        orderBy: { billingMonth: 'asc' }
      }
    }
  })

  const delinquent = units.filter(u => u.bills.length >= 2)
    .sort((a, b) => b.bills.length - a.bills.length)

  console.log('Units with 2+ unpaid bills:')
  for (const u of delinquent.slice(0, 10)) {
    console.log(`  ${u.unitNumber}: ${u.bills.length} unpaid bills`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
