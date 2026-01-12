/**
 * Generate November 2025 Bills for 2nd Floor Units Only
 *
 * This generates bills based on the November readings we just imported from Excel.
 * We limit to 2F units for testing comparison with Ma'am Rose's Excel.
 */

import { PrismaClient, BillStatus } from '@prisma/client'
import { calculateBill } from '../lib/calculations/billing'

const prisma = new PrismaClient()

async function main() {
  console.log('='.repeat(60))
  console.log('GENERATING NOVEMBER 2025 BILLS FOR 2ND FLOOR')
  console.log('='.repeat(60))

  const tenant = await prisma.tenant.findFirst({
    include: { settings: true }
  })

  if (!tenant || !tenant.settings) {
    console.error('No tenant or settings found!')
    process.exit(1)
  }

  const billingPeriod = new Date(Date.UTC(2025, 10, 1)) // November 2025
  console.log(`\nBilling period: ${billingPeriod.toISOString().slice(0, 7)}`)

  // Check if November bills already exist for 2F units
  const existingBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: billingPeriod,
      unit: { unitNumber: { startsWith: 'M2-2F' } }
    }
  })

  if (existingBills.length > 0) {
    console.log(`\nNovember bills already exist for 2F. Found ${existingBills.length} bills.`)
    console.log('Deleting existing bills to regenerate...')

    await prisma.bill.deleteMany({
      where: {
        tenantId: tenant.id,
        billingMonth: billingPeriod,
        unit: { unitNumber: { startsWith: 'M2-2F' } }
      }
    })
    console.log('Deleted existing November 2F bills.')
  }

  // Get 2F units only
  const units = await prisma.unit.findMany({
    where: {
      tenantId: tenant.id,
      unitNumber: { startsWith: 'M2-2F' },
      isActive: true,
    },
    include: { owner: true },
    orderBy: { unitNumber: 'asc' },
  })

  console.log(`\nFound ${units.length} active 2F units`)

  // Get November readings
  const electricReadings = await prisma.electricReading.findMany({
    where: {
      billingPeriod,
      unit: { tenantId: tenant.id, unitNumber: { startsWith: 'M2-2F' } },
    },
  })
  const waterReadings = await prisma.waterReading.findMany({
    where: {
      billingPeriod,
      unit: { tenantId: tenant.id, unitNumber: { startsWith: 'M2-2F' } },
    },
  })

  console.log(`Electric readings: ${electricReadings.length}`)
  console.log(`Water readings: ${waterReadings.length}`)

  // Get billing adjustments
  const adjustments = await prisma.billingAdjustment.findMany({
    where: {
      tenantId: tenant.id,
      billingPeriod,
    },
  })

  // Get advance balances
  const advanceBalances = await prisma.unitAdvanceBalance.findMany({
    where: { tenantId: tenant.id },
  })

  // Calculate dates - November billing
  // Reading period: Oct 27 - Nov 26
  // Statement date: December 5 (approximate)
  // Due date: December 15 (approximate)
  const periodFrom = new Date(Date.UTC(2025, 9, 27))  // Oct 27
  const periodTo = new Date(Date.UTC(2025, 10, 26))   // Nov 26
  const statementDate = new Date(Date.UTC(2025, 11, 5))  // Dec 5
  const dueDate = new Date(Date.UTC(2025, 11, 15))       // Dec 15

  console.log(`\nBilling period: ${periodFrom.toISOString().slice(0, 10)} to ${periodTo.toISOString().slice(0, 10)}`)
  console.log(`Statement date: ${statementDate.toISOString().slice(0, 10)}`)
  console.log(`Due date: ${dueDate.toISOString().slice(0, 10)}`)

  // Get last bill number
  const lastBill = await prisma.bill.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { billNumber: 'desc' },
  })
  let billCounter = lastBill
    ? parseInt(lastBill.billNumber.split('-').pop() || '0')
    : 0

  const settings = tenant.settings
  let billsGenerated = 0
  let totalAmount = 0

  console.log('\n' + '-'.repeat(80))
  console.log('UNIT'.padEnd(12) + 'ELECTRIC'.padStart(12) + 'WATER'.padStart(12) +
              'DUES'.padStart(12) + 'ADV APPLIED'.padStart(14) + 'TOTAL'.padStart(14))
  console.log('-'.repeat(80))

  for (const unit of units) {
    const electricReading = electricReadings.find(r => r.unitId === unit.id)
    const waterReading = waterReadings.find(r => r.unitId === unit.id)
    const adjustment = adjustments.find(a => a.unitId === unit.id)
    const advanceBalance = advanceBalances.find(a => a.unitId === unit.id)

    if (!electricReading || !waterReading) {
      console.log(`${unit.unitNumber.padEnd(12)} Missing readings - skipping`)
      continue
    }

    // Calculate bill using the billing calculation module
    const billCalc = calculateBill({
      electricConsumption: Number(electricReading.consumption),
      waterConsumption: Number(waterReading.consumption),
      area: Number(unit.area),
      unitType: unit.unitType as 'RESIDENTIAL' | 'COMMERCIAL',
      settings: {
        electricRate: parseFloat(settings.electricRate.toString()),
        electricMinCharge: parseFloat(settings.electricMinCharge.toString()),
        associationDuesRate: parseFloat(settings.associationDuesRate.toString()),
        penaltyRate: parseFloat(settings.penaltyRate.toString()),
        waterSettings: {
          waterResTier1Max: parseFloat(settings.waterResTier1Max.toString()),
          waterResTier1Rate: parseFloat(settings.waterResTier1Rate.toString()),
          waterResTier2Max: parseFloat(settings.waterResTier2Max.toString()),
          waterResTier2Rate: parseFloat(settings.waterResTier2Rate.toString()),
          waterResTier3Max: parseFloat(settings.waterResTier3Max.toString()),
          waterResTier3Rate: parseFloat(settings.waterResTier3Rate.toString()),
          waterResTier4Max: parseFloat(settings.waterResTier4Max.toString()),
          waterResTier4Rate: parseFloat(settings.waterResTier4Rate.toString()),
          waterResTier5Max: parseFloat(settings.waterResTier5Max.toString()),
          waterResTier5Rate: parseFloat(settings.waterResTier5Rate.toString()),
          waterResTier6Max: parseFloat(settings.waterResTier6Max.toString()),
          waterResTier6Rate: parseFloat(settings.waterResTier6Rate.toString()),
          waterResTier7Rate: parseFloat(settings.waterResTier7Rate.toString()),
          waterComTier1Max: parseFloat(settings.waterComTier1Max.toString()),
          waterComTier1Rate: parseFloat(settings.waterComTier1Rate.toString()),
          waterComTier2Max: parseFloat(settings.waterComTier2Max.toString()),
          waterComTier2Rate: parseFloat(settings.waterComTier2Rate.toString()),
          waterComTier3Max: parseFloat(settings.waterComTier3Max.toString()),
          waterComTier3Rate: parseFloat(settings.waterComTier3Rate.toString()),
          waterComTier4Max: parseFloat(settings.waterComTier4Max.toString()),
          waterComTier4Rate: parseFloat(settings.waterComTier4Rate.toString()),
          waterComTier5Max: parseFloat(settings.waterComTier5Max.toString()),
          waterComTier5Rate: parseFloat(settings.waterComTier5Rate.toString()),
          waterComTier6Max: parseFloat(settings.waterComTier6Max.toString()),
          waterComTier6Rate: parseFloat(settings.waterComTier6Rate.toString()),
          waterComTier7Rate: parseFloat(settings.waterComTier7Rate.toString()),
        }
      }
    })

    // Calculate parking fee
    const parkingArea = Number(unit.parkingArea || 0)
    const parkingRate = parseFloat(settings.parkingRate?.toString() || '60')
    const parkingFee = parkingArea * parkingRate

    // Get adjustments
    const spAssessment = Number(adjustment?.spAssessment || 0)
    const discounts = Number(adjustment?.discounts || 0)

    // Get advance balances
    const availableAdvanceDues = Number(advanceBalance?.advanceDues || 0)
    const availableAdvanceUtil = Number(advanceBalance?.advanceUtilities || 0)

    // For November, October bills are already paid, so no previous balance
    // Just apply advances to current charges

    // Calculate advances to apply
    const advanceDuesApplied = Math.min(availableAdvanceDues, billCalc.associationDues)
    const utilityCharges = billCalc.electricAmount + billCalc.waterAmount
    const advanceUtilApplied = Math.min(availableAdvanceUtil, utilityCharges)

    // Calculate total
    const currentCharges = billCalc.electricAmount +
                          billCalc.waterAmount +
                          billCalc.associationDues +
                          parkingFee +
                          spAssessment
    const totalDeductions = discounts + advanceDuesApplied + advanceUtilApplied
    const total = currentCharges - totalDeductions

    // Generate bill number
    billCounter++
    const billNumber = `MT-${billingPeriod.getFullYear()}${String(
      billingPeriod.getMonth() + 1
    ).padStart(2, '0')}-${String(billCounter).padStart(4, '0')}`

    // Create bill
    await prisma.bill.create({
      data: {
        billNumber,
        tenantId: tenant.id,
        unitId: unit.id,
        billingMonth: billingPeriod,
        billingPeriodStart: periodFrom,
        billingPeriodEnd: periodTo,
        statementDate,
        dueDate,
        electricAmount: billCalc.electricAmount,
        waterAmount: billCalc.waterAmount,
        associationDues: billCalc.associationDues,
        parkingFee,
        spAssessment,
        discounts,
        advanceDuesApplied,
        advanceUtilApplied,
        penaltyAmount: 0,
        totalAmount: total,
        paidAmount: 0,
        balance: total,
        status: 'UNPAID' as BillStatus,
      },
    })

    // Update advance balances if applied
    if ((advanceDuesApplied > 0 || advanceUtilApplied > 0) && advanceBalance) {
      await prisma.unitAdvanceBalance.update({
        where: { id: advanceBalance.id },
        data: {
          advanceDues: { decrement: advanceDuesApplied },
          advanceUtilities: { decrement: advanceUtilApplied },
        },
      })
    }

    billsGenerated++
    totalAmount += total

    const advApplied = advanceDuesApplied + advanceUtilApplied
    console.log(
      unit.unitNumber.padEnd(12) +
      `₱${billCalc.electricAmount.toFixed(2)}`.padStart(12) +
      `₱${billCalc.waterAmount.toFixed(2)}`.padStart(12) +
      `₱${billCalc.associationDues.toFixed(2)}`.padStart(12) +
      `₱${advApplied.toFixed(2)}`.padStart(14) +
      `₱${total.toFixed(2)}`.padStart(14)
    )
  }

  console.log('-'.repeat(80))
  console.log('\n' + '='.repeat(60))
  console.log('GENERATION COMPLETE')
  console.log('='.repeat(60))
  console.log(`Bills generated: ${billsGenerated}`)
  console.log(`Total amount: ₱${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
