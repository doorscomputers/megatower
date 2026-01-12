const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Cleaning up imported data...')
  console.log('='.repeat(60))

  // Delete all opening balance bills
  const deletedBills = await prisma.bill.deleteMany({
    where: {
      billType: 'OPENING_BALANCE'
    }
  })
  console.log(`Deleted ${deletedBills.count} opening balance bills`)

  // Delete all electric readings
  const deletedElectric = await prisma.electricReading.deleteMany({})
  console.log(`Deleted ${deletedElectric.count} electric readings`)

  // Delete all water readings
  const deletedWater = await prisma.waterReading.deleteMany({})
  console.log(`Deleted ${deletedWater.count} water readings`)

  console.log('='.repeat(60))
  console.log('Cleanup complete!')
  console.log('\nYou can now re-import with the correct September data.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
