/**
 * Verify October 2025 Bills against Excel File
 */

import * as XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'

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

interface ExcelBillData {
  unitNumber: string
  electricPres: number
  electricPrev: number
  electricCons: number
  electricRate: number
  electricAmount: number
  waterPres: number
  waterPrev: number
  waterCons: number
  waterAmount: number
  duesRate: number
  duesArea: number
  duesAmount: number
}

function parseExcelSheet(wb: XLSX.WorkBook, sheetName: string): ExcelBillData | null {
  const sheet = wb.Sheets[sheetName]
  if (!sheet) return null

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][]

  // Row 17 (index 16): Electric data - H=Pres, J=Prev, L=Cons, N=Rate
  const electricRow = data[16] || []
  const electricPres = parseFloat(electricRow[7]) || 0
  const electricPrev = parseFloat(electricRow[9]) || 0
  const electricCons = parseFloat(electricRow[11]) || 0
  const electricRate = parseFloat(electricRow[13]) || 0
  const electricAmount = electricCons * electricRate

  // Row 20 (index 19): Water data - H=Pres, J=Prev, L=Cons
  const waterRow = data[19] || []
  const waterPres = parseFloat(waterRow[7]) || 0
  const waterPrev = parseFloat(waterRow[9]) || 0
  const waterCons = parseFloat(waterRow[11]) || 0

  // Row 24 (index 23): Association Dues - H=Rate, J=Area, K=Amount
  const duesRow = data[23] || []
  const duesRate = parseFloat(duesRow[7]) || 60
  const duesArea = parseFloat(duesRow[9]) || 0
  const duesAmount = parseFloat(duesRow[10]) || 0

  // For water, we need to calculate based on tier system
  // For now, just extract what we have
  const waterAmount = 0 // Will be calculated by the system

  return {
    unitNumber: sheetToUnit[sheetName] || sheetName,
    electricPres,
    electricPrev,
    electricCons,
    electricRate,
    electricAmount,
    waterPres,
    waterPrev,
    waterCons,
    waterAmount,
    duesRate,
    duesArea,
    duesAmount,
  }
}

async function main() {
  console.log('='.repeat(70))
  console.log('VERIFYING OCTOBER 2025 BILLS AGAINST EXCEL')
  console.log('='.repeat(70))

  // Read Excel
  const wb = XLSX.readFile(EXCEL_PATH)

  // Get October bills from database
  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.error('No tenant found')
    return
  }

  const octBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: new Date('2025-10-01')
    },
    include: { unit: true }
  })

  console.log(`\nFound ${octBills.length} October bills in database`)
  console.log(`Found ${wb.SheetNames.length} sheets in Excel\n`)

  console.log('Unit'.padEnd(12) +
              'E.Cons'.padStart(8) +
              'E.Rate'.padStart(8) +
              'Electric(Excel)'.padStart(16) +
              'Electric(DB)'.padStart(14) +
              'Match'.padStart(8) +
              'Water(DB)'.padStart(12) +
              'Dues(Excel)'.padStart(12) +
              'Dues(DB)'.padStart(10))
  console.log('-'.repeat(100))

  let allMatch = true
  let matchCount = 0
  let mismatchCount = 0

  for (const sheetName of Object.keys(sheetToUnit)) {
    const excelData = parseExcelSheet(wb, sheetName)
    if (!excelData) continue

    const bill = octBills.find(b => b.unit.unitNumber === excelData.unitNumber)
    if (!bill) {
      console.log(`${excelData.unitNumber}: No bill found in database`)
      continue
    }

    const dbElectric = Number(bill.electricAmount)
    const excelElectric = excelData.electricAmount
    const dbWater = Number(bill.waterAmount)
    const dbDues = Number(bill.associationDues)

    // Check if electric matches (within 1 peso tolerance)
    const electricMatch = Math.abs(dbElectric - excelElectric) < 1

    if (!electricMatch) {
      allMatch = false
      mismatchCount++
    } else {
      matchCount++
    }

    console.log(
      excelData.unitNumber.padEnd(12) +
      excelData.electricCons.toString().padStart(8) +
      excelData.electricRate.toFixed(2).padStart(8) +
      ('₱' + excelElectric.toFixed(2)).padStart(16) +
      ('₱' + dbElectric.toFixed(2)).padStart(14) +
      (electricMatch ? '✓' : '✗').padStart(8) +
      ('₱' + dbWater.toFixed(2)).padStart(12) +
      ('₱' + excelData.duesAmount.toFixed(2)).padStart(12) +
      ('₱' + dbDues.toFixed(2)).padStart(10)
    )
  }

  console.log('\n' + '='.repeat(70))
  console.log('SUMMARY')
  console.log('='.repeat(70))
  console.log(`Match: ${matchCount} units`)
  console.log(`Mismatch: ${mismatchCount} units`)
  console.log(`\nAll electric calculations match: ${allMatch ? 'YES ✓' : 'NO ✗'}`)

  // Show sample bill details for M2-2F-1
  const unit1Bill = octBills.find(b => b.unit.unitNumber === 'M2-2F-1')
  if (unit1Bill) {
    console.log('\n' + '='.repeat(70))
    console.log('M2-2F-1 OCTOBER BILL DETAILS')
    console.log('='.repeat(70))
    console.log(`Bill Number: ${unit1Bill.billNumber}`)
    console.log(`Electric: ₱${Number(unit1Bill.electricAmount).toFixed(2)}`)
    console.log(`Water: ₱${Number(unit1Bill.waterAmount).toFixed(2)}`)
    console.log(`Association Dues: ₱${Number(unit1Bill.associationDues).toFixed(2)}`)
    console.log(`SP Assessment: ₱${Number(unit1Bill.spAssessment || 0).toFixed(2)}`)
    console.log(`Advance Dues Applied: ₱${Number(unit1Bill.advanceDuesApplied || 0).toFixed(2)}`)
    console.log(`Advance Util Applied: ₱${Number(unit1Bill.advanceUtilApplied || 0).toFixed(2)}`)
    console.log(`Total Amount: ₱${Number(unit1Bill.totalAmount).toFixed(2)}`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
