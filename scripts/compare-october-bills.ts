import { PrismaClient } from '@prisma/client'
import XLSX from 'xlsx'

const prisma = new PrismaClient()

interface ExcelBill {
  unitNumber: string
  ownerName: string
  electric: number
  water: number
  dues: number
  parking: number
  total: number
}

function parseExcelSheet(sheet: XLSX.WorkSheet, sheetName: string): ExcelBill | null {
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

  // Skip sheets that aren't main unit sheets
  if (sheetName.includes('(A)') || sheetName.includes('paid')) {
    return null
  }

  try {
    // Row 9: UNIT NO: ... "2F" 1 "Megatower 2"
    // Row 10: UNIT OWNER: ... "Owner Name"
    // Row 16: Electric consumption row - last column has amount
    // Row 19: Water row - last column has amount
    // Row 23-24: Association dues
    // Row 26: Total

    let unitNumber = ''
    let ownerName = ''
    let electric = 0
    let water = 0
    let dues = 0
    let parking = 0
    let total = 0

    // Parse unit number from sheet name
    unitNumber = `M2-2F-${sheetName}`

    // Find owner name (row 10, column 5)
    for (let i = 0; i < Math.min(data.length, 15); i++) {
      const row = data[i]
      if (row && row[0] && String(row[0]).includes('UNIT OWNER')) {
        ownerName = row[5] || ''
        break
      }
    }

    // Find electric amount (row with electricity data)
    for (let i = 15; i < Math.min(data.length, 20); i++) {
      const row = data[i]
      if (row && row.length > 0) {
        // Look for the electric amount - usually the last non-null value
        const electricRow = row.filter((v: any) => v !== null && v !== undefined && typeof v === 'number')
        if (electricRow.length >= 4 && row[0] && String(row[0]).includes('TO')) {
          // This is the electricity row
          electric = electricRow[electricRow.length - 1] || 0
          break
        }
      }
    }

    // Find water amount
    for (let i = 18; i < Math.min(data.length, 25); i++) {
      const row = data[i]
      if (row && row.length > 0 && row[0] && String(row[0]).includes('TO')) {
        const waterRow = row.filter((v: any) => v !== null && v !== undefined && typeof v === 'number')
        if (waterRow.length >= 3) {
          water = waterRow[waterRow.length - 1] || 0
          break
        }
      }
    }

    // Find dues and parking
    for (let i = 20; i < Math.min(data.length, 30); i++) {
      const row = data[i]
      if (row) {
        const rowStr = JSON.stringify(row)
        if (rowStr.includes('Rate per Sq.mtr')) {
          // Main dues row
          const duesRow = row.filter((v: any) => v !== null && v !== undefined && typeof v === 'number')
          if (duesRow.length >= 2) {
            dues = duesRow[duesRow.length - 1] || 0
          }
        }
        if (rowStr.includes('Parking area')) {
          // Parking row
          const parkingRow = row.filter((v: any) => v !== null && v !== undefined && typeof v === 'number')
          if (parkingRow.length >= 1) {
            parking = parkingRow[0] || 0
            // Also check for total dues + parking
            if (parkingRow.length >= 3) {
              const totalDues = parkingRow[parkingRow.length - 1]
              if (totalDues > dues) {
                dues = totalDues - parking
              }
            }
          }
        }
      }
    }

    // Find total amount
    for (let i = 20; i < Math.min(data.length, 35); i++) {
      const row = data[i]
      if (row) {
        const rowStr = JSON.stringify(row)
        if (rowStr.includes('TOTAL AMOUNT')) {
          const totalRow = row.filter((v: any) => v !== null && v !== undefined && typeof v === 'number')
          if (totalRow.length >= 1) {
            total = totalRow[totalRow.length - 1] || 0
          }
          break
        }
      }
    }

    return { unitNumber, ownerName, electric, water, dues, parking, total }
  } catch (e) {
    console.error(`Error parsing sheet ${sheetName}:`, e)
    return null
  }
}

async function main() {
  const excelPath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx'

  console.log('Reading Excel file:', excelPath)
  const workbook = XLSX.readFile(excelPath)

  // Parse all sheets
  const excelBills: ExcelBill[] = []
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const bill = parseExcelSheet(sheet, sheetName)
    if (bill) {
      excelBills.push(bill)
    }
  }

  console.log(`\nParsed ${excelBills.length} bills from Excel\n`)

  // Get October bills from database
  const dbBillsRaw = await prisma.bill.findMany({
    where: {
      billingMonth: new Date('2025-10-01'),
      unit: {
        unitNumber: { startsWith: 'M2-2F' }
      }
    },
    include: {
      unit: {
        include: {
          owner: true
        }
      }
    },
    orderBy: {
      unit: { unitNumber: 'asc' }
    }
  })

  // Create a map of unit -> bill data
  const dbBills = new Map<string, any>()
  dbBillsRaw.forEach(b => {
    dbBills.set(b.unit.unitNumber, {
      owner: b.unit.owner ? `${b.unit.owner.lastName}, ${b.unit.owner.firstName}` : 'No Owner',
      electric: Number(b.electricAmount),
      water: Number(b.waterAmount),
      dues: Number(b.associationDues),
      parking: Number(b.parkingFee || 0),
      spAssessment: Number(b.spAssessment || 0),
      previousBalance: 0, // We'll calculate this differently
      penaltyAmount: Number(b.penaltyAmount || 0),
      total: Number(b.totalAmount)
    })
  })

  // Compare
  console.log('=== COMPARISON: Excel vs Database ===\n')
  console.log('Unit       | Owner (Excel)                  | Excel Total | DB Total    | Diff     | Issue')
  console.log('-'.repeat(120))

  let totalDiff = 0
  let issueCount = 0

  // Sort excelBills by unit number
  excelBills.sort((a, b) => {
    const numA = parseInt(a.unitNumber.split('-').pop() || '0')
    const numB = parseInt(b.unitNumber.split('-').pop() || '0')
    return numA - numB
  })

  for (const excelBill of excelBills) {
    const dbBill = dbBills.get(excelBill.unitNumber)

    if (!dbBill) {
      console.log(`${excelBill.unitNumber.padEnd(10)} | ${excelBill.ownerName.substring(0, 30).padEnd(30)} | ${excelBill.total.toFixed(2).padStart(11)} | NOT FOUND   |          | Missing in DB`)
      issueCount++
      continue
    }

    const diff = Math.abs(excelBill.total - dbBill.total)
    const diffStr = diff.toFixed(2).padStart(8)
    let issue = ''

    if (diff > 0.01) {
      issueCount++
      totalDiff += diff

      // Detailed breakdown
      if (Math.abs(excelBill.electric - dbBill.electric) > 0.01) {
        issue += `Elec(E:${excelBill.electric.toFixed(2)} D:${dbBill.electric.toFixed(2)}) `
      }
      if (Math.abs(excelBill.water - dbBill.water) > 0.01) {
        issue += `Water(E:${excelBill.water.toFixed(2)} D:${dbBill.water.toFixed(2)}) `
      }
      if (Math.abs(excelBill.dues - dbBill.dues) > 0.01) {
        issue += `Dues(E:${excelBill.dues.toFixed(2)} D:${dbBill.dues.toFixed(2)}) `
      }
      if (Math.abs(excelBill.parking - dbBill.parking) > 0.01) {
        issue += `Parking(E:${excelBill.parking.toFixed(2)} D:${dbBill.parking.toFixed(2)}) `
      }
      if (dbBill.penaltyAmount > 0) {
        issue += `Penalty:${dbBill.penaltyAmount.toFixed(2)} `
      }
      if (issue === '') {
        issue = 'Prev Balance?'
      }
    } else {
      issue = 'OK'
    }

    console.log(`${excelBill.unitNumber.padEnd(10)} | ${excelBill.ownerName.substring(0, 30).padEnd(30)} | ${excelBill.total.toFixed(2).padStart(11)} | ${dbBill.total.toFixed(2).padStart(11)} | ${diffStr} | ${issue}`)
  }

  console.log('\n' + '='.repeat(120))
  console.log(`\nSUMMARY: ${issueCount} issues found, Total difference: ${totalDiff.toFixed(2)}`)

  // Show detailed breakdown for units with issues
  console.log('\n=== DETAILED BREAKDOWN FOR UNITS WITH DIFFERENCES ===\n')

  for (const excelBill of excelBills) {
    const dbBill = dbBills.get(excelBill.unitNumber)
    if (!dbBill) continue

    const diff = Math.abs(excelBill.total - dbBill.total)
    if (diff > 0.01) {
      console.log(`\n${excelBill.unitNumber} - ${excelBill.ownerName}:`)
      console.log(`  Excel:    Elec: ${excelBill.electric.toFixed(2)}, Water: ${excelBill.water.toFixed(2)}, Dues: ${excelBill.dues.toFixed(2)}, Parking: ${excelBill.parking.toFixed(2)}, Total: ${excelBill.total.toFixed(2)}`)
      console.log(`  Database: Elec: ${dbBill.electric.toFixed(2)}, Water: ${dbBill.water.toFixed(2)}, Dues: ${dbBill.dues.toFixed(2)}, Parking: ${dbBill.parking.toFixed(2)}, Penalty: ${dbBill.penaltyAmount.toFixed(2)}, Total: ${dbBill.total.toFixed(2)}`)
      console.log(`  Difference: ${(dbBill.total - excelBill.total).toFixed(2)}`)
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
