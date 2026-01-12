/**
 * Import November Readings and Payments from December Excel
 * This prepares the system to generate December 2025 SOA
 *
 * Usage: npx tsx scripts/import-november-data.ts
 */

import { PrismaClient, PaymentMethod } from '@prisma/client'
import * as XLSX from 'xlsx'
import { createBillingPeriod, createPhilippineDate } from '../lib/timezone'

const prisma = new PrismaClient()

const EXCEL_FILE = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/December/2ND FLOOR December.xlsx'
const FLOOR_LEVEL = '2F'
const BUILDING_PREFIX = 'M2'

// November billing period (for readings) - Philippine Time (UTC+8)
const NOVEMBER_BILLING_PERIOD = createBillingPeriod(2025, 11) // November 2025
const READING_DATE = createPhilippineDate(2025, 11, 26) // Nov 26, 2025

// November payment date
const PAYMENT_DATE = createPhilippineDate(2025, 11, 15) // Nov 15, 2025

const SHEETS_TO_PROCESS = ['1', '2', '3', '5', '6', '7', '8', '9', '10', '11', '12', '15', '16', '17', '18', '19', '20', '21', '22']

interface ExtractedData {
  unitNumber: string
  sheetName: string  // Original sheet name for unique OR#
  // November readings (10/27 to 11/26)
  electricPrevReading: number
  electricPresReading: number
  electricConsumption: number
  waterPrevReading: number
  waterPresReading: number
  waterConsumption: number
  // November payments
  orNumber: string
  electricPayment: number
  waterPayment: number
  duesPayment: number
  pastDuesPayment: number
  spAssessmentPayment: number
  advancePayment: number
  totalPayment: number
}

function extractDataFromSheet(worksheet: XLSX.WorkSheet, sheetName: string): ExtractedData | null {
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

  const unitNumber = `${BUILDING_PREFIX}-${FLOOR_LEVEL}-${sheetName}`

  // November readings from Row 17 and Row 20
  const electricPrevReading = parseFloat(String(data[16]?.[9])) || 0
  const electricPresReading = parseFloat(String(data[16]?.[7])) || 0
  const electricConsumption = parseFloat(String(data[16]?.[11])) || 0

  const waterPrevReading = parseFloat(String(data[19]?.[9])) || 0
  const waterPresReading = parseFloat(String(data[19]?.[7])) || 0
  const waterConsumption = parseFloat(String(data[19]?.[11])) || 0

  // November payments from rows 38-44
  // OR# from Row 38, Index 7
  const orNumber = String(data[37]?.[7] || '')

  // Individual payment amounts
  const electricPayment = parseFloat(String(data[37]?.[11])) || 0  // Row 38, Index 11
  const waterPayment = parseFloat(String(data[38]?.[11])) || 0     // Row 39, Index 11
  const duesPayment = parseFloat(String(data[39]?.[11])) || 0      // Row 40, Index 11
  const pastDuesPayment = parseFloat(String(data[40]?.[11])) || 0  // Row 41, Index 11
  const spAssessmentPayment = parseFloat(String(data[41]?.[11])) || 0 // Row 42, Index 11
  const advancePayment = parseFloat(String(data[42]?.[11])) || 0   // Row 43, Index 11
  const totalPayment = parseFloat(String(data[43]?.[11])) || 0     // Row 44, Index 11

  console.log(`  ${unitNumber}:`)
  console.log(`    Readings: Elec ${electricPrevReading}→${electricPresReading} (${electricConsumption}), Water ${waterPrevReading}→${waterPresReading} (${waterConsumption})`)
  console.log(`    Payment: OR#${orNumber} Total=₱${totalPayment.toFixed(2)}`)

  return {
    unitNumber,
    sheetName,
    electricPrevReading,
    electricPresReading,
    electricConsumption,
    waterPrevReading,
    waterPresReading,
    waterConsumption,
    orNumber,
    electricPayment,
    waterPayment,
    duesPayment,
    pastDuesPayment,
    spAssessmentPayment,
    advancePayment,
    totalPayment
  }
}

async function importNovemberData() {
  console.log('========================================')
  console.log('Import November Data for December SOA')
  console.log('========================================')
  console.log(`\nSource: ${EXCEL_FILE}`)

  const workbook = XLSX.readFile(EXCEL_FILE)
  console.log(`Found ${workbook.SheetNames.length} sheets\n`)

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    throw new Error('No tenant found!')
  }

  const extractedData: ExtractedData[] = []

  console.log('=== EXTRACTING DATA ===')
  for (const sheetName of SHEETS_TO_PROCESS) {
    if (!workbook.SheetNames.includes(sheetName)) continue

    const worksheet = workbook.Sheets[sheetName]
    const data = extractDataFromSheet(worksheet, sheetName)
    if (data) {
      extractedData.push(data)
    }
  }

  console.log(`\nExtracted data for ${extractedData.length} units`)

  // Import readings and payments
  let readingsCreated = 0
  let paymentsCreated = 0
  let skipped = 0

  console.log('\n=== IMPORTING DATA ===')

  for (const data of extractedData) {
    const unit = await prisma.unit.findFirst({
      where: { unitNumber: data.unitNumber, floorLevel: FLOOR_LEVEL }
    })

    if (!unit) {
      console.log(`  ⚠ Unit ${data.unitNumber} not found - skipping`)
      skipped++
      continue
    }

    // Create November Electric Reading
    if (data.electricPresReading > 0) {
      await prisma.electricReading.upsert({
        where: {
          unitId_billingPeriod: {
            unitId: unit.id,
            billingPeriod: NOVEMBER_BILLING_PERIOD
          }
        },
        update: {
          previousReading: data.electricPrevReading,
          presentReading: data.electricPresReading,
          consumption: data.electricConsumption,
          remarks: 'Imported from December Excel - November 2025'
        },
        create: {
          unitId: unit.id,
          readingDate: READING_DATE,
          billingPeriod: NOVEMBER_BILLING_PERIOD,
          previousReading: data.electricPrevReading,
          presentReading: data.electricPresReading,
          consumption: data.electricConsumption,
          remarks: 'Imported from December Excel - November 2025'
        }
      })
      readingsCreated++
    }

    // Create November Water Reading
    if (data.waterPresReading > 0) {
      await prisma.waterReading.upsert({
        where: {
          unitId_billingPeriod: {
            unitId: unit.id,
            billingPeriod: NOVEMBER_BILLING_PERIOD
          }
        },
        update: {
          previousReading: data.waterPrevReading,
          presentReading: data.waterPresReading,
          consumption: data.waterConsumption,
          remarks: 'Imported from December Excel - November 2025'
        },
        create: {
          unitId: unit.id,
          readingDate: READING_DATE,
          billingPeriod: NOVEMBER_BILLING_PERIOD,
          previousReading: data.waterPrevReading,
          presentReading: data.waterPresReading,
          consumption: data.waterConsumption,
          remarks: 'Imported from December Excel - November 2025'
        }
      })
      readingsCreated++
    }

    // Create November Payment (if there's a payment)
    if (data.totalPayment > 0) {
      // Make OR# unique by appending unit number (since same OR# can be used for multiple units)
      const uniqueOrNumber = `${data.orNumber}-${data.sheetName}`

      // Check if payment already exists for this unit
      const existingPayment = await prisma.payment.findFirst({
        where: {
          unitId: unit.id,
          paymentDate: PAYMENT_DATE,
          tenantId: tenant.id
        }
      })

      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            tenantId: tenant.id,
            unitId: unit.id,
            orNumber: uniqueOrNumber,
            paymentDate: PAYMENT_DATE,
            electricAmount: data.electricPayment,
            waterAmount: data.waterPayment,
            duesAmount: data.duesPayment,
            pastDuesAmount: data.pastDuesPayment,
            spAssessmentAmount: data.spAssessmentPayment,
            advanceDuesAmount: 0,
            advanceUtilAmount: 0,
            otherAdvanceAmount: data.advancePayment,
            totalAmount: data.totalPayment,
            paymentMethod: PaymentMethod.CASH,
            remarks: `Imported - Nov 2025 payment (Original OR#${data.orNumber})`
          }
        })
        paymentsCreated++
      } else {
        console.log(`  Payment already exists for ${data.unitNumber} on ${PAYMENT_DATE.toDateString()}`)
      }
    }
  }

  console.log(`\n========================================`)
  console.log(`✅ IMPORT COMPLETE!`)
  console.log(`========================================`)
  console.log(`\nCreated:`)
  console.log(`  - ${readingsCreated} reading records (Electric + Water)`)
  console.log(`  - ${paymentsCreated} payment records`)
  if (skipped > 0) {
    console.log(`  - Skipped ${skipped} units (not found)`)
  }

  console.log(`\nNEXT STEPS:`)
  console.log(`1. Check Electric Readings page - should show November readings`)
  console.log(`2. Check Water Readings page - should show November readings`)
  console.log(`3. Check Payments page - should show November payments`)
  console.log(`4. Go to Monthly SOA page and Generate December 2025 SOA`)
  console.log(`5. Compare generated SOA with Excel to verify calculations`)
}

importNovemberData()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
