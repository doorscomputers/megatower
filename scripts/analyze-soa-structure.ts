import * as XLSX from 'xlsx';

const filePath = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/December/2ND FLOOR December.xlsx';
const wb = XLSX.readFile(filePath);

console.log("=== ANALYZING SOA SHEET STRUCTURE ===\n");

// Analyze sheet "1" (Unit M2-2F-1) to find charge locations
const sheet = wb.Sheets['1'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

console.log("Sheet '1' (M2-2F-1) - Full structure:\n");

for (let i = 0; i < Math.min(50, data.length); i++) {
  const row = data[i] || [];
  if (row.length > 0 && row.some(cell => cell !== null && cell !== undefined)) {
    console.log(`Row ${i}: ${JSON.stringify(row.slice(0, 15))}`);
  }
}

// Look for specific billing keywords
console.log("\n\n=== SEARCHING FOR BILLING DATA ===");
const keywords = ['ELECTRIC', 'WATER', 'DUES', 'TOTAL', 'AMOUNT', 'PRESENT', 'PREVIOUS'];
for (let i = 0; i < data.length; i++) {
  const row = data[i] || [];
  const rowStr = row.join(' ').toUpperCase();
  for (const kw of keywords) {
    if (rowStr.includes(kw)) {
      console.log(`\nRow ${i} (contains ${kw}):`);
      for (let j = 0; j < row.length; j++) {
        if (row[j] !== null && row[j] !== undefined && row[j] !== '') {
          console.log(`  Col ${j}: "${row[j]}"`);
        }
      }
      break;
    }
  }
}
