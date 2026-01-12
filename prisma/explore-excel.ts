import * as XLSX from 'xlsx'

const EXCEL_PATH = 'C:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx'

function main() {
  console.log('Reading Excel file:', EXCEL_PATH)

  const wb = XLSX.readFile(EXCEL_PATH)

  console.log('\nSheet Names:')
  wb.SheetNames.forEach((name, idx) => {
    console.log(`  ${idx + 1}. ${name}`)
  })

  // Read first sheet to understand structure
  const firstSheet = wb.Sheets[wb.SheetNames[0]]
  const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1, defval: '' }) as any[][]

  console.log('\n--- First Sheet Structure ---')
  console.log('Total rows:', data.length)

  // Show rows 8-12 (unit info area)
  console.log('\nRows 8-12 (Unit Info):')
  for (let i = 7; i <= 11 && i < data.length; i++) {
    const row = data[i]
    console.log(`  Row ${i + 1}:`, row.slice(6, 12).map(v => String(v).substring(0, 20)))
  }

  // Show rows 35-50 (payment area) - more columns
  console.log('\nRows 35-50 (Payment Area - Full):')
  for (let i = 34; i <= 49 && i < data.length; i++) {
    const row = data[i]
    // Show columns D through P
    const cols = []
    for (let c = 3; c <= 15; c++) {
      const val = row[c]
      if (val !== '' && val !== undefined && val !== null) {
        cols.push(`${String.fromCharCode(65 + c)}="${val}"`)
      }
    }
    if (cols.length > 0) {
      console.log(`  Row ${i + 1}: ${cols.join(', ')}`)
    }
  }

  // Check a second sheet
  console.log('\n--- Second Sheet (Unit 2) Payment Area ---')
  const sheet2 = wb.Sheets[wb.SheetNames[1]]
  const data2 = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: '' }) as any[][]

  for (let i = 34; i <= 49 && i < data2.length; i++) {
    const row = data2[i]
    const cols = []
    for (let c = 3; c <= 15; c++) {
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
