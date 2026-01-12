/**
 * Explore October Excel file to verify bill calculations
 */

import * as XLSX from 'xlsx'

const EXCEL_PATH = 'C:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx'

function main() {
  console.log('Reading Excel file:', EXCEL_PATH)

  const wb = XLSX.readFile(EXCEL_PATH)

  console.log('\nSheet Names:')
  wb.SheetNames.forEach((name, idx) => {
    console.log(`  ${idx + 1}. ${name}`)
  })

  // Read first sheet (Unit 1) to understand October bill structure
  const sheet1 = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(sheet1, { header: 1, defval: '' }) as any[][]

  console.log('\n=== SHEET 1 (M2-2F-1) OCTOBER BILL ===')
  console.log('Total rows:', data.length)

  // Show all rows with data to understand the structure
  console.log('\n--- All Rows with Data ---')
  for (let i = 0; i < Math.min(data.length, 60); i++) {
    const row = data[i]
    const nonEmpty = row.filter(v => v !== '' && v !== undefined && v !== null)
    if (nonEmpty.length > 0) {
      // Show row number and content
      const preview = row.slice(0, 16).map((v, idx) => {
        if (v !== '' && v !== undefined && v !== null) {
          return `${String.fromCharCode(65 + idx)}="${v}"`
        }
        return null
      }).filter(Boolean).join(', ')
      if (preview) {
        console.log(`Row ${i + 1}: ${preview}`)
      }
    }
  }

  // Look specifically for October bill section
  console.log('\n--- Looking for OCTOBER 2025 Bill Section ---')
  for (let i = 0; i < data.length; i++) {
    const row = data[i]
    const rowStr = row.join(' ').toUpperCase()
    if (rowStr.includes('OCTOBER') || rowStr.includes('OCT 2025') || rowStr.includes('ELECTRIC') || rowStr.includes('WATER') || rowStr.includes('ASSOC')) {
      console.log(`Row ${i + 1}:`, row.slice(0, 16).filter(v => v !== ''))
    }
  }

  // Try to find the billing section with numbers
  console.log('\n--- Rows 15-35 (Bill Calculation Area) ---')
  for (let i = 14; i <= 34 && i < data.length; i++) {
    const row = data[i]
    const cols = []
    for (let c = 0; c <= 15; c++) {
      const val = row[c]
      if (val !== '' && val !== undefined && val !== null) {
        cols.push(`${String.fromCharCode(65 + c)}="${val}"`)
      }
    }
    if (cols.length > 0) {
      console.log(`  Row ${i + 1}: ${cols.join(', ')}`)
    }
  }
}

main()
