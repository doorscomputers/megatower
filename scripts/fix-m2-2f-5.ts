import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('=== Fixing M2-2F-5 Bills ===\n')

  // Get the unit
  const unit = await prisma.unit.findFirst({
    where: { unitNumber: 'M2-2F-5' },
    include: { owner: true }
  })

  if (!unit) {
    console.error('Unit M2-2F-5 not found!')
    return
  }

  console.log(`Unit: ${unit.unitNumber}`)
  console.log(`Owner: ${unit.owner?.lastName}, ${unit.owner?.firstName}`)
  console.log(`Current SP Assessment: ${unit.hasSpAssessment}`)
  console.log('')

  // Get tenant settings
  const tenant = await prisma.tenant.findFirst({
    include: { settings: true }
  })

  if (!tenant?.settings) {
    console.error('Tenant settings not found!')
    return
  }

  // SP Assessment Rate is ₱849.10 per Excel
  const spAssessmentRate = 849.10
  console.log(`SP Assessment Rate: ₱${spAssessmentRate}`)

  // ============================================
  // STEP 1: Fix September Bill
  // ============================================
  console.log('\n--- STEP 1: Fixing September Bill ---')

  const septBill = await prisma.bill.findFirst({
    where: {
      unitId: unit.id,
      billingMonth: new Date('2025-09-01')
    }
  })

  if (!septBill) {
    console.error('September bill not found!')
    return
  }

  console.log('Current September Bill:')
  console.log(`  Electric: ₱${Number(septBill.electricAmount).toFixed(2)}`)
  console.log(`  Water: ₱${Number(septBill.waterAmount).toFixed(2)}`)
  console.log(`  Dues: ₱${Number(septBill.associationDues).toFixed(2)}`)
  console.log(`  Penalty: ₱${Number(septBill.penaltyAmount).toFixed(2)}`)
  console.log(`  Total: ₱${Number(septBill.totalAmount).toFixed(2)}`)

  // Excel values for September:
  // Electric: ₱2,196.48 (not ₱2,101.44)
  // Water: ₱370.00 (correct)
  // Dues: ₱2,700.00 (correct)
  // Total base: ₱5,266.48

  const correctSeptElectric = 2196.48
  const correctSeptWater = 370.00
  const correctSeptDues = 2700.00
  const correctSeptTotal = correctSeptElectric + correctSeptWater + correctSeptDues // = 5266.48

  console.log('\nCorrected September Bill (from Excel):')
  console.log(`  Electric: ₱${correctSeptElectric.toFixed(2)}`)
  console.log(`  Water: ₱${correctSeptWater.toFixed(2)}`)
  console.log(`  Dues: ₱${correctSeptDues.toFixed(2)}`)
  console.log(`  Total: ₱${correctSeptTotal.toFixed(2)}`)

  // Update September bill
  await prisma.bill.update({
    where: { id: septBill.id },
    data: {
      electricAmount: correctSeptElectric,
      waterAmount: correctSeptWater,
      associationDues: correctSeptDues,
      penaltyAmount: 0, // No penalty on September itself
      totalAmount: correctSeptTotal,
      balance: correctSeptTotal,
      status: 'UNPAID'
    }
  })

  console.log('\n✓ September bill updated!')

  // ============================================
  // STEP 2: Enable SP Assessment for this unit
  // ============================================
  console.log('\n--- STEP 2: Enabling SP Assessment ---')

  await prisma.unit.update({
    where: { id: unit.id },
    data: { hasSpAssessment: true }
  })

  console.log('✓ SP Assessment enabled for M2-2F-5')

  // ============================================
  // STEP 3: Delete October Bill
  // ============================================
  console.log('\n--- STEP 3: Deleting October Bill ---')

  const octBill = await prisma.bill.findFirst({
    where: {
      unitId: unit.id,
      billingMonth: new Date('2025-10-01')
    }
  })

  if (octBill) {
    await prisma.bill.delete({
      where: { id: octBill.id }
    })
    console.log('✓ October bill deleted')
  } else {
    console.log('No October bill found to delete')
  }

  // ============================================
  // STEP 4: Calculate and Create Correct October Bill
  // ============================================
  console.log('\n--- STEP 4: Creating Correct October Bill ---')

  // October current charges (from Excel):
  const octElectric = 1826.82
  const octWater = 370.00
  const octDues = 2700.00
  const octParking = 0 // No parking for this unit
  const octSpAssessment = spAssessmentRate // ₱849.10
  const octCurrentCharges = octElectric + octWater + octDues + octParking + octSpAssessment

  // Previous balance (September unpaid)
  const previousBalance = correctSeptTotal // ₱5,266.48

  // Penalty: 10% of unpaid September balance
  const penalty = previousBalance * 0.10 // ₱526.65

  // Total Past Dues
  const totalPastDues = previousBalance + penalty // ₱5,793.13

  // Grand Total
  const octTotal = octCurrentCharges + totalPastDues // ₱11,539.05

  console.log('October Bill Calculation:')
  console.log('  Current Charges:')
  console.log(`    Electric: ₱${octElectric.toFixed(2)}`)
  console.log(`    Water: ₱${octWater.toFixed(2)}`)
  console.log(`    Dues: ₱${octDues.toFixed(2)}`)
  console.log(`    Parking: ₱${octParking.toFixed(2)}`)
  console.log(`    SP Assessment: ₱${octSpAssessment.toFixed(2)}`)
  console.log(`    Subtotal: ₱${octCurrentCharges.toFixed(2)}`)
  console.log('  Past Dues:')
  console.log(`    September Balance: ₱${previousBalance.toFixed(2)}`)
  console.log(`    Penalty (10%): ₱${penalty.toFixed(2)}`)
  console.log(`    Total Past Dues: ₱${totalPastDues.toFixed(2)}`)
  console.log(`  GRAND TOTAL: ₱${octTotal.toFixed(2)}`)

  // Billing period dates
  const billingPeriod = new Date('2025-10-01')
  const periodFrom = new Date(2025, 8, 27) // Sept 27
  const periodTo = new Date(2025, 9, 26)   // Oct 26
  const statementDate = new Date(2025, 9, 5) // Oct 5
  const dueDate = new Date(2025, 9, 15)    // Oct 15

  // Generate bill number
  const lastBill = await prisma.bill.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { billNumber: 'desc' }
  })

  const billCounter = lastBill
    ? parseInt(lastBill.billNumber.split('-').pop() || '0') + 1
    : 1

  const billNumber = `MT-202510-${String(billCounter).padStart(4, '0')}`

  // Create the corrected October bill
  const newOctBill = await prisma.bill.create({
    data: {
      billNumber,
      tenantId: tenant.id,
      unitId: unit.id,
      billingMonth: billingPeriod,
      billingPeriodStart: periodFrom,
      billingPeriodEnd: periodTo,
      statementDate,
      dueDate,
      electricAmount: octElectric,
      waterAmount: octWater,
      associationDues: octDues,
      parkingFee: octParking,
      spAssessment: octSpAssessment,
      penaltyAmount: penalty,
      totalAmount: octTotal,
      paidAmount: 0,
      balance: octTotal,
      status: 'UNPAID'
    }
  })

  console.log(`\n✓ October bill created: ${newOctBill.billNumber}`)
  console.log(`  Total: ₱${Number(newOctBill.totalAmount).toFixed(2)}`)

  // ============================================
  // VERIFICATION
  // ============================================
  console.log('\n=== VERIFICATION ===')
  console.log(`Expected Total (from Excel): ₱11,539.05`)
  console.log(`Calculated Total: ₱${octTotal.toFixed(2)}`)
  console.log(`Match: ${Math.abs(octTotal - 11539.05) < 0.01 ? '✓ YES' : '✗ NO'}`)

  console.log('\n=== FIX COMPLETE ===')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
