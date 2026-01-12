/**
 * Test December 2025 bill generation logic directly
 * This simulates what the API does to debug the issue
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Testing December 2025 Bill Generation ===\n')

  // December 2025 billing
  const parsedYear = 2025
  const parsedMonth = 12

  // Billing period = December 2025
  const billingPeriod = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1))
  console.log('Billing Period:', billingPeriod.toISOString())

  // IMPORTANT: Bill for Month X uses readings from Month X-1
  // December 2025 SOA uses November 2025 readings
  const readingsPeriod = new Date(Date.UTC(parsedYear, parsedMonth - 2, 1)) // Previous month
  console.log('Readings Period (should be November):', readingsPeriod.toISOString())

  // Get tenant
  const tenant = await prisma.tenant.findFirst({
    include: { settings: true }
  })
  console.log('\nTenant:', tenant?.name)

  // Get electric readings for the PREVIOUS month's billing period
  const electricReadings = await prisma.electricReading.findMany({
    where: {
      billingPeriod: readingsPeriod,
      unit: {
        tenantId: tenant?.id,
      },
    },
    include: {
      unit: { select: { unitNumber: true } }
    }
  })

  console.log('\n=== Electric Readings for', readingsPeriod.toISOString().slice(0,7), '===')
  console.log('Count:', electricReadings.length)
  electricReadings.slice(0, 5).forEach(r => {
    console.log(`  ${r.unit?.unitNumber}: Prev=${Number(r.previousReading)}, Pres=${Number(r.presentReading)}, Cons=${Number(r.consumption)}`)
  })

  // Get water readings for the PREVIOUS month's billing period
  const waterReadings = await prisma.waterReading.findMany({
    where: {
      billingPeriod: readingsPeriod,
      unit: {
        tenantId: tenant?.id,
      },
    },
    include: {
      unit: { select: { unitNumber: true } }
    }
  })

  console.log('\n=== Water Readings for', readingsPeriod.toISOString().slice(0,7), '===')
  console.log('Count:', waterReadings.length)
  waterReadings.slice(0, 5).forEach(r => {
    console.log(`  ${r.unit?.unitNumber}: Prev=${Number(r.previousReading)}, Pres=${Number(r.presentReading)}, Cons=${Number(r.consumption)}`)
  })

  // Find M2-2F-1 to check
  const electricM2_2F_1 = electricReadings.find(r => r.unit?.unitNumber === 'M2-2F-1')
  const waterM2_2F_1 = waterReadings.find(r => r.unit?.unitNumber === 'M2-2F-1')

  console.log('\n=== M2-2F-1 Summary ===')
  console.log('Electric:', electricM2_2F_1 ? {
    prev: Number(electricM2_2F_1.previousReading),
    pres: Number(electricM2_2F_1.presentReading),
    cons: Number(electricM2_2F_1.consumption)
  } : 'NOT FOUND')
  console.log('Water:', waterM2_2F_1 ? {
    prev: Number(waterM2_2F_1.previousReading),
    pres: Number(waterM2_2F_1.presentReading),
    cons: Number(waterM2_2F_1.consumption)
  } : 'NOT FOUND')

  // Calculate expected amounts
  if (electricM2_2F_1 && waterM2_2F_1) {
    const electricRate = Number(tenant?.settings?.electricRate || 10.0118)
    const electricMinCharge = Number(tenant?.settings?.electricMinCharge || 50)
    const electricCons = Number(electricM2_2F_1.consumption)
    let electricBill = electricCons * electricRate
    if (electricBill < electricMinCharge) electricBill = electricMinCharge

    console.log('\n=== Expected December Bill for M2-2F-1 ===')
    console.log(`Electric: ${electricCons} × ₱${electricRate.toFixed(4)} = ₱${electricBill.toFixed(2)}`)
    console.log(`Water: ${Number(waterM2_2F_1.consumption)} cu.m (need tier calculation)`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
