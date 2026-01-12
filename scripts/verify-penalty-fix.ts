/**
 * Verify penalty calculation fix for OPENING_BALANCE bills
 * M2-2F-6: Should have NO penalty on migrated debt (₱421.72)
 * M2-2F-16: Should have penalty on unpaid dues (₱2,160)
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const decPeriod = new Date('2025-12-01T00:00:00.000Z')

  const tenant = await prisma.tenant.findFirst({ include: { settings: true } })
  const duesRate = Number(tenant?.settings?.associationDuesRate || 60)

  console.log('=== Penalty Fix Verification ===')
  console.log(`Dues Rate: ₱${duesRate}/sqm\n`)

  // Check M2-2F-6 (Alonzo) - should have NO penalty
  const unit6 = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-6' },
    include: { owner: true }
  })
  const bill6 = await prisma.bill.findFirst({
    where: { unitId: unit6?.id, billingMonth: new Date('2025-11-01') }
  })

  if (bill6 && unit6) {
    const balance6 = Number(bill6.totalAmount) - Number(bill6.paidAmount)
    // Calculate dues from unit area if not stored
    const calculatedDues6 = bill6.duesAmount ? Number(bill6.duesAmount) : (Number(unit6.area) * duesRate)
    const calculatedParking6 = bill6.parkingFee ? Number(bill6.parkingFee) : (Number(unit6.parkingArea || 0) * duesRate)

    const currentCharges6 = Number(bill6.electricAmount || 0) +
                            Number(bill6.waterAmount || 0) +
                            calculatedDues6 +
                            calculatedParking6
    const migratedDebt6 = Math.max(0, Number(bill6.totalAmount) - currentCharges6)
    const penaltyEligible6 = Math.max(0, balance6 - migratedDebt6)
    const penalty6 = penaltyEligible6 * 0.10

    console.log('M2-2F-6 (Alonzo):')
    console.log(`  Unit Area: ${unit6.area} sqm`)
    console.log(`  Bill Type: ${bill6.billType}`)
    console.log(`  Bill Total: ₱${Number(bill6.totalAmount).toFixed(2)}`)
    console.log(`  Current Charges: ₱${currentCharges6.toFixed(2)}`)
    console.log(`    - Electric: ₱${Number(bill6.electricAmount || 0).toFixed(2)}`)
    console.log(`    - Water: ₱${Number(bill6.waterAmount || 0).toFixed(2)}`)
    console.log(`    - Dues: ₱${calculatedDues6.toFixed(2)} (${unit6.area} × ${duesRate})`)
    console.log(`  Migrated Debt: ₱${migratedDebt6.toFixed(2)}`)
    console.log(`  Balance: ₱${balance6.toFixed(2)}`)
    console.log(`  Penalty Eligible: ₱${penaltyEligible6.toFixed(2)}`)
    console.log(`  Penalty (10%): ₱${penalty6.toFixed(2)}`)
    console.log(`  Past Dues for SOA: ₱${balance6.toFixed(2)} + ₱${penalty6.toFixed(2)} = ₱${(balance6 + penalty6).toFixed(2)}`)
    console.log(`  EXPECTED: ₱421.72 + ₱0.00 = ₱421.72`)
    console.log(`  ${penalty6 === 0 ? '✓ CORRECT' : '✗ WRONG'}`)
  }

  console.log()

  // Check M2-2F-16 (Padua) - should have penalty
  const unit16 = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-16' },
    include: { owner: true }
  })
  const bill16 = await prisma.bill.findFirst({
    where: { unitId: unit16?.id, billingMonth: new Date('2025-11-01') }
  })

  if (bill16 && unit16) {
    const balance16 = Number(bill16.totalAmount) - Number(bill16.paidAmount)
    // Calculate dues from unit area if not stored
    const calculatedDues16 = bill16.duesAmount ? Number(bill16.duesAmount) : (Number(unit16.area) * duesRate)
    const calculatedParking16 = bill16.parkingFee ? Number(bill16.parkingFee) : (Number(unit16.parkingArea || 0) * duesRate)

    const currentCharges16 = Number(bill16.electricAmount || 0) +
                             Number(bill16.waterAmount || 0) +
                             calculatedDues16 +
                             calculatedParking16
    const migratedDebt16 = Math.max(0, Number(bill16.totalAmount) - currentCharges16)
    const penaltyEligible16 = Math.max(0, balance16 - migratedDebt16)
    const penalty16 = penaltyEligible16 * 0.10

    console.log('M2-2F-16 (Padua):')
    console.log(`  Unit Area: ${unit16.area} sqm`)
    console.log(`  Bill Type: ${bill16.billType}`)
    console.log(`  Bill Total: ₱${Number(bill16.totalAmount).toFixed(2)}`)
    console.log(`  Current Charges: ₱${currentCharges16.toFixed(2)}`)
    console.log(`    - Electric: ₱${Number(bill16.electricAmount || 0).toFixed(2)}`)
    console.log(`    - Water: ₱${Number(bill16.waterAmount || 0).toFixed(2)}`)
    console.log(`    - Dues: ₱${calculatedDues16.toFixed(2)} (${unit16.area} × ${duesRate})`)
    console.log(`  Migrated Debt: ₱${migratedDebt16.toFixed(2)}`)
    console.log(`  Balance: ₱${balance16.toFixed(2)}`)
    console.log(`  Penalty Eligible: ₱${penaltyEligible16.toFixed(2)}`)
    console.log(`  Penalty (10%): ₱${penalty16.toFixed(2)}`)
    console.log(`  Past Dues for SOA: ₱${balance16.toFixed(2)} + ₱${penalty16.toFixed(2)} = ₱${(balance16 + penalty16).toFixed(2)}`)
    console.log(`  EXPECTED: ₱2,160.00 + ₱216.00 = ₱2,376.00`)
    console.log(`  ${Math.abs(penalty16 - 216) < 0.01 ? '✓ CORRECT' : '✗ WRONG'}`)
  }

  console.log('\n=== Expected SOA Totals ===')
  console.log('M2-2F-6: Current(₱4,621.72) + PastDues(₱421.72) = ₱5,043.44')
  console.log('M2-2F-16: Current(₱3,391.03) + PastDues(₱2,376.00) - Advance(₱0.48) = ₱5,766.55')
}

main().catch(console.error).finally(() => prisma.$disconnect())
