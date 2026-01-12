/**
 * Script to clear 2F test data and import November opening balances from Excel
 *
 * Usage: npx tsx scripts/import-2f-november-balances.ts
 */

import { PrismaClient, BillStatus, BillType } from '@prisma/client'
import * as XLSX from 'xlsx'
import { createBillingPeriod, createPhilippineDate } from '../lib/timezone'

const prisma = new PrismaClient()

const EXCEL_FILE = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/NOV 2025 MEGATOWER II/2ND FLOOR (t2).xlsx'
const FLOOR_LEVEL = '2F'
const BUILDING_PREFIX = 'M2' // Megatower 2
const BILLING_MONTH = createBillingPeriod(2025, 11) // November 2025 (Philippine Time)

// Sheets to process (skip "(A)" suffix sheets which are alternates)
const SHEETS_TO_PROCESS = ['1', '2', '3', '5', '6', '7', '8', '9', '10', '11', '12', '15', '16', '17', '18', '19', '20', '21', '22']

interface ExtractedData {
  unitNumber: string
  ownerName: string
  totalAmountDue: number
  electricAmount: number
  waterAmount: number
  associationDues: number
  pastDues: number  // Past dues from previous months
  // Readings data (October readings - becomes baseline for November)
  electricPrevReading: number
  electricPresReading: number
  electricConsumption: number
  waterPrevReading: number
  waterPresReading: number
  waterConsumption: number
}

async function clearExisting2FData() {
  console.log('\n=== CLEARING EXISTING 2F DATA ===')

  // Get all 2F unit IDs
  const units = await prisma.unit.findMany({
    where: { floorLevel: FLOOR_LEVEL },
    select: { id: true, unitNumber: true }
  })

  const unitIds = units.map(u => u.id)
  console.log(`Found ${units.length} units on ${FLOOR_LEVEL}:`, units.map(u => u.unitNumber).join(', '))

  if (unitIds.length === 0) {
    console.log('No 2F units found!')
    return
  }

  // Delete in correct order due to foreign keys
  // 1. BillPayment (references Bill and Payment)
  const billPayments = await prisma.billPayment.deleteMany({
    where: { bill: { unitId: { in: unitIds } } }
  })
  console.log(`Deleted ${billPayments.count} BillPayment records`)

  // 2. Penalties (references Bill)
  const penalties = await prisma.penalty.deleteMany({
    where: { bill: { unitId: { in: unitIds } } }
  })
  console.log(`Deleted ${penalties.count} Penalty records`)

  // 3. SOADocument (has unitId directly)
  const soaDocs = await prisma.sOADocument.deleteMany({
    where: { unitId: { in: unitIds } }
  })
  console.log(`Deleted ${soaDocs.count} SOADocument records`)

  // 4. Payments (for these units)
  const payments = await prisma.payment.deleteMany({
    where: { unitId: { in: unitIds } }
  })
  console.log(`Deleted ${payments.count} Payment records`)

  // 5. Bills
  const bills = await prisma.bill.deleteMany({
    where: { unitId: { in: unitIds } }
  })
  console.log(`Deleted ${bills.count} Bill records`)

  // 6. Electric Readings
  const electricReadings = await prisma.electricReading.deleteMany({
    where: { unitId: { in: unitIds } }
  })
  console.log(`Deleted ${electricReadings.count} ElectricReading records`)

  // 7. Water Readings
  const waterReadings = await prisma.waterReading.deleteMany({
    where: { unitId: { in: unitIds } }
  })
  console.log(`Deleted ${waterReadings.count} WaterReading records`)

  console.log('✅ Cleared all 2F test data')
}

function extractDataFromSheet(worksheet: XLSX.WorkSheet, sheetName: string): ExtractedData | null {
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

  // Unit number format: M2-2F-{sheetName}
  const unitNumber = `${BUILDING_PREFIX}-${FLOOR_LEVEL}-${sheetName}`

  // Extract owner name from row 11 (index 10), column F onwards
  let ownerName = ''
  if (data[10] && data[10][5]) {
    ownerName = String(data[10][5]).trim()
  }

  // Extract amounts and readings
  let totalAmountDue = 0
  let electricAmount = 0
  let waterAmount = 0
  let associationDues = 0

  // Electric readings: Row 17 (index 16)
  // Pres=index 7, Prev=index 9, Cons=index 11
  let electricPresReading = 0
  let electricPrevReading = 0
  let electricConsumption = 0
  if (data[16]) {
    electricPresReading = parseFloat(String(data[16][7])) || 0
    electricPrevReading = parseFloat(String(data[16][9])) || 0
    electricConsumption = parseFloat(String(data[16][11])) || 0
  }

  // Electric amount: Row 17 (index 16), column S (index 18)
  if (data[16] && data[16][18]) {
    electricAmount = parseFloat(String(data[16][18])) || 0
  }

  // Water readings: Row 20 (index 19)
  // Pres=index 7, Prev=index 9, Cons=index 11
  let waterPresReading = 0
  let waterPrevReading = 0
  let waterConsumption = 0
  if (data[19]) {
    waterPresReading = parseFloat(String(data[19][7])) || 0
    waterPrevReading = parseFloat(String(data[19][9])) || 0
    waterConsumption = parseFloat(String(data[19][11])) || 0
  }

  // Water amount: Row 20 (index 19), column S (index 18)
  if (data[19] && data[19][18]) {
    waterAmount = parseFloat(String(data[19][18])) || 0
  }

  // Association dues: Row 25 (index 24), column S (index 18)
  if (data[24] && data[24][18]) {
    associationDues = parseFloat(String(data[24][18])) || 0
  }

  // Get TOTAL PAST DUES from Row 37 (index 36), column 18
  let pastDues = 0
  if (data[36] && data[36][18]) {
    pastDues = parseFloat(String(data[36][18])) || 0
  }

  // Get correct TOTAL AMOUNT DUE from Row 45 (index 44), column 17
  // This is the definitive total that includes past dues, penalties, discounts, etc.
  if (data[44] && data[44][17]) {
    totalAmountDue = parseFloat(String(data[44][17])) || 0
  }

  // Fallback: search for "TOTAL AMOUNT DUE" if Row 45 is empty
  if (totalAmountDue === 0) {
    for (let i = 40; i < Math.min(data.length, 60); i++) {
      const row = data[i]
      if (!row) continue

      const rowText = row.join(' ').toUpperCase()
      if (rowText.includes('TOTAL AMOUNT DUE')) {
        for (let j = 0; j < row.length; j++) {
          const val = row[j]
          if (typeof val === 'number' && val > 0) {
            totalAmountDue = val
            break
          }
        }
        if (totalAmountDue > 0) break
      }
    }
  }

  // Last fallback: sum of components + past dues
  if (totalAmountDue === 0) {
    totalAmountDue = electricAmount + waterAmount + associationDues + pastDues
  }

  console.log(`  Sheet ${sheetName}: ${unitNumber} - Owner: ${ownerName.substring(0, 30)}...`)
  console.log(`    Electric: Prev=${electricPrevReading}, Pres=${electricPresReading}, Cons=${electricConsumption}`)
  console.log(`    Water: Prev=${waterPrevReading}, Pres=${waterPresReading}, Cons=${waterConsumption}`)
  if (pastDues > 0) {
    console.log(`    Past Dues: ₱${pastDues.toFixed(2)} ***`)
  }
  console.log(`    Total Due: ₱${totalAmountDue.toFixed(2)}`)

  return {
    unitNumber,
    ownerName,
    totalAmountDue,
    electricAmount,
    waterAmount,
    associationDues,
    pastDues,
    electricPrevReading,
    electricPresReading,
    electricConsumption,
    waterPrevReading,
    waterPresReading,
    waterConsumption
  }
}

async function importNovemberBalances() {
  console.log('\n=== IMPORTING NOVEMBER BALANCES FROM EXCEL ===')
  console.log(`File: ${EXCEL_FILE}`)

  const workbook = XLSX.readFile(EXCEL_FILE)
  console.log(`Found ${workbook.SheetNames.length} sheets`)

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    throw new Error('No tenant found!')
  }

  const extractedData: ExtractedData[] = []

  for (const sheetName of SHEETS_TO_PROCESS) {
    if (!workbook.SheetNames.includes(sheetName)) {
      console.log(`  Skipping sheet ${sheetName} - not found`)
      continue
    }

    const worksheet = workbook.Sheets[sheetName]
    const data = extractDataFromSheet(worksheet, sheetName)
    if (data && data.totalAmountDue > 0) {
      extractedData.push(data)
    }
  }

  console.log(`\nExtracted data for ${extractedData.length} units`)

  // Create bills and readings for each unit
  let billsCreated = 0
  let readingsCreated = 0
  let skipped = 0

  // October billing period (for the readings) - Philippine Time
  const OCTOBER_BILLING_PERIOD = createBillingPeriod(2025, 10) // October 2025
  const READING_DATE = createPhilippineDate(2025, 10, 26) // Oct 26, 2025

  for (const data of extractedData) {
    // Find the unit
    const unit = await prisma.unit.findFirst({
      where: { unitNumber: data.unitNumber, floorLevel: FLOOR_LEVEL }
    })

    if (!unit) {
      console.log(`  ⚠ Unit ${data.unitNumber} not found in database - skipping`)
      skipped++
      continue
    }

    // Create October Electric Reading (baseline for November)
    if (data.electricPresReading > 0) {
      await prisma.electricReading.create({
        data: {
          unitId: unit.id,
          readingDate: READING_DATE,
          billingPeriod: OCTOBER_BILLING_PERIOD,
          previousReading: data.electricPrevReading,
          presentReading: data.electricPresReading,
          consumption: data.electricConsumption,
          remarks: 'Imported from Excel - October 2025 baseline'
        }
      })
      readingsCreated++
    }

    // Create October Water Reading (baseline for November)
    if (data.waterPresReading > 0) {
      await prisma.waterReading.create({
        data: {
          unitId: unit.id,
          readingDate: READING_DATE,
          billingPeriod: OCTOBER_BILLING_PERIOD,
          previousReading: data.waterPrevReading,
          presentReading: data.waterPresReading,
          consumption: data.waterConsumption,
          remarks: 'Imported from Excel - October 2025 baseline'
        }
      })
      readingsCreated++
    }

    // Generate bill number
    const billNumber = `OB-NOV2025-${unit.unitNumber}`

    // Create opening balance bill
    await prisma.bill.create({
      data: {
        tenantId: tenant.id,
        unitId: unit.id,
        billNumber,
        billingMonth: BILLING_MONTH,
        billingPeriodStart: createPhilippineDate(2025, 9, 27), // Sep 27
        billingPeriodEnd: createPhilippineDate(2025, 10, 26),   // Oct 26
        statementDate: createPhilippineDate(2025, 11, 5),      // Nov 5
        dueDate: createPhilippineDate(2025, 11, 15),           // Nov 15
        electricAmount: data.electricAmount,
        waterAmount: data.waterAmount,
        associationDues: data.associationDues,
        penaltyAmount: 0,
        otherCharges: 0,
        totalAmount: data.totalAmountDue,
        paidAmount: 0,
        balance: data.totalAmountDue,
        status: data.totalAmountDue > 0 ? BillStatus.UNPAID : BillStatus.PAID,
        billType: BillType.OPENING_BALANCE
      }
    })

    billsCreated++
  }

  console.log(`\n✅ Created ${billsCreated} opening balance bills`)
  console.log(`✅ Created ${readingsCreated} reading records (Electric + Water)`)
  if (skipped > 0) {
    console.log(`⚠ Skipped ${skipped} units (not found in database)`)
  }
}

async function main() {
  console.log('========================================')
  console.log('2F Test Data Setup - November Balances')
  console.log('========================================')

  try {
    await clearExisting2FData()
    await importNovemberBalances()

    console.log('\n========================================')
    console.log('✅ COMPLETE!')
    console.log('========================================')
    console.log('\nNext steps:')
    console.log('1. Check Bills List page for November 2F bills')
    console.log('2. Enter October payments via Payments page')
    console.log('3. Enter November readings via Readings page')
    console.log('4. Generate December SOA')

  } catch (error) {
    console.error('❌ Error:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
