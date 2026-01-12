import * as XLSX from 'xlsx'
import * as path from 'path'

const filePath = process.argv[2] || 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (nov 2025.xlsx'

console.log('Analyzing Excel file:', filePath)
console.log('='.repeat(80))

const wb = XLSX.readFile(filePath)

console.log('\nSheet names:', wb.SheetNames)
console.log('\nAnalyzing first sheet:', wb.SheetNames[0])

const ws = wb.Sheets[wb.SheetNames[0]]
const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as any[][]

console.log('\nTotal rows:', data.length)
console.log('\n--- Rows 1-15 (looking for unit number and owner) ---\n')

for (let i = 0; i < Math.min(15, data.length); i++) {
  const row = data[i] || []
  console.log(`Row ${i}: [${row.slice(0, 12).map((cell, j) => `${j}:"${cell}"`).join(', ')}]`)
}

console.log('\n--- Looking for "UNIT NO" text ---\n')
for (let i = 0; i < Math.min(20, data.length); i++) {
  const row = data[i] || []
  for (let j = 0; j < row.length; j++) {
    if (String(row[j]).toUpperCase().includes('UNIT')) {
      console.log(`Found "UNIT" at Row ${i}, Col ${j}: "${row[j]}"`)
    }
  }
}

console.log('\n--- Looking for "TOTAL AMOUNT DUE" text ---\n')
for (let i = 30; i < Math.min(60, data.length); i++) {
  const row = data[i] || []
  for (let j = 0; j < row.length; j++) {
    if (String(row[j]).toUpperCase().includes('TOTAL AMOUNT DUE')) {
      console.log(`Found at Row ${i}, Col ${j}: "${row[j]}"`)
      console.log(`  Full row: [${row.map((cell, idx) => `${idx}:"${cell}"`).join(', ')}]`)
    }
  }
}

console.log('\n--- Current parsing logic expects ---')
console.log('Row 9 (index 9): Unit number at cols 7-8')
console.log('Row 10 (index 10): Owner name at col 7')
console.log('Rows 30-55: "TOTAL AMOUNT DUE AND PAYABLE" at col 3, value at col 20')

console.log('\n--- Actual data at expected positions ---')
console.log('Row 9:', data[9]?.slice(0, 12))
console.log('Row 10:', data[10]?.slice(0, 12))
