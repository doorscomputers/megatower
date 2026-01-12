import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Clearing opening balance bills...')

  const result = await prisma.bill.deleteMany({
    where: { billType: 'OPENING_BALANCE' }
  })

  console.log(`Deleted ${result.count} opening balance bills`)
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e)
    prisma.$disconnect()
    process.exit(1)
  })
