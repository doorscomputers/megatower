import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function clearUnitsAndOwners() {
  console.log("Starting cleanup of Units and Owners...")

  try {
    // Delete in order to respect foreign key constraints

    console.log("Deleting BillPayments...")
    const billPayments = await prisma.billPayment.deleteMany({})
    console.log(`  Deleted ${billPayments.count} bill payments`)

    console.log("Deleting Payments...")
    const payments = await prisma.payment.deleteMany({})
    console.log(`  Deleted ${payments.count} payments`)

    console.log("Deleting Bills...")
    const bills = await prisma.bill.deleteMany({})
    console.log(`  Deleted ${bills.count} bills`)

    console.log("Deleting Electric Readings...")
    const electricReadings = await prisma.electricReading.deleteMany({})
    console.log(`  Deleted ${electricReadings.count} electric readings`)

    console.log("Deleting Water Readings...")
    const waterReadings = await prisma.waterReading.deleteMany({})
    console.log(`  Deleted ${waterReadings.count} water readings`)

    console.log("Removing owner references from Users...")
    const users = await prisma.user.updateMany({
      where: { ownerId: { not: null } },
      data: { ownerId: null },
    })
    console.log(`  Updated ${users.count} users`)

    console.log("Deleting Units...")
    const units = await prisma.unit.deleteMany({})
    console.log(`  Deleted ${units.count} units`)

    console.log("Deleting Owners...")
    const owners = await prisma.owner.deleteMany({})
    console.log(`  Deleted ${owners.count} owners`)

    console.log("\n✓ Cleanup complete!")
    console.log("\nCurrent counts:")
    console.log(`  Units: ${await prisma.unit.count()}`)
    console.log(`  Owners: ${await prisma.owner.count()}`)
    console.log(`  Bills: ${await prisma.bill.count()}`)
    console.log(`  Payments: ${await prisma.payment.count()}`)

  } catch (error) {
    console.error("Error during cleanup:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

clearUnitsAndOwners()
