/**
 * Generate December 2025 bills
 * Uses November 2025 readings for consumption calculations
 */
import { PrismaClient } from '@prisma/client'
import { calculateBill } from '../lib/calculations/billing'

const prisma = new PrismaClient()

async function main() {
  const billingMonth = '2025-12'
  const [parsedYear, parsedMonth] = billingMonth.split('-').map(Number)
  const billingPeriod = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1))

  // IMPORTANT: Bill for Month X uses readings from Month X-1
  const readingsPeriod = new Date(Date.UTC(parsedYear, parsedMonth - 2, 1)) // November 2025

  console.log('=== Generating December 2025 Bills ===')
  console.log('Billing Period:', billingPeriod.toISOString().slice(0, 10))
  console.log('Readings Period:', readingsPeriod.toISOString().slice(0, 10))

  // Get tenant
  const tenant = await prisma.tenant.findFirst({
    include: { settings: true }
  })

  if (!tenant || !tenant.settings) {
    console.error('Tenant not found')
    return
  }

  console.log('Tenant:', tenant.name)

  // Check if December bills already exist
  const existingBills = await prisma.bill.count({
    where: {
      tenantId: tenant.id,
      billingMonth: billingPeriod,
      billType: { not: 'OPENING_BALANCE' }
    }
  })

  if (existingBills > 0) {
    console.log(`\n${existingBills} December bills already exist. Skipping generation.`)
    return
  }

  // Get November readings
  const electricReadings = await prisma.electricReading.findMany({
    where: { billingPeriod: readingsPeriod }
  })

  const waterReadings = await prisma.waterReading.findMany({
    where: { billingPeriod: readingsPeriod }
  })

  console.log('\nNovember Readings:')
  console.log('  Electric:', electricReadings.length)
  console.log('  Water:', waterReadings.length)

  // Get all active units
  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id, isActive: true },
    include: { owner: true },
    orderBy: [{ floorLevel: 'asc' }, { unitNumber: 'asc' }]
  })

  console.log('  Units:', units.length)

  // Calculate billing period dates
  const periodFrom = new Date(parsedYear, parsedMonth - 2, 27) // Nov 27
  const periodTo = new Date(parsedYear, parsedMonth - 1, 26)   // Dec 26
  const statementDate = new Date(parsedYear, parsedMonth - 1, 27)
  const dueDate = new Date(parsedYear, parsedMonth, 6)

  console.log('\nBilling Dates:')
  console.log('  Period:', periodFrom.toLocaleDateString(), 'to', periodTo.toLocaleDateString())
  console.log('  Statement Date:', statementDate.toLocaleDateString())
  console.log('  Due Date:', dueDate.toLocaleDateString())

  // Get last bill number
  const lastBill = await prisma.bill.findFirst({
    where: { tenantId: tenant.id },
    orderBy: { billNumber: 'desc' }
  })
  let billCounter = lastBill ? parseInt(lastBill.billNumber.split('-').pop() || '0') : 0

  // Get billing adjustments and advance balances
  const billingAdjustments = await prisma.billingAdjustment.findMany({
    where: { tenantId: tenant.id, billingPeriod }
  })

  const advanceBalances = await prisma.unitAdvanceBalance.findMany({
    where: { tenantId: tenant.id }
  })

  console.log('\n=== Generating Bills ===\n')

  let generatedCount = 0
  let totalAmount = 0

  for (const unit of units) {
    const electricReading = electricReadings.find(r => r.unitId === unit.id)
    const waterReading = waterReadings.find(r => r.unitId === unit.id)
    const adjustment = billingAdjustments.find(a => a.unitId === unit.id)
    const advanceBalance = advanceBalances.find(a => a.unitId === unit.id)

    // Calculate parking fee
    const parkingArea = Number(unit.parkingArea || 0)
    const parkingRate = parseFloat(tenant.settings.parkingRate?.toString() || '60')
    const parkingFee = parkingArea * parkingRate

    // Get adjustment values
    const spAssessment = Number(adjustment?.spAssessment || 0)
    const discounts = Number(adjustment?.discounts || 0)

    // Get advance values
    const availableAdvanceDues = Number(advanceBalance?.advanceDues || 0)
    const availableAdvanceUtil = Number(advanceBalance?.advanceUtilities || 0)

    // Calculate bill using lib function
    const billCalculation = calculateBill({
      electricConsumption: Number(electricReading?.consumption || 0),
      waterConsumption: Number(waterReading?.consumption || 0),
      area: Number(unit.area),
      unitType: unit.unitType as 'RESIDENTIAL' | 'COMMERCIAL',
      settings: {
        electricRate: parseFloat(tenant.settings.electricRate.toString()),
        electricMinCharge: parseFloat(tenant.settings.electricMinCharge.toString()),
        associationDuesRate: parseFloat(tenant.settings.associationDuesRate.toString()),
        penaltyRate: parseFloat(tenant.settings.penaltyRate.toString()),
        waterSettings: {
          waterResTier1Max: parseFloat(tenant.settings.waterResTier1Max.toString()),
          waterResTier1Rate: parseFloat(tenant.settings.waterResTier1Rate.toString()),
          waterResTier2Max: parseFloat(tenant.settings.waterResTier2Max.toString()),
          waterResTier2Rate: parseFloat(tenant.settings.waterResTier2Rate.toString()),
          waterResTier3Max: parseFloat(tenant.settings.waterResTier3Max.toString()),
          waterResTier3Rate: parseFloat(tenant.settings.waterResTier3Rate.toString()),
          waterResTier4Max: parseFloat(tenant.settings.waterResTier4Max.toString()),
          waterResTier4Rate: parseFloat(tenant.settings.waterResTier4Rate.toString()),
          waterResTier5Max: parseFloat(tenant.settings.waterResTier5Max.toString()),
          waterResTier5Rate: parseFloat(tenant.settings.waterResTier5Rate.toString()),
          waterResTier6Max: parseFloat(tenant.settings.waterResTier6Max.toString()),
          waterResTier6Rate: parseFloat(tenant.settings.waterResTier6Rate.toString()),
          waterResTier7Rate: parseFloat(tenant.settings.waterResTier7Rate.toString()),
          waterComTier1Max: parseFloat(tenant.settings.waterComTier1Max.toString()),
          waterComTier1Rate: parseFloat(tenant.settings.waterComTier1Rate.toString()),
          waterComTier2Max: parseFloat(tenant.settings.waterComTier2Max.toString()),
          waterComTier2Rate: parseFloat(tenant.settings.waterComTier2Rate.toString()),
          waterComTier3Max: parseFloat(tenant.settings.waterComTier3Max.toString()),
          waterComTier3Rate: parseFloat(tenant.settings.waterComTier3Rate.toString()),
          waterComTier4Max: parseFloat(tenant.settings.waterComTier4Max.toString()),
          waterComTier4Rate: parseFloat(tenant.settings.waterComTier4Rate.toString()),
          waterComTier5Max: parseFloat(tenant.settings.waterComTier5Max.toString()),
          waterComTier5Rate: parseFloat(tenant.settings.waterComTier5Rate.toString()),
          waterComTier6Max: parseFloat(tenant.settings.waterComTier6Max.toString()),
          waterComTier6Rate: parseFloat(tenant.settings.waterComTier6Rate.toString()),
          waterComTier7Rate: parseFloat(tenant.settings.waterComTier7Rate.toString()),
        }
      }
    })

    // Calculate how much advance to apply
    const advanceDuesApplied = Math.min(availableAdvanceDues, billCalculation.associationDues)
    const utilityCharges = billCalculation.electricAmount + billCalculation.waterAmount
    const advanceUtilApplied = Math.min(availableAdvanceUtil, utilityCharges)

    // Calculate total
    const currentCharges = billCalculation.electricAmount +
                          billCalculation.waterAmount +
                          billCalculation.associationDues +
                          parkingFee +
                          spAssessment
    const totalDeductions = discounts + advanceDuesApplied + advanceUtilApplied
    const total = currentCharges - totalDeductions

    // Generate bill number
    billCounter++
    const billNumber = `MT-${parsedYear}${String(parsedMonth).padStart(2, '0')}-${String(billCounter).padStart(4, '0')}`

    // Create the bill
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
        electricAmount: billCalculation.electricAmount,
        waterAmount: billCalculation.waterAmount,
        associationDues: billCalculation.associationDues,
        parkingFee,
        spAssessment,
        discounts,
        advanceDuesApplied,
        advanceUtilApplied,
        penaltyAmount: 0,
        totalAmount: total,
        paidAmount: 0,
        balance: total,
        status: 'UNPAID'
      }
    })

    // Update advance balance if applied
    if (advanceDuesApplied > 0 || advanceUtilApplied > 0) {
      if (advanceBalance) {
        await prisma.unitAdvanceBalance.update({
          where: { id: advanceBalance.id },
          data: {
            advanceDues: { decrement: advanceDuesApplied },
            advanceUtilities: { decrement: advanceUtilApplied }
          }
        })
      }
    }

    generatedCount++
    totalAmount += total

    // Log specific units we're tracking
    if (['M2-2F-3', 'M2-2F-5', 'M2-2F-6'].includes(unit.unitNumber)) {
      console.log(`${unit.unitNumber}:`)
      console.log(`  Electric: ${Number(electricReading?.consumption || 0)} kWh × ₱${tenant.settings.electricRate} = ₱${billCalculation.electricAmount.toFixed(2)}`)
      console.log(`  Water: ${Number(waterReading?.consumption || 0)} cu.m = ₱${billCalculation.waterAmount.toFixed(2)}`)
      console.log(`  Dues: ${Number(unit.area)} sqm × ₱${tenant.settings.associationDuesRate} = ₱${billCalculation.associationDues.toFixed(2)}`)
      console.log(`  Parking: ${parkingArea} sqm × ₱${parkingRate} = ₱${parkingFee.toFixed(2)}`)
      console.log(`  Total: ₱${total.toFixed(2)}`)
      console.log()
    }
  }

  console.log('=== Summary ===')
  console.log(`Generated: ${generatedCount} bills`)
  console.log(`Total Amount: ₱${totalAmount.toFixed(2)}`)

  // Verify counts
  const decBillCount = await prisma.bill.count({
    where: { billingMonth: billingPeriod }
  })
  console.log(`\nDecember 2025 bills in database: ${decBillCount}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
