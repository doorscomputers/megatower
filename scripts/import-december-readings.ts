/**
 * Import December 2025 Present Readings from READING.xlsx
 *
 * Source: c:\Users\Warenski\Desktop\MEGATOWER I&II\December2\READING.xlsx
 * Worksheet: 2F
 * Electric Reading: Column C starting at row 9
 * Water Reading: Column H starting at row 9
 *
 * Usage: npx tsx scripts/import-december-readings.ts
 */

import { PrismaClient } from '@prisma/client'
import * as XLSX from 'xlsx'
import { createBillingPeriod, createPhilippineDate } from '../lib/timezone'

const prisma = new PrismaClient()

const EXCEL_FILE = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/December2/READING.xlsx'
const WORKSHEET_NAME = '2F'
const FLOOR_LEVEL = '2F'
const BUILDING_PREFIX = 'M2'

// December billing period - Philippine Time (UTC+8)
const DECEMBER_BILLING_PERIOD = createBillingPeriod(2025, 12) // December 2025
const READING_DATE = createPhilippineDate(2025, 12, 26) // Dec 26, 2025

interface ReadingData {
  unitNumber: string
  electricPresent: number
  waterPresent: number
}

async function extractReadingsFromExcel(): Promise<ReadingData[]> {
  console.log(`\nReading Excel file: ${EXCEL_FILE}`)

  const workbook = XLSX.readFile(EXCEL_FILE)
  console.log(`Available sheets: ${workbook.SheetNames.join(', ')}`)

  const worksheet = workbook.Sheets[WORKSHEET_NAME]
  if (!worksheet) {
    throw new Error(`Worksheet "${WORKSHEET_NAME}" not found!`)
  }

  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' }) as any[][]

  console.log(`\n=== EXTRACTING DECEMBER READINGS FROM ${WORKSHEET_NAME} ===`)
  console.log(`Total rows: ${data.length}`)

  // Debug: Show first few rows to understand structure
  console.log('\nFirst 15 rows (for debugging):')
  for (let i = 0; i < Math.min(15, data.length); i++) {
    const row = data[i]
    if (row && row.length > 0) {
      // Show columns A, B, C (unit info + electric) and G, H (water)
      console.log(`Row ${i + 1}: A=${row[0]}, B=${row[1]}, C=${row[2]}, G=${row[6]}, H=${row[7]}`)
    }
  }

  const readings: ReadingData[] = []

  // Start from row 9 (index 8)
  // Column C = index 2 (Electric Present)
  // Column H = index 7 (Water Present)
  // We need to figure out where the unit number is - likely column A or B

  for (let i = 8; i < data.length; i++) {
    const row = data[i]
    if (!row || row.length === 0) continue

    // Try to find unit number - check column A and B
    let unitIdentifier = row[0] || row[1]
    if (!unitIdentifier) continue

    // Convert to string and check if it looks like a unit number
    unitIdentifier = String(unitIdentifier).trim()

    // Skip if it's a header or empty
    if (!unitIdentifier || unitIdentifier.toLowerCase().includes('unit') || unitIdentifier.toLowerCase().includes('floor')) {
      continue
    }

    // Extract electric and water present readings
    const electricPresent = parseFloat(String(row[2])) || 0  // Column C (index 2)
    const waterPresent = parseFloat(String(row[7])) || 0     // Column H (index 7)

    // Skip rows without valid readings
    if (electricPresent === 0 && waterPresent === 0) continue

    // Build unit number
    // Excel has format like "2F-1", we need "M2-2F-1"
    let unitNumber = unitIdentifier
    if (unitNumber.startsWith('2F-')) {
      // Format: 2F-1 -> M2-2F-1
      const unitNum = unitNumber.replace('2F-', '')
      unitNumber = `${BUILDING_PREFIX}-${FLOOR_LEVEL}-${unitNum}`
    } else if (!unitNumber.includes('-')) {
      // If it's just a number, format it as M2-2F-{number}
      unitNumber = `${BUILDING_PREFIX}-${FLOOR_LEVEL}-${unitIdentifier}`
    }

    readings.push({
      unitNumber,
      electricPresent,
      waterPresent
    })

    console.log(`  ${unitNumber}: Electric=${electricPresent}, Water=${waterPresent}`)
  }

  return readings
}

async function importDecemberReadings() {
  console.log('========================================')
  console.log('Import December 2025 Readings')
  console.log('========================================')

  const readings = await extractReadingsFromExcel()

  console.log(`\nExtracted ${readings.length} readings`)

  if (readings.length === 0) {
    console.log('\nNo readings found! Please check the Excel file structure.')
    return
  }

  let electricCreated = 0
  let waterCreated = 0
  let skipped = 0

  console.log('\n=== IMPORTING DECEMBER READINGS ===')

  for (const reading of readings) {
    // Find the unit
    const unit = await prisma.unit.findFirst({
      where: {
        unitNumber: reading.unitNumber,
        floorLevel: FLOOR_LEVEL
      }
    })

    if (!unit) {
      console.log(`  ⚠ Unit ${reading.unitNumber} not found - skipping`)
      skipped++
      continue
    }

    // Get November reading as previous for Electric
    if (reading.electricPresent > 0) {
      const lastElectricReading = await prisma.electricReading.findFirst({
        where: { unitId: unit.id },
        orderBy: { billingPeriod: 'desc' }
      })

      const previousElectric = lastElectricReading?.presentReading || 0
      const electricConsumption = reading.electricPresent - Number(previousElectric)

      await prisma.electricReading.upsert({
        where: {
          unitId_billingPeriod: {
            unitId: unit.id,
            billingPeriod: DECEMBER_BILLING_PERIOD
          }
        },
        update: {
          presentReading: reading.electricPresent,
          previousReading: Number(previousElectric),
          consumption: electricConsumption,
          remarks: 'Imported from December READING.xlsx'
        },
        create: {
          unitId: unit.id,
          readingDate: READING_DATE,
          billingPeriod: DECEMBER_BILLING_PERIOD,
          previousReading: Number(previousElectric),
          presentReading: reading.electricPresent,
          consumption: electricConsumption,
          remarks: 'Imported from December READING.xlsx'
        }
      })
      electricCreated++
    }

    // Get November reading as previous for Water
    if (reading.waterPresent > 0) {
      const lastWaterReading = await prisma.waterReading.findFirst({
        where: { unitId: unit.id },
        orderBy: { billingPeriod: 'desc' }
      })

      const previousWater = lastWaterReading?.presentReading || 0
      const waterConsumption = reading.waterPresent - Number(previousWater)

      await prisma.waterReading.upsert({
        where: {
          unitId_billingPeriod: {
            unitId: unit.id,
            billingPeriod: DECEMBER_BILLING_PERIOD
          }
        },
        update: {
          presentReading: reading.waterPresent,
          previousReading: Number(previousWater),
          consumption: waterConsumption,
          remarks: 'Imported from December READING.xlsx'
        },
        create: {
          unitId: unit.id,
          readingDate: READING_DATE,
          billingPeriod: DECEMBER_BILLING_PERIOD,
          previousReading: Number(previousWater),
          presentReading: reading.waterPresent,
          consumption: waterConsumption,
          remarks: 'Imported from December READING.xlsx'
        }
      })
      waterCreated++
    }

    console.log(`  ✓ ${reading.unitNumber}: Elec=${reading.electricPresent}, Water=${reading.waterPresent}`)
  }

  console.log(`\n========================================`)
  console.log(`✅ IMPORT COMPLETE!`)
  console.log(`========================================`)
  console.log(`\nCreated/Updated:`)
  console.log(`  - ${electricCreated} electric reading records`)
  console.log(`  - ${waterCreated} water reading records`)
  if (skipped > 0) {
    console.log(`  - Skipped ${skipped} units (not found)`)
  }

  console.log(`\nNEXT STEPS:`)
  console.log(`1. Check Electric Readings page - select December 2025`)
  console.log(`2. Check Water Readings page - select December 2025`)
  console.log(`3. Generate January 2026 SOA`)
}

importDecemberReadings()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
