import XLSX from 'xlsx'

const excelPath = "c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx"
const workbook = XLSX.readFile(excelPath)

console.log('=== October 2025 Excel Analysis ===\n')
console.log('Sheets:', workbook.SheetNames)

// Analyze first sheet (M2-2F-1)
const sheet = workbook.Sheets['1']
const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]

console.log('\n=== Sheet 1 (M2-2F-1) Full Data ===\n')
for (let i = 0; i < Math.min(50, rawData.length); i++) {
  const row = rawData[i]
  if (row && row.some((v: any) => v !== null && v !== undefined && v !== '')) {
    console.log(`Row ${i}: ${JSON.stringify(row)}`)
  }
}
