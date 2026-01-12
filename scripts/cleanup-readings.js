const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('Cleaning up all readings and adjustments...')
  console.log('='.repeat(60))

  // Delete all electric readings
  const deletedElectric = await prisma.electricReading.deleteMany({})
  console.log(`Deleted ${deletedElectric.count} electric readings`)

  // Delete all water readings
  const deletedWater = await prisma.waterReading.deleteMany({})
  console.log(`Deleted ${deletedWater.count} water readings`)

  // Delete all billing adjustments
  const deletedAdjustments = await prisma.billingAdjustment.deleteMany({})
  console.log(`Deleted ${deletedAdjustments.count} billing adjustments`)

  // Delete all bills (except OPENING_BALANCE if you want to keep them)
  // Uncomment the next line if you want to delete all bills too
  // const deletedBills = await prisma.bill.deleteMany({ where: { billType: { not: 'OPENING_BALANCE' } } })
  // console.log(`Deleted ${deletedBills.count} bills`)

  console.log('='.repeat(60))
  console.log('Cleanup complete!')
  console.log('\nYou can now import September and October data.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
