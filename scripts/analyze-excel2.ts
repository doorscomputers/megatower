import * as XLSX from 'xlsx'

const filePath = process.argv[2] || 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (nov 2025.xlsx'

console.log('Analyzing Excel file:', filePath)

const wb = XLSX.readFile(filePath)
const ws = wb.Sheets[wb.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

console.log('\n--- Rows 40-55 (looking for balance amount) ---\n')
for (let i = 40; i < Math.min(55, data.length); i++) {
  const row = data[i] || []
  // Show non-empty cells
  const nonEmpty = row.map((cell, j) => cell !== '' ? `${j}:"${cell}"` : null).filter(Boolean)
  if (nonEmpty.length > 0) {
    console.log(`Row ${i}: [${nonEmpty.join(', ')}]`)
  }
}

// Also check the range reference for merged cells
console.log('\n--- Checking worksheet range ---')
console.log('Range:', ws['!ref'])

// Check for any numeric values that could be the balance
console.log('\n--- Looking for numeric values > 1000 (potential balances) ---')
for (let i = 0; i < data.length; i++) {
  const row = data[i] || []
  for (let j = 0; j < row.length; j++) {
    const val = row[j]
    if (typeof val === 'number' && val > 1000) {
      console.log(`Row ${i}, Col ${j}: ${val}`)
    }
  }
}
