/**
 * Verify using ACTUAL system calculations (proper water tiers)
 */
import { PrismaClient } from '@prisma/client'
import { calculateWaterBill } from '../lib/calculations/water'

const prisma = new PrismaClient()

async function main() {
  const novPeriod = new Date('2025-11-01T00:00:00.000Z')
  const decPeriod = new Date('2025-12-01T00:00:00.000Z')

  console.log('=== Verification with ACTUAL System Calculations ===\n')

  const tenant = await prisma.tenant.findFirst({ include: { settings: true } })
  if (!tenant?.settings) return

  const settings = tenant.settings
  const waterSettings = {
    waterResTier1Max: Number(settings.waterResTier1Max),
    waterResTier1Rate: Number(settings.waterResTier1Rate),
    waterResTier2Max: Number(settings.waterResTier2Max),
    waterResTier2Rate: Number(settings.waterResTier2Rate),
    waterResTier3Max: Number(settings.waterResTier3Max),
    waterResTier3Rate: Number(settings.waterResTier3Rate),
    waterResTier4Max: Number(settings.waterResTier4Max),
    waterResTier4Rate: Number(settings.waterResTier4Rate),
    waterResTier5Max: Number(settings.waterResTier5Max),
    waterResTier5Rate: Number(settings.waterResTier5Rate),
    waterResTier6Max: Number(settings.waterResTier6Max),
    waterResTier6Rate: Number(settings.waterResTier6Rate),
    waterResTier7Rate: Number(settings.waterResTier7Rate),
    waterComTier1Max: Number(settings.waterComTier1Max),
    waterComTier1Rate: Number(settings.waterComTier1Rate),
    waterComTier2Max: Number(settings.waterComTier2Max),
    waterComTier2Rate: Number(settings.waterComTier2Rate),
    waterComTier3Max: Number(settings.waterComTier3Max),
    waterComTier3Rate: Number(settings.waterComTier3Rate),
    waterComTier4Max: Number(settings.waterComTier4Max),
    waterComTier4Rate: Number(settings.waterComTier4Rate),
    waterComTier5Max: Number(settings.waterComTier5Max),
    waterComTier5Rate: Number(settings.waterComTier5Rate),
    waterComTier6Max: Number(settings.waterComTier6Max),
    waterComTier6Rate: Number(settings.waterComTier6Rate),
    waterComTier7Rate: Number(settings.waterComTier7Rate),
  }

  const electricRate = Number(settings.electricRate)
  const duesRate = Number(settings.associationDuesRate)

  const keyUnits = [
    { unit: 'M2-2F-3', expectedTotal: 4701.65 },
    { unit: 'M2-2F-5', expectedTotal: 3600.53 },
    { unit: 'M2-2F-6', expectedTotal: 5043.44 },
    { unit: 'M2-2F-16', expectedTotal: 5766.55 },
  ]

  for (const key of keyUnits) {
    const unit = await prisma.unit.findFirst({
      where: { unitNumber: key.unit },
      include: { owner: true }
    })
    if (!unit) continue

    const electricReading = await prisma.electricReading.findFirst({
      where: { unitId: unit.id, billingPeriod: novPeriod }
    })
    const waterReading = await prisma.waterReading.findFirst({
      where: { unitId: unit.id, billingPeriod: novPeriod }
    })

    // Get past dues (excluding current period)
    const pastDueBills = await prisma.bill.findMany({
      where: {
        unitId: unit.id,
        billingMonth: { lt: decPeriod },
        status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
      }
    })
    let totalPastDues = 0
    for (const bill of pastDueBills) {
      totalPastDues += Number(bill.balance)
    }
    // Note: Penalty is calculated separately in SOA, not added to past dues base

    // Calculate using ACTUAL system functions
    const electricCons = Number(electricReading?.consumption || 0)
    const waterCons = Number(waterReading?.consumption || 0)

    const electricAmount = electricCons * electricRate
    const waterAmount = calculateWaterBill(waterCons, unit.unitType as 'RESIDENTIAL' | 'COMMERCIAL', waterSettings)
    const duesAmount = Number(unit.area) * duesRate
    const parkingAmount = Number(unit.parkingArea || 0) * duesRate

    const currentCharges = electricAmount + waterAmount + duesAmount + parkingAmount
    const totalAmountDue = currentCharges + totalPastDues

    console.log(`${key.unit}: ${unit.owner?.firstName} ${unit.owner?.lastName}`)
    console.log(`  Electric: ${electricCons} kWh × ₱${electricRate} = ₱${electricAmount.toFixed(2)}`)
    console.log(`  Water: ${waterCons} cu.m = ₱${waterAmount.toFixed(2)} (actual tier calc)`)
    console.log(`  Dues: ${Number(unit.area)} sqm × ₱${duesRate} = ₱${duesAmount.toFixed(2)}`)
    if (parkingAmount > 0) {
      console.log(`  Parking: ${Number(unit.parkingArea)} sqm × ₱${duesRate} = ₱${parkingAmount.toFixed(2)}`)
    }
    console.log(`  Current Charges: ₱${currentCharges.toFixed(2)}`)
    if (totalPastDues > 0) {
      console.log(`  Past Dues: ₱${totalPastDues.toFixed(2)}`)
    }
    console.log(`  ---`)
    console.log(`  System Total: ₱${totalAmountDue.toFixed(2)}`)
    console.log(`  Excel Total: ₱${key.expectedTotal.toFixed(2)}`)

    const diff = Math.abs(totalAmountDue - key.expectedTotal)
    console.log(`  ${diff < 1 ? '✓ MATCH' : `Diff: ₱${diff.toFixed(2)}`}`)
    console.log()
  }

  console.log('=== Ready for December SOA Generation ===')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
