/**
 * Comprehensive verification for December 2025 SOA readiness
 * Checks all key units against Excel expectations
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const novPeriod = new Date('2025-11-01T00:00:00.000Z')
  const decPeriod = new Date('2025-12-01T00:00:00.000Z')

  console.log('=== December 2025 SOA Readiness Verification ===\n')

  // Check December bills don't exist (should be generated via UI)
  const decBillCount = await prisma.bill.count({
    where: { billingMonth: decPeriod }
  })
  console.log(`December 2025 bills in database: ${decBillCount}`)
  if (decBillCount > 0) {
    console.log('⚠️  WARNING: December bills already exist. Use "Regenerate" if needed.\n')
  } else {
    console.log('✓ Ready to generate December bills\n')
  }

  // Check November readings exist
  const novElectricCount = await prisma.electricReading.count({
    where: { billingPeriod: novPeriod }
  })
  const novWaterCount = await prisma.waterReading.count({
    where: { billingPeriod: novPeriod }
  })
  console.log(`November 2025 Readings:`)
  console.log(`  Electric: ${novElectricCount} readings`)
  console.log(`  Water: ${novWaterCount} readings`)

  // Verify key units
  const keyUnits = [
    { unit: 'M2-2F-3', expectedTotal: 4701.65, expectedOwner: 'Eloisa Montegrico' },
    { unit: 'M2-2F-5', expectedTotal: 3600.53, expectedOwner: 'Richard & Perlita Lapid' },
    { unit: 'M2-2F-6', expectedTotal: 5043.44, expectedOwner: 'EDUARDO & MARIVIC ALONZO' },
    { unit: 'M2-2F-16', expectedTotal: 5766.55, expectedOwner: 'MARK JAYSON C. PADUA' },
  ]

  console.log('\n=== Key Units Verification ===\n')

  const tenant = await prisma.tenant.findFirst({ include: { settings: true } })
  const electricRate = Number(tenant?.settings?.electricRate || 10.01)
  const duesRate = Number(tenant?.settings?.associationDuesRate || 60)

  for (const key of keyUnits) {
    const unit = await prisma.unit.findFirst({
      where: { unitNumber: key.unit },
      include: { owner: true }
    })

    if (!unit) {
      console.log(`${key.unit}: NOT FOUND ✗`)
      continue
    }

    // Get November readings (for December SOA)
    const electricReading = await prisma.electricReading.findFirst({
      where: { unitId: unit.id, billingPeriod: novPeriod }
    })
    const waterReading = await prisma.waterReading.findFirst({
      where: { unitId: unit.id, billingPeriod: novPeriod }
    })

    // Get past dues
    const pastDueBills = await prisma.bill.findMany({
      where: {
        unitId: unit.id,
        billingMonth: { lt: decPeriod },
        status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
      }
    })
    let pastDuesBase = 0
    for (const bill of pastDueBills) {
      pastDuesBase += Number(bill.balance)
    }
    // Add 10% penalty for past dues (1 month overdue)
    const pastDuesPenalty = pastDuesBase * 0.10
    const totalPastDues = pastDuesBase + pastDuesPenalty

    // Calculate current charges
    const electricCons = Number(electricReading?.consumption || 0)
    const waterCons = Number(waterReading?.consumption || 0)
    const electricAmount = electricCons * electricRate
    const waterAmount = waterCons <= 1 ? 80 : waterCons <= 5 ? 200 : waterCons * 50 // Simplified tier
    const duesAmount = Number(unit.area) * duesRate
    const parkingAmount = Number(unit.parkingArea || 0) * duesRate

    const currentCharges = electricAmount + waterAmount + duesAmount + parkingAmount
    const totalAmountDue = currentCharges + totalPastDues

    const ownerName = `${unit.owner?.firstName || ''} ${unit.owner?.lastName || ''}`.trim()
    const ownerMatch = ownerName.toLowerCase().includes(key.expectedOwner.split(' ')[0].toLowerCase())

    console.log(`${key.unit}: ${ownerName}`)
    console.log(`  Owner: ${ownerMatch ? '✓' : '✗'} ${ownerMatch ? 'Correct' : `Expected: ${key.expectedOwner}`}`)
    console.log(`  Electric: ${electricCons} kWh → ₱${electricAmount.toFixed(2)}`)
    console.log(`  Water: ${waterCons} cu.m → ₱${waterAmount.toFixed(2)}`)
    console.log(`  Dues: ${Number(unit.area)} sqm → ₱${duesAmount.toFixed(2)}`)
    if (parkingAmount > 0) {
      console.log(`  Parking: ${Number(unit.parkingArea)} sqm → ₱${parkingAmount.toFixed(2)}`)
    }
    console.log(`  Current Charges: ₱${currentCharges.toFixed(2)}`)
    if (pastDuesBase > 0) {
      console.log(`  Past Dues: ₱${pastDuesBase.toFixed(2)} + ₱${pastDuesPenalty.toFixed(2)} penalty = ₱${totalPastDues.toFixed(2)}`)
    }
    console.log(`  ---`)
    console.log(`  Calculated Total: ₱${totalAmountDue.toFixed(2)}`)
    console.log(`  Expected Total: ₱${key.expectedTotal.toFixed(2)}`)

    const diff = Math.abs(totalAmountDue - key.expectedTotal)
    if (diff < 1) {
      console.log(`  Status: ✓ MATCH`)
    } else {
      console.log(`  Status: ⚠️  Difference: ₱${diff.toFixed(2)}`)
    }
    console.log()
  }

  console.log('=== Summary ===')
  console.log('If all units show ✓ MATCH, you can proceed to generate December SOA.')
  console.log('Go to: Billing → Generate Bills → Select December 2025 → Preview → Generate')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
