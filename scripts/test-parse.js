const XLSX = require('xlsx')
const path = require('path')

const filePath = process.argv[2] || 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (nov 2025.xlsx'

console.log('Testing Excel parser with:', filePath)
console.log('='.repeat(80))

const wb = XLSX.readFile(filePath)
console.log('\nSheet names:', wb.SheetNames)

// Parse each sheet like the API does
for (const sheetName of wb.SheetNames) {
  const upperName = sheetName.toUpperCase()
  if (upperName.includes('SUMMARY') || upperName.includes('BALANCES') || upperName.includes('PAID')) {
    console.log(`\nSkipping sheet: ${sheetName}`)
    continue
  }

  const ws = wb.Sheets[sheetName]
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  if (data.length < 15) {
    console.log(`\nSheet ${sheetName}: Too few rows (${data.length})`)
    continue
  }

  // Row 9: Unit info (cols 5-7)
  const unitRow = data[9] || []
  const floorPrefix = String(unitRow[5] || '').trim()  // "2F"
  const unitNum = String(unitRow[6] || '').trim()       // "1"
  const building = String(unitRow[7] || '').trim()      // "Megatower 2"

  // Row 10: Owner name (col 5)
  const ownerRow = data[10] || []
  const ownerName = String(ownerRow[5] || '').trim()

  // Determine building prefix
  const buildingPrefix = building.includes('2') ? 'M2' : 'M1'

  // Find balance
  let balance = 0
  for (let i = 40; i < Math.min(55, data.length); i++) {
    const row = data[i] || []
    if (String(row[0]).toUpperCase().includes('TOTAL AMOUNT DUE AND PAYABLE')) {
      const prevRow = data[i - 1] || []
      balance = parseFloat(prevRow[17]) || 0
      console.log(`  Found balance label at row ${i}, value at row ${i-1} col 17: ${prevRow[17]}`)
      break
    }
  }

  const unitNumber = `${buildingPrefix}-${floorPrefix}-${unitNum}`

  console.log(`\n--- Sheet: ${sheetName} ---`)
  console.log(`  Row 9 (cols 5-7): "${floorPrefix}" | "${unitNum}" | "${building}"`)
  console.log(`  Row 10 (col 5): "${ownerName}"`)
  console.log(`  Building prefix: ${buildingPrefix}`)
  console.log(`  Final unit number: ${unitNumber}`)
  console.log(`  Balance: ${balance}`)
}
