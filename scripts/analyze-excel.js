const XLSX = require('xlsx')
const path = require('path')

// Analyze the Excel files to understand their structure
const files = [
  'C:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (sept 2025).xlsx',
  'C:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx'
]

for (const filePath of files) {
  console.log('\n' + '='.repeat(80))
  console.log('FILE:', path.basename(filePath))
  console.log('='.repeat(80))

  const wb = XLSX.read(require('fs').readFileSync(filePath), { type: 'buffer' })

  console.log('\nSheets:', wb.SheetNames.join(', '))

  // Look at first non-summary sheet
  for (const sheetName of wb.SheetNames) {
    const upperName = sheetName.toUpperCase()
    if (upperName.includes('SUMMARY') || upperName.includes('BALANCES') || upperName.includes('PAID')) continue

    console.log('\n--- Sheet:', sheetName, '---')
    const ws = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

    // Print first 50 rows to understand structure
    for (let i = 0; i < Math.min(50, data.length); i++) {
      const row = data[i]
      if (row && row.some(cell => cell !== '')) {
        // Only print non-empty cells with their column index
        const cells = row.map((cell, idx) => cell !== '' ? `[${idx}]${cell}` : null).filter(Boolean)
        if (cells.length > 0) {
          console.log(`Row ${i}: ${cells.join(' | ')}`)
        }
      }
    }

    // Only show first unit sheet
    break
  }
}
