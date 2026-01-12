import * as XLSX from 'xlsx';
import * as fs from 'fs';

const filePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx';

// Read the Excel file
const workbook = XLSX.readFile(filePath);

console.log('=== SHEET NAMES ===');
console.log(workbook.SheetNames);
console.log('\n');

// Read each worksheet
workbook.SheetNames.forEach((sheetName, index) => {
  if (index < 20) { // Limit to first 20 sheets
    console.log(`\n=== SHEET: ${sheetName} ===`);
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON with headers
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // Print first 50 rows
    data.slice(0, 50).forEach((row: any, rowIndex: number) => {
      // Filter out empty cells and show row
      const nonEmpty = row.filter((cell: any) => cell !== '');
      if (nonEmpty.length > 0) {
        console.log(`Row ${rowIndex}: ${JSON.stringify(row.slice(0, 20))}`);
      }
    });
  }
});
