/**
 * Final verification for M2-2F-16 after penalty fix
 */
import { PrismaClient } from '@prisma/client'
import { calculateWaterBill } from '../lib/calculations/water'

const prisma = new PrismaClient()

async function main() {
  const novPeriod = new Date('2025-11-01T00:00:00.000Z')
  const decPeriod = new Date('2025-12-01T00:00:00.000Z')

  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-16' },
    include: { owner: true }
  })

  if (!unit) return

  const tenant = await prisma.tenant.findFirst({ include: { settings: true } })
  if (!tenant?.settings) return

  console.log('=== M2-2F-16 Final Verification ===\n')
  console.log(`Owner: ${unit.owner?.firstName} ${unit.owner?.lastName}`)

  // Get readings
  const electricReading = await prisma.electricReading.findFirst({
    where: { unitId: unit.id, billingPeriod: novPeriod }
  })
  const waterReading = await prisma.waterReading.findFirst({
    where: { unitId: unit.id, billingPeriod: novPeriod }
  })

  // Calculate current charges
  const electricRate = Number(tenant.settings.electricRate)
  const duesRate = Number(tenant.settings.associationDuesRate)
  const penaltyRate = Number(tenant.settings.penaltyRate)

  const electricCons = Number(electricReading?.consumption || 0)
  const waterCons = Number(waterReading?.consumption || 0)

  const electricAmount = electricCons * electricRate
  const waterAmount = calculateWaterBill(waterCons, 'RESIDENTIAL', {
    waterResTier1Max: Number(tenant.settings.waterResTier1Max),
    waterResTier1Rate: Number(tenant.settings.waterResTier1Rate),
    waterResTier2Max: Number(tenant.settings.waterResTier2Max),
    waterResTier2Rate: Number(tenant.settings.waterResTier2Rate),
    waterResTier3Max: Number(tenant.settings.waterResTier3Max),
    waterResTier3Rate: Number(tenant.settings.waterResTier3Rate),
    waterResTier4Max: Number(tenant.settings.waterResTier4Max),
    waterResTier4Rate: Number(tenant.settings.waterResTier4Rate),
    waterResTier5Max: Number(tenant.settings.waterResTier5Max),
    waterResTier5Rate: Number(tenant.settings.waterResTier5Rate),
    waterResTier6Max: Number(tenant.settings.waterResTier6Max),
    waterResTier6Rate: Number(tenant.settings.waterResTier6Rate),
    waterResTier7Rate: Number(tenant.settings.waterResTier7Rate),
    waterComTier1Max: 0, waterComTier1Rate: 0, waterComTier2Max: 0, waterComTier2Rate: 0,
    waterComTier3Max: 0, waterComTier3Rate: 0, waterComTier4Max: 0, waterComTier4Rate: 0,
    waterComTier5Max: 0, waterComTier5Rate: 0, waterComTier6Max: 0, waterComTier6Rate: 0,
    waterComTier7Rate: 0
  })
  const duesAmount = Number(unit.area) * duesRate

  const currentCharges = electricAmount + waterAmount + duesAmount

  console.log('\n--- Current Charges (December) ---')
  console.log(`Electric: ${electricCons} kWh × ₱${electricRate} = ₱${electricAmount.toFixed(2)}`)
  console.log(`Water: ${waterCons} cu.m = ₱${waterAmount.toFixed(2)}`)
  console.log(`Dues: ${Number(unit.area)} sqm × ₱${duesRate} = ₱${duesAmount.toFixed(2)}`)
  console.log(`Current Charges Total: ₱${currentCharges.toFixed(2)}`)

  // Get past dues
  const pastDueBills = await prisma.bill.findMany({
    where: {
      unitId: unit.id,
      billingMonth: { lt: decPeriod },
      status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
    }
  })

  let previousBalance = 0
  let totalPenalties = 0

  console.log('\n--- Past Dues ---')
  for (const bill of pastDueBills) {
    const balance = Number(bill.balance)
    previousBalance += balance

    // Calculate months overdue (FIXED formula)
    const monthsOverdue = (decPeriod.getFullYear() - bill.billingMonth.getFullYear()) * 12 +
                         (decPeriod.getMonth() - bill.billingMonth.getMonth())

    // Apply penalty if 1+ months overdue
    if (monthsOverdue >= 1) {
      const penalty = balance * penaltyRate
      totalPenalties += penalty
      console.log(`${bill.billingMonth.toISOString().slice(0,7)}: Balance ₱${balance.toFixed(2)} + ${monthsOverdue} month penalty ₱${penalty.toFixed(2)}`)
    }
  }

  const totalPastDues = previousBalance + totalPenalties
  console.log(`Past Dues Base: ₱${previousBalance.toFixed(2)}`)
  console.log(`Penalties: ₱${totalPenalties.toFixed(2)}`)
  console.log(`Total Past Dues: ₱${totalPastDues.toFixed(2)}`)

  // Get advance balance
  const advanceBalance = await prisma.unitAdvanceBalance.findFirst({
    where: { unitId: unit.id }
  })
  const advanceUtil = Number(advanceBalance?.advanceUtilities || 0)

  console.log('\n--- Advance ---')
  console.log(`Advance Utilities: ₱${advanceUtil.toFixed(2)}`)

  // Calculate total
  const totalAmountDue = currentCharges + totalPastDues - advanceUtil

  console.log('\n=== TOTAL CALCULATION ===')
  console.log(`Current Charges: ₱${currentCharges.toFixed(2)}`)
  console.log(`+ Past Dues: ₱${totalPastDues.toFixed(2)}`)
  console.log(`- Advance: ₱${advanceUtil.toFixed(2)}`)
  console.log(`= TOTAL: ₱${totalAmountDue.toFixed(2)}`)

  console.log('\n=== EXCEL EXPECTED ===')
  console.log('₱3,391.03 + ₱2,376.00 - ₱0.48 = ₱5,766.55')

  const diff = Math.abs(totalAmountDue - 5766.55)
  console.log(`\nDifference: ₱${diff.toFixed(2)}`)
  console.log(diff < 1 ? '✓ MATCH!' : '✗ Still has difference')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
