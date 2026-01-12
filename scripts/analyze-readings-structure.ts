import * as XLSX from 'xlsx';

const filePath = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/December/DECEMBER 2025.xlsx';
const wb = XLSX.readFile(filePath);

console.log("=== DECEMBER 2025.xlsx STRUCTURE ===\n");
console.log("Sheet names:", wb.SheetNames.join(", "));

// Check for 2F sheet
const sheetName = wb.SheetNames.find(name => name.includes('2F') || name === '2F');
if (!sheetName) {
  console.log("\nNo 2F sheet found. Checking all sheets:");
  for (const name of wb.SheetNames) {
    const sheet = wb.Sheets[name];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    console.log(`\nSheet "${name}": ${data.length} rows`);
    if (data.length > 0) {
      console.log("First few rows:");
      for (let i = 0; i < Math.min(5, data.length); i++) {
        console.log(`  Row ${i}: ${JSON.stringify(data[i]?.slice(0, 15))}`);
      }
    }
  }
} else {
  console.log(`\nAnalyzing sheet: "${sheetName}"`);
  const sheet = wb.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  console.log(`Total rows: ${data.length}\n`);

  // Print first 15 rows to understand structure
  console.log("First 15 rows:");
  for (let i = 0; i < Math.min(15, data.length); i++) {
    const row = data[i] || [];
    console.log(`Row ${i}: ${JSON.stringify(row.slice(0, 15))}`);
  }

  // Look for headers with "UNIT", "PRES", "PREV", "CONS", etc.
  console.log("\n\nSearching for header row...");
  for (let i = 0; i < Math.min(20, data.length); i++) {
    const row = data[i] || [];
    const rowStr = row.join(' ').toUpperCase();
    if (rowStr.includes('UNIT') || rowStr.includes('PRES') || rowStr.includes('PREV')) {
      console.log(`\nPotential header at row ${i}:`);
      for (let j = 0; j < row.length; j++) {
        if (row[j]) console.log(`  Col ${j}: "${row[j]}"`);
      }
    }
  }

  // Print a few data rows after finding header
  console.log("\n\nSample data rows (rows 8-20):");
  for (let i = 8; i < Math.min(25, data.length); i++) {
    const row = data[i] || [];
    if (row.length > 0 && row[0]) {
      console.log(`Row ${i}: ${JSON.stringify(row.slice(0, 15))}`);
    }
  }
}
