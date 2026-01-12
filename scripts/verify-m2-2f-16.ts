/**
 * Verify M2-2F-16 readings and amounts match Excel
 * Excel shows:
 * - Electric: Pres=7310, Prev=7207, Cons=103, Amount=₱1,031.03
 * - Water: Pres=430, Prev=427, Cons=3, Amount=₱200.00
 * - Dues: 36 sqm × ₱60 = ₱2,160.00
 * - Total Current: ₱3,391.03
 * - Past Dues: ₱2,376.00
 * - Total Due: ₱5,766.55
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const novPeriod = new Date('2025-11-01T00:00:00.000Z')
  const decPeriod = new Date('2025-12-01T00:00:00.000Z')

  console.log('=== M2-2F-16 Verification ===\n')

  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-16' },
    include: { owner: true }
  })

  if (!unit) {
    console.log('Unit not found!')
    return
  }

  console.log('Unit Details:')
  console.log(`  Unit: ${unit.unitNumber}`)
  console.log(`  Owner: ${unit.owner?.firstName} ${unit.owner?.lastName}`)
  console.log(`  Area: ${Number(unit.area)} sqm`)
  console.log(`  Parking: ${Number(unit.parkingArea)} sqm`)

  // Check November readings (used for December bill)
  const electricReading = await prisma.electricReading.findFirst({
    where: { unitId: unit.id, billingPeriod: novPeriod }
  })

  const waterReading = await prisma.waterReading.findFirst({
    where: { unitId: unit.id, billingPeriod: novPeriod }
  })

  console.log('\nNovember Readings (for December SOA):')
  console.log('  Electric:')
  console.log(`    DB: Prev=${Number(electricReading?.previousReading)}, Pres=${Number(electricReading?.presentReading)}, Cons=${Number(electricReading?.consumption)}`)
  console.log('    Excel: Prev=7207, Pres=7310, Cons=103')
  console.log(`    Match: ${Number(electricReading?.consumption) === 103 ? '✓' : '✗'}`)

  console.log('  Water:')
  console.log(`    DB: Prev=${Number(waterReading?.previousReading)}, Pres=${Number(waterReading?.presentReading)}, Cons=${Number(waterReading?.consumption)}`)
  console.log('    Excel: Prev=427, Pres=430, Cons=3')
  console.log(`    Match: ${Number(waterReading?.consumption) === 3 ? '✓' : '✗'}`)

  // Check past dues (November bill with balance)
  console.log('\nPast Due Bills:')
  const pastDueBills = await prisma.bill.findMany({
    where: {
      unitId: unit.id,
      billingMonth: { lt: decPeriod },
      status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
    },
    orderBy: { billingMonth: 'desc' }
  })

  let totalPastDues = 0
  for (const bill of pastDueBills) {
    const balance = Number(bill.balance)
    totalPastDues += balance
    console.log(`  ${bill.billingMonth.toISOString().slice(0,7)}: Balance=₱${balance.toFixed(2)} (Status=${bill.status})`)
  }
  console.log(`  Total Past Dues: ₱${totalPastDues.toFixed(2)}`)
  console.log('  Excel Past Dues: ₱2,376.00')

  // Expected totals
  console.log('\n=== Expected vs System ===')
  const electricAmount = Number(electricReading?.consumption || 0) * 10.01
  const waterAmount = 200 // For 3 cu.m based on tier
  const duesAmount = Number(unit.area) * 60

  console.log(`Electric: ₱${electricAmount.toFixed(2)} (Excel: ₱1,031.03)`)
  console.log(`Water: ₱${waterAmount.toFixed(2)} (Excel: ₱200.00)`)
  console.log(`Dues: ₱${duesAmount.toFixed(2)} (Excel: ₱2,160.00)`)

  const currentCharges = electricAmount + waterAmount + duesAmount
  console.log(`Current Charges: ₱${currentCharges.toFixed(2)} (Excel: ₱3,391.03)`)

  const totalDue = currentCharges + totalPastDues
  console.log(`Total Amount Due: ₱${totalDue.toFixed(2)} (Excel: ₱5,766.55)`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
