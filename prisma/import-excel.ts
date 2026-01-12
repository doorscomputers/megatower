/**
 * Excel Import Script for Megatower I & II
 *
 * Parses Excel billing files and imports:
 * - Owners (deduplicated by name)
 * - Units with M1- or M2- prefix
 * - Opening balances from TOTAL AMOUNT DUE
 *
 * Run with: npx tsx prisma/import-excel.ts
 */

import { PrismaClient, UnitType, OccupancyStatus, BillStatus } from '@prisma/client'
import * as XLSX from 'xlsx'
import * as path from 'path'
import * as fs from 'fs'

const prisma = new PrismaClient()

// ==========================================
// CONFIGURATION
// ==========================================

const MEGATOWER_1_PATH = 'C:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\NOVEMBER, 2025 MEGATOWER I'
const MEGATOWER_2_PATH = 'C:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\NOV 2025 MEGATOWER II'

// Floor mappings for Megatower I (from filename)
const M1_FLOOR_MAP: Record<string, string> = {
  '1FIRST BASEMENT': '1B',
  '2SECOND BASEMENT': '2B',
  '3LOWER GROUND FLOOR': 'LG',
  '4GROUND FLOOR': 'GF',
  '5SECOND FLOOR': '2F',
  '6THIRD FLOOR': '3F',
  '7FOURTH FLOOR': '4F',
  '8FIFTH FLOOR': '5F',
}

// Floor mappings for Megatower II (from filename)
const M2_FLOOR_MAP: Record<string, string> = {
  'GROUND FLOOR': 'GF',
  '2ND FLOOR': '2F',
  '3rd FLOOR': '3F',
  '4TH FLOOR': '4F',
  '5TH FLOOR': '5F',
  '6th FLOOR': '6F',
  'LG-08 M2': 'LG',
  'LG-11 M2': 'LG',
}

// ==========================================
// TYPES
// ==========================================

interface ExtractedUnit {
  unitNumber: string       // M1-GF-1 or M2-3F-Shop2
  floorLevel: string       // GF, 2F, etc.
  ownerName: string        // Full name as in Excel
  area: number             // sqm
  unitType: UnitType       // RESIDENTIAL or COMMERCIAL
  balance: number          // Total amount due
  building: 'M1' | 'M2'
}

// ==========================================
// EXCEL PARSING FUNCTIONS
// ==========================================

function parseOwnerName(rawName: string): { lastName: string; firstName: string; middleName?: string } {
  const name = rawName.trim()

  // Handle company names (contains INC, CORP, LLC, etc.)
  if (/\b(INC|CORP|LLC|CO|COMPANY|HOLDING|SYSTEMS|INTERNATIONAL)\b/i.test(name)) {
    return { lastName: name, firstName: '' }
  }

  // Handle "SPS", "SPOUSES", "MR.", "MS.", "ATTY.", "DR." prefixes
  let cleanName = name
    .replace(/^(SPS\.?|SPOUSES|MR\.?|MS\.?|MRS\.?|ATTY\.?|DR\.?|ENGR\.?)\s*/i, '')
    .trim()

  // Handle "& Name" format (e.g., "HECTOR & JOVITA LOPEZ")
  if (cleanName.includes(' & ')) {
    // "HECTOR & JOVITA LOPEZ" -> lastName: "LOPEZ", firstName: "HECTOR & JOVITA"
    const parts = cleanName.split(' ')
    const lastName = parts[parts.length - 1]
    const firstName = parts.slice(0, -1).join(' ')
    return { lastName, firstName }
  }

  // Standard "FIRSTNAME LASTNAME" or "FIRSTNAME MIDDLENAME LASTNAME"
  const parts = cleanName.split(/\s+/)
  if (parts.length === 1) {
    return { lastName: parts[0], firstName: '' }
  } else if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1] }
  } else {
    // Multiple parts - last is lastName, first is firstName, middle is rest
    return {
      firstName: parts[0],
      middleName: parts.slice(1, -1).join(' '),
      lastName: parts[parts.length - 1],
    }
  }
}

function determineUnitType(unitNumber: string, ownerName: string): UnitType {
  const lower = (unitNumber + ' ' + ownerName).toLowerCase()
  if (lower.includes('shop') || lower.includes('commercial') || lower.includes('corp') ||
      lower.includes('inc') || lower.includes('store') || lower.includes('systems')) {
    return 'COMMERCIAL'
  }
  return 'RESIDENTIAL'
}

function extractUnitFromSheet(
  ws: XLSX.WorkSheet,
  building: 'M1' | 'M2',
  defaultFloor: string
): ExtractedUnit | null {
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

  if (data.length < 15) return null

  // Row 9: Unit number (cols 7-8)
  const unitRow = data[9] || []
  const floorPrefix = String(unitRow[7] || '').trim()
  const unitNum = String(unitRow[8] || '').trim()

  if (!floorPrefix && !unitNum) return null

  // Row 10: Owner name (col 7)
  const ownerRow = data[10] || []
  const ownerName = String(ownerRow[7] || '').trim()

  if (!ownerName) return null

  // Find area from "Rate per Sq.mtr" rows
  let mainArea = 0
  let parkingArea = 0
  for (let i = 20; i < Math.min(30, data.length); i++) {
    const row = data[i] || []
    const rowStr = JSON.stringify(row)
    if (rowStr.includes('Rate per Sq.mtr')) {
      mainArea = parseFloat(row[11]) || 0
    }
    if (rowStr.includes('Parking area')) {
      parkingArea = parseFloat(row[11]) || 0
    }
  }

  // Find TOTAL AMOUNT DUE AND PAYABLE
  let balance = 0
  for (let i = 30; i < Math.min(55, data.length); i++) {
    const row = data[i] || []
    if (row[3] && String(row[3]).includes('TOTAL AMOUNT DUE AND PAYABLE')) {
      balance = parseFloat(row[20]) || 0
      break
    }
  }

  // Build unit number with prefix
  // Format: M1-GF-1 or M2-Shop2
  const normalizedUnit = unitNum.replace(/\s+/g, '')
  const unitNumber = `${building}-${floorPrefix}-${normalizedUnit}`

  return {
    unitNumber,
    floorLevel: floorPrefix || defaultFloor,
    ownerName,
    area: mainArea + parkingArea,
    unitType: determineUnitType(unitNumber, ownerName),
    balance,
    building,
  }
}

function parseExcelFile(filePath: string, building: 'M1' | 'M2', floorCode: string): ExtractedUnit[] {
  console.log(`  Reading: ${path.basename(filePath)}`)

  const wb = XLSX.readFile(filePath)
  const results: ExtractedUnit[] = []

  // Process each sheet (skip SUMMARY and BALANCES sheets)
  for (const sheetName of wb.SheetNames) {
    if (sheetName.includes('SUMMARY') || sheetName.includes('BALANCES')) continue

    const ws = wb.Sheets[sheetName]
    const unit = extractUnitFromSheet(ws, building, floorCode)

    if (unit) {
      results.push(unit)
    }
  }

  console.log(`    Found ${results.length} units`)
  return results
}

// ==========================================
// MAIN IMPORT FUNCTION
// ==========================================

async function importData() {
  console.log('='.repeat(60))
  console.log('MEGATOWER EXCEL IMPORT')
  console.log('='.repeat(60))

  // Get tenant
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found! Run npm run db:seed first.')
    process.exit(1)
  }
  console.log(`\nUsing tenant: ${tenant.name}`)

  // Collect all units from both buildings
  const allUnits: ExtractedUnit[] = []

  // ==========================================
  // MEGATOWER I
  // ==========================================
  console.log('\n--- MEGATOWER I ---')

  if (fs.existsSync(MEGATOWER_1_PATH)) {
    const m1Files = fs.readdirSync(MEGATOWER_1_PATH)
      .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))

    for (const file of m1Files) {
      // Extract floor code from filename
      const baseName = file.replace(' 112025.xlsx', '').replace('.xlsx', '')
      let floorCode = 'UNK'

      for (const [prefix, code] of Object.entries(M1_FLOOR_MAP)) {
        if (baseName.toUpperCase().includes(prefix.toUpperCase())) {
          floorCode = code
          break
        }
      }

      const units = parseExcelFile(
        path.join(MEGATOWER_1_PATH, file),
        'M1',
        floorCode
      )
      allUnits.push(...units)
    }
  } else {
    console.log('  Path not found:', MEGATOWER_1_PATH)
  }

  // ==========================================
  // MEGATOWER II
  // ==========================================
  console.log('\n--- MEGATOWER II ---')

  if (fs.existsSync(MEGATOWER_2_PATH)) {
    const m2Files = fs.readdirSync(MEGATOWER_2_PATH)
      .filter(f => f.endsWith('.xlsx') && !f.startsWith('~$'))
      .filter(f => f.includes('(t2)') || f.includes('M2'))

    for (const file of m2Files) {
      // Extract floor code from filename
      const baseName = file.replace(' (t2).xlsx', '').replace('.xlsx', '').toUpperCase()
      let floorCode = 'UNK'

      for (const [prefix, code] of Object.entries(M2_FLOOR_MAP)) {
        if (baseName.includes(prefix.toUpperCase())) {
          floorCode = code
          break
        }
      }

      const units = parseExcelFile(
        path.join(MEGATOWER_2_PATH, file),
        'M2',
        floorCode
      )
      allUnits.push(...units)
    }
  } else {
    console.log('  Path not found:', MEGATOWER_2_PATH)
  }

  console.log(`\n${'='.repeat(60)}`)
  console.log(`TOTAL UNITS EXTRACTED: ${allUnits.length}`)
  console.log('='.repeat(60))

  // ==========================================
  // CREATE OWNERS (deduplicated)
  // ==========================================
  console.log('\n1. Creating owners...')

  // Deduplicate owners by name
  const ownerMap = new Map<string, { lastName: string; firstName: string; middleName?: string }>()

  for (const unit of allUnits) {
    const key = unit.ownerName.toUpperCase()
    if (!ownerMap.has(key)) {
      ownerMap.set(key, parseOwnerName(unit.ownerName))
    }
  }

  // Create owners in database
  const ownerIdMap = new Map<string, string>()

  for (const [key, parsed] of Array.from(ownerMap.entries())) {
    // Check if owner exists
    const existing = await prisma.owner.findFirst({
      where: {
        tenantId: tenant.id,
        lastName: parsed.lastName,
        firstName: parsed.firstName,
      }
    })

    if (existing) {
      ownerIdMap.set(key, existing.id)
      console.log(`   Exists: ${parsed.lastName}, ${parsed.firstName}`)
    } else {
      const created = await prisma.owner.create({
        data: {
          tenantId: tenant.id,
          lastName: parsed.lastName,
          firstName: parsed.firstName || '-',
          middleName: parsed.middleName,
        }
      })
      ownerIdMap.set(key, created.id)
      console.log(`   Created: ${parsed.lastName}, ${parsed.firstName}`)
    }
  }

  // ==========================================
  // CREATE UNITS
  // ==========================================
  console.log('\n2. Creating units...')

  const unitIdMap = new Map<string, string>()

  for (const unit of allUnits) {
    const ownerKey = unit.ownerName.toUpperCase()
    const ownerId = ownerIdMap.get(ownerKey)

    // Check if unit exists
    const existing = await prisma.unit.findFirst({
      where: {
        tenantId: tenant.id,
        unitNumber: unit.unitNumber,
      }
    })

    if (existing) {
      unitIdMap.set(unit.unitNumber, existing.id)
      console.log(`   Exists: ${unit.unitNumber}`)
    } else {
      const created = await prisma.unit.create({
        data: {
          tenantId: tenant.id,
          unitNumber: unit.unitNumber,
          floorLevel: unit.floorLevel,
          area: unit.area || 30, // Default area if not found
          unitType: unit.unitType,
          ownerId: ownerId,
          occupancyStatus: OccupancyStatus.OCCUPIED,
          isActive: true,
        }
      })
      unitIdMap.set(unit.unitNumber, created.id)
      console.log(`   Created: ${unit.unitNumber} (${unit.unitType}, ${unit.area} sqm)`)
    }
  }

  // ==========================================
  // CREATE OPENING BALANCES
  // ==========================================
  console.log('\n3. Creating opening balances...')

  let balancesCreated = 0
  let balancesSkipped = 0

  for (const unit of allUnits) {
    if (unit.balance <= 0) {
      balancesSkipped++
      continue
    }

    const unitId = unitIdMap.get(unit.unitNumber)
    if (!unitId) continue

    // Check if opening balance exists
    const existing = await prisma.bill.findFirst({
      where: {
        tenantId: tenant.id,
        unitId: unitId,
        billType: 'OPENING_BALANCE',
      }
    })

    if (existing) {
      console.log(`   Exists: ${unit.unitNumber} - ₱${unit.balance.toLocaleString()}`)
    } else {
      const now = new Date()
      await prisma.bill.create({
        data: {
          tenantId: tenant.id,
          unitId: unitId,
          billNumber: `OB-${unit.unitNumber}`,
          billType: 'OPENING_BALANCE',
          billingMonth: now,
          billingPeriodStart: now,
          billingPeriodEnd: now,
          statementDate: now,
          dueDate: now,
          electricAmount: 0,
          waterAmount: 0,
          associationDues: 0,
          penaltyAmount: 0,
          otherCharges: unit.balance,
          totalAmount: unit.balance,
          paidAmount: 0,
          balance: unit.balance,
          status: BillStatus.UNPAID,
          remarks: 'Opening Balance (imported from Excel)',
        }
      })
      balancesCreated++
      console.log(`   Created: ${unit.unitNumber} - ₱${unit.balance.toLocaleString()}`)
    }
  }

  // ==========================================
  // SUMMARY
  // ==========================================
  console.log('\n' + '='.repeat(60))
  console.log('IMPORT COMPLETE!')
  console.log('='.repeat(60))
  console.log(`
Summary:
- Owners: ${ownerMap.size}
- Units: ${unitIdMap.size}
- Opening Balances Created: ${balancesCreated}
- Zero Balances Skipped: ${balancesSkipped}

Next Steps:
1. Open Prisma Studio: npm run db:studio
2. Verify the imported data
3. Use the Balance Import page to update balances monthly
`)
}

// ==========================================
// RUN
// ==========================================

importData()
  .catch((e) => {
    console.error('Error:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
