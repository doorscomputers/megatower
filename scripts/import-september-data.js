const { PrismaClient } = require('@prisma/client')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

/**
 * Import September 2025 data from Excel SOA files
 * This script extracts PRESENT readings from September SOA and stores them
 * as September 2025 readings (which become October's PREVIOUS readings)
 */

const SEPTEMBER_FILE = 'C:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (sept 2025).xlsx'
const BILLING_PERIOD = new Date('2025-09-01') // September 2025

/**
 * Parse Excel SOA format to extract readings
 *
 * Excel structure (from previous analysis):
 * - Row 9, col 5: Floor (e.g., "2F")
 * - Row 9, col 6: Unit number (e.g., "1")
 * - Row 9, col 7: Building (e.g., "Megatower 2")
 * - Row 10, col 5: Owner name
 * - Row 16, col 7: Electric present reading
 * - Row 16, col 9: Electric previous reading
 * - Row 19, col 7: Water present reading
 * - Row 19, col 9: Water previous reading
 */
function parseExcelForReadings(filePath) {
  console.log(`\nParsing: ${path.basename(filePath)}`)

  const buffer = fs.readFileSync(filePath)
  const wb = XLSX.read(buffer, { type: 'buffer' })

  const results = []

  for (const sheetName of wb.SheetNames) {
    const upperName = sheetName.toUpperCase()
    // Skip summary and non-unit sheets
    if (upperName.includes('SUMMARY') || upperName.includes('BALANCES') || upperName.includes('PAID')) continue

    const ws = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (data.length < 20) continue

    // Row 9: Unit info (cols 5-7)
    const unitRow = data[9] || []
    const floorPrefix = String(unitRow[5] || '').trim()
    const unitNum = String(unitRow[6] || '').trim()
    const building = String(unitRow[7] || '').trim()

    if (!floorPrefix && !unitNum) continue

    // Determine building prefix
    const buildingPrefix = building.includes('2') ? 'M2' : 'M1'

    // Extract Electric readings (Row 16)
    const electricRow = data[16] || []
    const electricPresent = parseFloat(electricRow[7]) || 0
    const electricPrevious = parseFloat(electricRow[9]) || 0

    // Extract Water readings (Row 19)
    const waterRow = data[19] || []
    const waterPresent = parseFloat(waterRow[7]) || 0
    const waterPrevious = parseFloat(waterRow[9]) || 0

    // Build unit number
    const normalizedUnit = String(unitNum).replace(/\s+/g, '')
    const unitNumber = `${buildingPrefix}-${floorPrefix}-${normalizedUnit}`

    results.push({
      sheetName,
      unitNumber,
      floorPrefix,
      buildingPrefix,
      electric: {
        previous: electricPrevious,
        present: electricPresent,
        consumption: electricPresent - electricPrevious,
      },
      water: {
        previous: waterPrevious,
        present: waterPresent,
        consumption: waterPresent - waterPrevious,
      },
    })

    console.log(`  ${unitNumber}: Electric=${electricPresent}, Water=${waterPresent}`)
  }

  return results
}

async function main() {
  console.log('='.repeat(60))
  console.log('IMPORTING SEPTEMBER 2025 DATA')
  console.log('='.repeat(60))
  console.log(`Billing Period: ${BILLING_PERIOD.toISOString().split('T')[0]}`)

  // Check if file exists
  if (!fs.existsSync(SEPTEMBER_FILE)) {
    console.error(`\nERROR: File not found: ${SEPTEMBER_FILE}`)
    return
  }

  // Parse Excel file
  const readings = parseExcelForReadings(SEPTEMBER_FILE)
  console.log(`\nFound ${readings.length} units in Excel`)

  // Get tenant ID (assuming single tenant)
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found in database')
    return
  }
  console.log(`\nTenant: ${tenant.name}`)

  // Get all units from database
  const dbUnits = await prisma.unit.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, unitNumber: true },
  })
  const unitMap = new Map(dbUnits.map(u => [u.unitNumber, u.id]))
  console.log(`Found ${dbUnits.length} units in database`)

  // Import readings
  let electricCreated = 0
  let waterCreated = 0
  let notFound = []

  for (const reading of readings) {
    const unitId = unitMap.get(reading.unitNumber)

    if (!unitId) {
      notFound.push(reading.unitNumber)
      continue
    }

    // Create/Update Electric Reading
    if (reading.electric.present > 0) {
      await prisma.electricReading.upsert({
        where: {
          unitId_billingPeriod: {
            unitId,
            billingPeriod: BILLING_PERIOD,
          },
        },
        update: {
          previousReading: reading.electric.previous,
          presentReading: reading.electric.present,
          consumption: reading.electric.consumption,
          remarks: 'Imported from September Excel SOA',
        },
        create: {
          unitId,
          readingDate: BILLING_PERIOD,
          billingPeriod: BILLING_PERIOD,
          previousReading: reading.electric.previous,
          presentReading: reading.electric.present,
          consumption: reading.electric.consumption,
          remarks: 'Imported from September Excel SOA',
        },
      })
      electricCreated++
    }

    // Create/Update Water Reading
    if (reading.water.present > 0) {
      await prisma.waterReading.upsert({
        where: {
          unitId_billingPeriod: {
            unitId,
            billingPeriod: BILLING_PERIOD,
          },
        },
        update: {
          previousReading: reading.water.previous,
          presentReading: reading.water.present,
          consumption: reading.water.consumption,
          remarks: 'Imported from September Excel SOA',
        },
        create: {
          unitId,
          readingDate: BILLING_PERIOD,
          billingPeriod: BILLING_PERIOD,
          previousReading: reading.water.previous,
          presentReading: reading.water.present,
          consumption: reading.water.consumption,
          remarks: 'Imported from September Excel SOA',
        },
      })
      waterCreated++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('IMPORT SUMMARY')
  console.log('='.repeat(60))
  console.log(`Electric readings created/updated: ${electricCreated}`)
  console.log(`Water readings created/updated: ${waterCreated}`)

  if (notFound.length > 0) {
    console.log(`\nUnits not found in database (${notFound.length}):`)
    notFound.forEach(u => console.log(`  - ${u}`))
  }

  console.log('\nSeptember data imported successfully!')
  console.log('These readings will become October\'s PREVIOUS readings.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
