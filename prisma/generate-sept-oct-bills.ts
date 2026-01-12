/**
 * Generate September and October 2025 Bills
 *
 * This script:
 * 1. Generates September 2025 bills (using September readings)
 * 2. Then run import-sept-payments.ts to import payments
 * 3. Then run this script again with --october to generate October bills
 *
 * Run with:
 *   npx tsx prisma/generate-sept-oct-bills.ts           # Generate September bills
 *   npx tsx prisma/generate-sept-oct-bills.ts --october # Generate October bills
 */

import { PrismaClient, BillStatus, UnitType } from '@prisma/client'
import { calculateBill } from '../lib/calculations/billing'

const prisma = new PrismaClient()

async function generateBillsForMonth(billingMonth: string) {
  console.log('='.repeat(60))
  console.log(`GENERATING BILLS FOR ${billingMonth}`)
  console.log('='.repeat(60))

  const tenant = await prisma.tenant.findFirst({
    include: { settings: true }
  })

  if (!tenant || !tenant.settings) {
    console.error('No tenant or settings found!')
    process.exit(1)
  }

  const billingPeriod = new Date(billingMonth + '-01')
  console.log(`\nBilling period: ${billingPeriod.toISOString().slice(0, 7)}`)

  // Check if bills already exist
  const existingBills = await prisma.bill.count({
    where: {
      tenantId: tenant.id,
      billingMonth: billingPeriod
    }
  })

  if (existingBills > 0) {
    console.log(`\nBills already exist for ${billingMonth}. Found ${existingBills} bills.`)
    return
  }

  // Get all units
  const units = await prisma.unit.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
    },
    include: {
      owner: true,
    },
    orderBy: [{ floorLevel: 'asc' }, { unitNumber: 'asc' }],
  })

  console.log(`\nFound ${units.length} active units`)

  // Get readings for this billing period
  const electricReadings = await prisma.electricReading.findMany({
    where: {
      billingPeriod,
      unit: { tenantId: tenant.id },
    },
  })
  const waterReadings = await prisma.waterReading.findMany({
    where: {
      billingPeriod,
      unit: { tenantId: tenant.id },
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

  // Calculate dates
  const year = billingPeriod.getFullYear()
  const month = billingPeriod.getMonth()
  const periodFrom = new Date(year, month - 1, 27)
  const periodTo = new Date(year, month, 26)
  const statementDate = new Date(year, month, 27)
  const dueDate = new Date(year, month + 1, 6)

  console.log(`\nBilling period: ${periodFrom.toDateString()} to ${periodTo.toDateString()}`)
  console.log(`Statement date: ${statementDate.toDateString()}`)
  console.log(`Due date: ${dueDate.toDateString()}`)

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

  for (const unit of units) {
    const electricReading = electricReadings.find(r => r.unitId === unit.id)
    const waterReading = waterReadings.find(r => r.unitId === unit.id)
    const adjustment = adjustments.find(a => a.unitId === unit.id)
    const advanceBalance = advanceBalances.find(a => a.unitId === unit.id)

    if (!electricReading || !waterReading) {
      console.log(`  ${unit.unitNumber}: Missing readings - skipping`)
      continue
    }

    // Calculate bill
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

    // Get previous unpaid balance
    const previousBills = await prisma.bill.findMany({
      where: {
        unitId: unit.id,
        status: { in: ['UNPAID', 'PARTIAL'] },
        billingMonth: { lt: billingPeriod },
      },
    })

    let previousBalance = 0
    let totalPenalties = 0

    for (const prevBill of previousBills) {
      const balance = Number(prevBill.totalAmount) - Number(prevBill.paidAmount)
      previousBalance += balance

      const daysPastDue = Math.floor(
        (statementDate.getTime() - prevBill.dueDate.getTime()) / (1000 * 60 * 60 * 24)
      )

      if (daysPastDue > 0) {
        const monthsOverdue = Math.ceil(daysPastDue / 30)
        let penaltyAmount = 0
        let runningBalance = balance - Number(prevBill.penaltyAmount)

        for (let m = 1; m <= monthsOverdue; m++) {
          const monthPenalty = runningBalance * (Number(settings.penaltyRate) / 100)
          penaltyAmount += monthPenalty
          runningBalance += monthPenalty
        }

        totalPenalties += penaltyAmount
      }
    }

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
    const total = currentCharges + previousBalance + totalPenalties - totalDeductions

    // Generate bill number
    billCounter++
    const billNumber = `MT-${billingPeriod.getFullYear()}${String(
      billingPeriod.getMonth() + 1
    ).padStart(2, '0')}-${String(billCounter).padStart(4, '0')}`

    // Create bill
    const bill = await prisma.bill.create({
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
        penaltyAmount: totalPenalties,
        totalAmount: total,
        paidAmount: 0,
        balance: total,
        status: 'UNPAID' as BillStatus,
      },
    })

    // Update advance balances
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
    console.log(`  ${unit.unitNumber}: ${billNumber} - ₱${total.toLocaleString()}`)
  }

  console.log('\n' + '='.repeat(60))
  console.log('GENERATION COMPLETE')
  console.log('='.repeat(60))
  console.log(`Bills generated: ${billsGenerated}`)
  console.log(`Total amount: ₱${totalAmount.toLocaleString()}`)
}

async function main() {
  const args = process.argv.slice(2)
  const isOctober = args.includes('--october')

  if (isOctober) {
    await generateBillsForMonth('2025-10')
  } else {
    await generateBillsForMonth('2025-09')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
