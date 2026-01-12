import * as XLSX from 'xlsx';

const filePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\NOV 2025.xlsx';

const workbook = XLSX.readFile(filePath);

console.log('Sheet Names:', workbook.SheetNames);
console.log('\n');

for (const sheetName of workbook.SheetNames) {
  console.log(`========================================`);
  console.log(`Sheet: ${sheetName}`);
  console.log(`========================================`);

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  console.log(`Total rows: ${data.length}`);
  console.log('\nFirst 30 rows:');

  for (let i = 0; i < Math.min(30, data.length); i++) {
    if (data[i] && data[i].length > 0) {
      console.log(`Row ${i}: ${JSON.stringify(data[i].slice(0, 15))}`);
    }
  }
  console.log('\n');
}
