import * as XLSX from 'xlsx';

const filePath = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/December/2ND FLOOR December.xlsx';
const wb = XLSX.readFile(filePath);

console.log("Sheet names:", wb.SheetNames.join(", "));

// Analyze sheet '1' to understand structure
const sheet = wb.Sheets['1'];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

console.log('\n=== Analyzing Sheet 1 (Unit M2-2F-1) ===');
console.log('Total rows:', data.length);

// Show all rows to understand structure
console.log('\nAll rows with content:');
for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (row && row.length > 0) {
    // Show row index and first few non-empty cells
    const cells = row.map((c: any, j: number) => `[${j}]=${c}`).filter((c: string) => !c.endsWith('='));
    if (cells.length > 0) {
      console.log(`Row ${i}: ${cells.slice(0, 8).join(', ')}`);
    }
  }
}
