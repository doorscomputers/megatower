/**
 * Debug M2-2F-3 bill calculation
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const decPeriod = new Date('2025-12-01T00:00:00.000Z')
  const novPeriod = new Date('2025-11-01T00:00:00.000Z')

  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-3' },
    include: { owner: true }
  })

  if (!unit) {
    console.log('Unit not found')
    return
  }

  console.log('=== M2-2F-3 Debug ===\n')
  console.log('Unit Details:')
  console.log(`  Area: ${Number(unit.area)} sqm`)
  console.log(`  Parking Area: ${Number(unit.parkingArea)} sqm`)
  console.log(`  Unit Type: ${unit.unitType}`)

  // Get November readings (used for December bill)
  const electricReading = await prisma.electricReading.findFirst({
    where: { unitId: unit.id, billingPeriod: novPeriod }
  })

  const waterReading = await prisma.waterReading.findFirst({
    where: { unitId: unit.id, billingPeriod: novPeriod }
  })

  console.log('\nNovember Readings (for December Bill):')
  console.log(`  Electric: Prev=${Number(electricReading?.previousReading)}, Pres=${Number(electricReading?.presentReading)}, Cons=${Number(electricReading?.consumption)}`)
  console.log(`  Water: Prev=${Number(waterReading?.previousReading)}, Pres=${Number(waterReading?.presentReading)}, Cons=${Number(waterReading?.consumption)}`)

  // Get tenant settings
  const tenant = await prisma.tenant.findFirst({ include: { settings: true } })

  console.log('\nTenant Settings:')
  console.log(`  Electric Rate: ₱${tenant?.settings?.electricRate}`)
  console.log(`  Association Dues Rate: ₱${tenant?.settings?.associationDuesRate}`)
  console.log(`  Parking Rate: ₱${tenant?.settings?.parkingRate}`)

  // Get December bill
  const bill = await prisma.bill.findFirst({
    where: { unitId: unit.id, billingMonth: decPeriod }
  })

  console.log('\nDecember Bill (Stored Values):')
  console.log(`  electricAmount: ₱${Number(bill?.electricAmount).toFixed(2)}`)
  console.log(`  waterAmount: ₱${Number(bill?.waterAmount).toFixed(2)}`)
  console.log(`  associationDues: ₱${Number(bill?.associationDues).toFixed(2)}`)
  console.log(`  parkingFee: ₱${Number(bill?.parkingFee).toFixed(2)}`)
  console.log(`  spAssessment: ₱${Number(bill?.spAssessment).toFixed(2)}`)
  console.log(`  discounts: ₱${Number(bill?.discounts).toFixed(2)}`)
  console.log(`  advanceDuesApplied: ₱${Number(bill?.advanceDuesApplied || 0).toFixed(2)}`)
  console.log(`  advanceUtilApplied: ₱${Number(bill?.advanceUtilApplied || 0).toFixed(2)}`)
  console.log(`  ---`)
  console.log(`  totalAmount: ₱${Number(bill?.totalAmount).toFixed(2)}`)
  console.log(`  paidAmount: ₱${Number(bill?.paidAmount).toFixed(2)}`)
  console.log(`  balance: ₱${Number(bill?.balance).toFixed(2)}`)

  // Calculate expected total
  if (bill) {
    const electric = Number(bill.electricAmount)
    const water = Number(bill.waterAmount)
    const dues = Number(bill.associationDues)
    const parking = Number(bill.parkingFee)
    const spAssessment = Number(bill.spAssessment)
    const discounts = Number(bill.discounts)
    const advanceDues = Number(bill.advanceDuesApplied || 0)
    const advanceUtil = Number(bill.advanceUtilApplied || 0)

    const calculatedTotal = electric + water + dues + parking + spAssessment - discounts - advanceDues - advanceUtil

    console.log('\nCalculation Check:')
    console.log(`  Sum of components: ₱${calculatedTotal.toFixed(2)}`)
    console.log(`  Stored total: ₱${Number(bill.totalAmount).toFixed(2)}`)
    console.log(`  Match: ${Math.abs(calculatedTotal - Number(bill.totalAmount)) < 0.01 ? 'YES' : 'NO'}`)
  }

  // Expected values from Excel
  console.log('\n=== Excel Expected ===')
  console.log('  Electric: 165 × ₱10.01 = ₱1,651.65')
  console.log('  Water: 11 cu.m = ₱410.00 (based on tier rates)')
  console.log('  Dues: 30 × ₱60 = ₱1,800.00')
  console.log('  Parking: 14 × ₱60 = ₱840.00')
  console.log('  ---')
  console.log('  Expected Total: ₱4,701.65')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
