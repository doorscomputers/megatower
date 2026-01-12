/**
 * Update Unit Areas from Excel File
 * Then regenerate October bills with correct areas
 */

import * as XLSX from 'xlsx'
import { PrismaClient, BillStatus } from '@prisma/client'
import { calculateBill } from '../lib/calculations/billing'

const prisma = new PrismaClient()
const EXCEL_PATH = 'C:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx'

// Map sheet names to unit numbers
const sheetToUnit: Record<string, string> = {
  '1': 'M2-2F-1',
  '2': 'M2-2F-2',
  '3': 'M2-2F-3',
  '5': 'M2-2F-5',
  '6': 'M2-2F-6',
  '7': 'M2-2F-7',
  '8': 'M2-2F-8',
  '9': 'M2-2F-9',
  '10': 'M2-2F-10',
  '11': 'M2-2F-11',
  '12': 'M2-2F-12',
  '15': 'M2-2F-15',
  '16': 'M2-2F-16',
  '17': 'M2-2F-17',
  '18': 'M2-2F-18',
  '19': 'M2-2F-19',
  '20': 'M2-2F-20',
  '21': 'M2-2F-21',
  '22': 'M2-2F-22',
}

interface UnitAreaData {
  sheetName: string
  unitNumber: string
  area: number
  duesAmount: number
}

function extractAreaFromSheet(wb: XLSX.WorkBook, sheetName: string): UnitAreaData | null {
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return null

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]

  // Row 24 (index 23): Association Dues - H=Rate (60), J=Area, K=Amount
  const duesRow = data[23] || []
  const area = parseFloat(duesRow[9]) || 0  // Column J (index 9)
  const duesAmount = parseFloat(duesRow[10]) || 0  // Column K (index 10)

  if (area === 0) return null

  return {
    sheetName,
    unitNumber: sheetToUnit[sheetName] || `M2-2F-${sheetName}`,
    area,
    duesAmount,
  }
}

async function main() {
  console.log('='.repeat(60))
  console.log('UPDATING UNIT AREAS FROM EXCEL')
  console.log('='.repeat(60))

  // Read Excel
  const wb = XLSX.readFile(EXCEL_PATH)
  console.log(`\nReading from: ${EXCEL_PATH}`)

  // Get tenant
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found')
    return
  }

  // Extract areas from all sheets
  const areaUpdates: UnitAreaData[] = []

  for (const sheetName of Object.keys(sheetToUnit)) {
    const areaData = extractAreaFromSheet(wb, sheetName)
    if (areaData) {
      areaUpdates.push(areaData)
    }
  }

  console.log(`\nFound ${areaUpdates.length} units with area data`)
  console.log('\n' + 'Unit'.padEnd(12) + 'Area (sqm)'.padStart(12) + 'Dues Amount'.padStart(14))
  console.log('-'.repeat(38))

  // Update each unit
  let updatedCount = 0
  for (const data of areaUpdates) {
    const unit = await prisma.unit.findFirst({
      where: {
        tenantId: tenant.id,
        unitNumber: data.unitNumber
      }
    })

    if (unit) {
      const currentArea = Number(unit.area)
      if (currentArea !== data.area) {
        await prisma.unit.update({
          where: { id: unit.id },
          data: { area: data.area }
        })
        console.log(
          data.unitNumber.padEnd(12) +
          data.area.toString().padStart(12) +
          ('₱' + data.duesAmount.toFixed(2)).padStart(14) +
          ` (was ${currentArea})`
        )
        updatedCount++
      } else {
        console.log(
          data.unitNumber.padEnd(12) +
          data.area.toString().padStart(12) +
          ('₱' + data.duesAmount.toFixed(2)).padStart(14) +
          ' (unchanged)'
        )
      }
    } else {
      console.log(`  ${data.unitNumber}: Unit not found in database`)
    }
  }

  console.log(`\nUpdated ${updatedCount} unit areas`)

  // Now regenerate October bills
  console.log('\n' + '='.repeat(60))
  console.log('REGENERATING OCTOBER 2025 BILLS')
  console.log('='.repeat(60))

  const octBillingPeriod = new Date('2025-10-01')

  // Delete existing October bills
  const existingBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: octBillingPeriod
    },
    select: { id: true }
  })

  if (existingBills.length > 0) {
    // Delete bill payments first
    await prisma.billPayment.deleteMany({
      where: { billId: { in: existingBills.map(b => b.id) } }
    })
    // Delete bills
    await prisma.bill.deleteMany({
      where: { id: { in: existingBills.map(b => b.id) } }
    })
    console.log(`\nDeleted ${existingBills.length} existing October bills`)
  }

  // Get settings
  const settings = await prisma.tenantSettings.findFirst({
    where: { tenantId: tenant.id }
  })
  if (!settings) {
    console.error('No settings found')
    return
  }

  console.log(`\nUsing electric rate: ₱${settings.electricRate}`)
  console.log(`Using association dues rate: ₱${settings.associationDuesRate}/sqm`)

  // Get units with readings
  const units = await prisma.unit.findMany({
    where: {
      tenantId: tenant.id,
      isActive: true,
    },
    include: { owner: true },
    orderBy: [{ floorLevel: 'asc' }, { unitNumber: 'asc' }],
  })

  // Get October readings
  const electricReadings = await prisma.electricReading.findMany({
    where: { billingPeriod: octBillingPeriod, unit: { tenantId: tenant.id } },
  })
  const waterReadings = await prisma.waterReading.findMany({
    where: { billingPeriod: octBillingPeriod, unit: { tenantId: tenant.id } },
  })

  // Get adjustments and advances
  const adjustments = await prisma.billingAdjustment.findMany({
    where: { tenantId: tenant.id, billingPeriod: octBillingPeriod },
  })
  const advanceBalances = await prisma.unitAdvanceBalance.findMany({
    where: { tenantId: tenant.id },
  })

  // Calculate dates
  const year = octBillingPeriod.getFullYear()
  const month = octBillingPeriod.getMonth()
  const periodFrom = new Date(year, month - 1, 27)
  const periodTo = new Date(year, month, 26)
  const statementDate = new Date(year, month, 27)
  const dueDate = new Date(year, month + 1, 6)

  // Get bill counter
  const lastBill = await prisma.bill.findFirst({
    where: { tenantId: tenant.id, billingMonth: { lt: octBillingPeriod } },
    orderBy: { billNumber: 'desc' },
  })
  let billCounter = lastBill ? parseInt(lastBill.billNumber.split('-').pop() || '0') : 0

  let billsGenerated = 0
  let totalAmount = 0

  console.log('\n' + 'Unit'.padEnd(12) + 'Area'.padStart(8) + 'Electric'.padStart(12) + 'Water'.padStart(10) + 'Dues'.padStart(10) + 'Adv.Applied'.padStart(12) + 'Total'.padStart(12))
  console.log('-'.repeat(76))

  for (const unit of units) {
    const electricReading = electricReadings.find(r => r.unitId === unit.id)
    const waterReading = waterReadings.find(r => r.unitId === unit.id)

    if (!electricReading || !waterReading) continue

    const adjustment = adjustments.find(a => a.unitId === unit.id)
    const advanceBalance = advanceBalances.find(a => a.unitId === unit.id)

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

    // Get adjustments and advances
    const spAssessment = Number(adjustment?.spAssessment || 0)
    const discounts = Number(adjustment?.discounts || 0)
    const availableAdvanceDues = Number(advanceBalance?.advanceDues || 0)
    const availableAdvanceUtil = Number(advanceBalance?.advanceUtilities || 0)

    // Get previous unpaid balance
    const previousBills = await prisma.bill.findMany({
      where: {
        unitId: unit.id,
        status: { in: ['UNPAID', 'PARTIAL'] },
        billingMonth: { lt: octBillingPeriod },
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
    const totalAdvanceApplied = advanceDuesApplied + advanceUtilApplied

    // Calculate parking
    const parkingArea = Number(unit.parkingArea || 0)
    const parkingRate = parseFloat(settings.parkingRate?.toString() || '60')
    const parkingFee = parkingArea * parkingRate

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
    const billNumber = `MT-${octBillingPeriod.getFullYear()}${String(
      octBillingPeriod.getMonth() + 1
    ).padStart(2, '0')}-${String(billCounter).padStart(4, '0')}`

    // Create bill
    await prisma.bill.create({
      data: {
        billNumber,
        tenantId: tenant.id,
        unitId: unit.id,
        billingMonth: octBillingPeriod,
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

    console.log(
      unit.unitNumber.padEnd(12) +
      Number(unit.area).toString().padStart(8) +
      ('₱' + billCalc.electricAmount.toFixed(2)).padStart(12) +
      ('₱' + billCalc.waterAmount.toFixed(2)).padStart(10) +
      ('₱' + billCalc.associationDues.toFixed(2)).padStart(10) +
      ('₱' + totalAdvanceApplied.toFixed(2)).padStart(12) +
      ('₱' + total.toFixed(2)).padStart(12)
    )
  }

  console.log('\n' + '='.repeat(60))
  console.log('GENERATION COMPLETE')
  console.log('='.repeat(60))
  console.log(`Bills generated: ${billsGenerated}`)
  console.log(`Total amount: ₱${totalAmount.toLocaleString()}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
