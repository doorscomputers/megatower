const XLSX = require('xlsx')

const filePath = process.argv[2] || 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (nov 2025.xlsx'

console.log('Analyzing Excel file for previous readings:', filePath)
console.log('='.repeat(80))

const wb = XLSX.readFile(filePath)

// Analyze first non-summary sheet
for (const sheetName of wb.SheetNames) {
  const upperName = sheetName.toUpperCase()
  if (upperName.includes('SUMMARY') || upperName.includes('BALANCES') || upperName.includes('PAID') || upperName.includes('(A)')) {
    continue
  }

  const ws = wb.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  console.log(`\n=== Sheet: ${sheetName} ===`)

  // Show rows 14-20 with columns 0-20
  console.log('\n--- Full rows 14-20 (all columns) ---')
  for (let i = 14; i < Math.min(21, data.length); i++) {
    const row = data[i] || []
    console.log(`\nRow ${i}:`)
    for (let j = 0; j < Math.min(20, row.length); j++) {
      if (row[j] !== '') {
        console.log(`  Col ${j}: "${row[j]}"`)
      }
    }
  }

  // Extract readings based on structure
  console.log('\n\n--- Extracted values ---')
  // Electric: labels at row 15, values at row 16
  const elecRow = data[16] || []
  console.log(`Electric row (16):`)
  console.log(`  Col 7 (Pres?): "${elecRow[7]}"`)
  console.log(`  Col 9 (Prev?): "${elecRow[9]}"`)
  console.log(`  Col 11 (Cons): "${elecRow[11]}"`)

  // Water: labels at row 18, values at row 19
  const waterRow = data[19] || []
  console.log(`Water row (19):`)
  console.log(`  Col 7 (Pres?): "${waterRow[7]}"`)
  console.log(`  Col 9 (Prev?): "${waterRow[9]}"`)
  console.log(`  Col 11 (Cons): "${waterRow[11]}"`)

  // Only analyze first sheet
  break
}
