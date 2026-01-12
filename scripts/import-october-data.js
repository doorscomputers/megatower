const { PrismaClient } = require('@prisma/client')
const XLSX = require('xlsx')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()

/**
 * Import October 2025 data from Excel SOA files
 * Uses September's PRESENT readings as October's PREVIOUS readings
 * Imports October's PRESENT readings and adjustments (SP Assessment, etc.)
 */

const OCTOBER_FILE = 'C:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx'
const SEPTEMBER_PERIOD = new Date('2025-09-01')
const OCTOBER_PERIOD = new Date('2025-10-01')

/**
 * Parse Excel SOA format to extract readings and adjustments
 *
 * We need to find SP Assessment, Discounts, Advances in the Excel
 * These are typically in the billing summary section
 */
function parseExcelForOctober(filePath) {
  console.log(`\nParsing: ${path.basename(filePath)}`)

  const buffer = fs.readFileSync(filePath)
  const wb = XLSX.read(buffer, { type: 'buffer' })

  const results = []

  for (const sheetName of wb.SheetNames) {
    const upperName = sheetName.toUpperCase()
    if (upperName.includes('SUMMARY') || upperName.includes('BALANCES') || upperName.includes('PAID')) continue

    const ws = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    if (data.length < 20) continue

    // Row 9: Unit info
    const unitRow = data[9] || []
    const floorPrefix = String(unitRow[5] || '').trim()
    const unitNum = String(unitRow[6] || '').trim()
    const building = String(unitRow[7] || '').trim()

    if (!floorPrefix && !unitNum) continue

    const buildingPrefix = building.includes('2') ? 'M2' : 'M1'

    // Extract Electric readings (Row 16)
    const electricRow = data[16] || []
    const electricPresent = parseFloat(electricRow[7]) || 0
    const electricPrevious = parseFloat(electricRow[9]) || 0

    // Extract Water readings (Row 19)
    const waterRow = data[19] || []
    const waterPresent = parseFloat(waterRow[7]) || 0
    const waterPrevious = parseFloat(waterRow[9]) || 0

    // Try to find SP Assessment, Discounts in the data
    // These might be in different rows depending on the Excel layout
    // Look for keywords in the first few columns
    let spAssessment = 0
    let discounts = 0
    let advanceDues = 0
    let advanceUtilities = 0

    for (let i = 20; i < Math.min(50, data.length); i++) {
      const row = data[i] || []
      const label = String(row[0] || '').toUpperCase()

      // Look for SP Assessment
      if (label.includes('SP ASSESS') || label.includes('SPECIAL ASSESS')) {
        spAssessment = parseFloat(row[11]) || parseFloat(row[17]) || 0
      }

      // Look for Discounts
      if (label.includes('DISCOUNT') || label.includes('LESS')) {
        discounts = Math.abs(parseFloat(row[11]) || parseFloat(row[17]) || 0)
      }

      // Look for Advance payments
      if (label.includes('ADVANCE') && label.includes('DUES')) {
        advanceDues = parseFloat(row[11]) || parseFloat(row[17]) || 0
      }
      if (label.includes('ADVANCE') && label.includes('UTIL')) {
        advanceUtilities = parseFloat(row[11]) || parseFloat(row[17]) || 0
      }
    }

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
      adjustments: {
        spAssessment,
        discounts,
        advanceDues,
        advanceUtilities,
      },
    })

    console.log(`  ${unitNumber}: E=${electricPresent}, W=${waterPresent}, SP=${spAssessment}`)
  }

  return results
}

async function main() {
  console.log('='.repeat(60))
  console.log('IMPORTING OCTOBER 2025 DATA')
  console.log('='.repeat(60))
  console.log(`Billing Period: ${OCTOBER_PERIOD.toISOString().split('T')[0]}`)

  // Check if file exists
  if (!fs.existsSync(OCTOBER_FILE)) {
    console.error(`\nERROR: File not found: ${OCTOBER_FILE}`)
    return
  }

  // Get tenant ID
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found in database')
    return
  }
  console.log(`\nTenant: ${tenant.name}`)

  // Get September readings (to use as October's previous)
  const septemberReadings = await prisma.electricReading.findMany({
    where: { billingPeriod: SEPTEMBER_PERIOD },
    include: { unit: { select: { unitNumber: true } } },
  })

  const septemberWaterReadings = await prisma.waterReading.findMany({
    where: { billingPeriod: SEPTEMBER_PERIOD },
    include: { unit: { select: { unitNumber: true } } },
  })

  const septElectricMap = new Map(
    septemberReadings.map(r => [r.unit.unitNumber, Number(r.presentReading)])
  )
  const septWaterMap = new Map(
    septemberWaterReadings.map(r => [r.unit.unitNumber, Number(r.presentReading)])
  )

  console.log(`\nSeptember electric readings: ${septElectricMap.size}`)
  console.log(`September water readings: ${septWaterMap.size}`)

  // Parse October Excel file
  const readings = parseExcelForOctober(OCTOBER_FILE)
  console.log(`\nFound ${readings.length} units in October Excel`)

  // Get all units from database
  const dbUnits = await prisma.unit.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: { id: true, unitNumber: true },
  })
  const unitMap = new Map(dbUnits.map(u => [u.unitNumber, u.id]))

  // Import readings and adjustments
  let electricCreated = 0
  let waterCreated = 0
  let adjustmentsCreated = 0
  let notFound = []

  for (const reading of readings) {
    const unitId = unitMap.get(reading.unitNumber)

    if (!unitId) {
      notFound.push(reading.unitNumber)
      continue
    }

    // Use September's PRESENT as October's PREVIOUS
    const septElectricPresent = septElectricMap.get(reading.unitNumber) || reading.electric.previous
    const septWaterPresent = septWaterMap.get(reading.unitNumber) || reading.water.previous

    // Create October Electric Reading
    if (reading.electric.present > 0) {
      const consumption = reading.electric.present - septElectricPresent
      await prisma.electricReading.upsert({
        where: {
          unitId_billingPeriod: {
            unitId,
            billingPeriod: OCTOBER_PERIOD,
          },
        },
        update: {
          previousReading: septElectricPresent,
          presentReading: reading.electric.present,
          consumption: Math.max(0, consumption),
          remarks: 'Imported from October Excel SOA',
        },
        create: {
          unitId,
          readingDate: OCTOBER_PERIOD,
          billingPeriod: OCTOBER_PERIOD,
          previousReading: septElectricPresent,
          presentReading: reading.electric.present,
          consumption: Math.max(0, consumption),
          remarks: 'Imported from October Excel SOA',
        },
      })
      electricCreated++
    }

    // Create October Water Reading
    if (reading.water.present > 0) {
      const consumption = reading.water.present - septWaterPresent
      await prisma.waterReading.upsert({
        where: {
          unitId_billingPeriod: {
            unitId,
            billingPeriod: OCTOBER_PERIOD,
          },
        },
        update: {
          previousReading: septWaterPresent,
          presentReading: reading.water.present,
          consumption: Math.max(0, consumption),
          remarks: 'Imported from October Excel SOA',
        },
        create: {
          unitId,
          readingDate: OCTOBER_PERIOD,
          billingPeriod: OCTOBER_PERIOD,
          previousReading: septWaterPresent,
          presentReading: reading.water.present,
          consumption: Math.max(0, consumption),
          remarks: 'Imported from October Excel SOA',
        },
      })
      waterCreated++
    }

    // Create Billing Adjustments if any
    const adj = reading.adjustments
    if (adj.spAssessment > 0 || adj.discounts > 0 || adj.advanceDues > 0 || adj.advanceUtilities > 0) {
      await prisma.billingAdjustment.upsert({
        where: {
          tenantId_unitId_billingPeriod: {
            tenantId: tenant.id,
            unitId,
            billingPeriod: OCTOBER_PERIOD,
          },
        },
        update: {
          spAssessment: adj.spAssessment,
          discounts: adj.discounts,
          advanceDues: adj.advanceDues,
          advanceUtilities: adj.advanceUtilities,
          remarks: 'Imported from October Excel SOA',
        },
        create: {
          tenantId: tenant.id,
          unitId,
          billingPeriod: OCTOBER_PERIOD,
          spAssessment: adj.spAssessment,
          discounts: adj.discounts,
          advanceDues: adj.advanceDues,
          advanceUtilities: adj.advanceUtilities,
          remarks: 'Imported from October Excel SOA',
        },
      })
      adjustmentsCreated++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('IMPORT SUMMARY')
  console.log('='.repeat(60))
  console.log(`Electric readings created/updated: ${electricCreated}`)
  console.log(`Water readings created/updated: ${waterCreated}`)
  console.log(`Billing adjustments created/updated: ${adjustmentsCreated}`)

  if (notFound.length > 0) {
    console.log(`\nUnits not found in database (${notFound.length}):`)
    notFound.forEach(u => console.log(`  - ${u}`))
  }

  console.log('\nOctober data imported successfully!')
  console.log('\nNext steps:')
  console.log('1. Go to Generate Bills page')
  console.log('2. Select October 2025')
  console.log('3. Preview and Generate Bills')
  console.log('4. Compare with Excel October billing')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
