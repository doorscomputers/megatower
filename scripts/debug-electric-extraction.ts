import * as XLSX from 'xlsx';

/**
 * Debug script to understand why electric payments are showing as 0
 */

const octoberFile = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx';

const workbook = XLSX.readFile(octoberFile);

// Check the first sheet (Unit 2F 1)
const worksheet = workbook.Sheets['1'];
const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
  header: 1,
  raw: false,
  defval: ''
});

console.log('Looking for payment section in Unit 2F 1...\n');

// Find payment section
let paymentSectionStart = -1;
for (let i = 0; i < rawData.length; i++) {
  const row = rawData[i];
  if (row.some((cell: string) => cell && cell.toString().includes('PAYMENT AS OF')) &&
      row.some((cell: string) => cell && cell.toString().includes('SEPTEMBER'))) {
    paymentSectionStart = i;
    break;
  }
}

console.log(`Payment section starts at row ${paymentSectionStart + 1}\n`);

// Show the next 10 rows in detail
const paymentRows = rawData.slice(paymentSectionStart, paymentSectionStart + 10);

paymentRows.forEach((row: any[], idx: number) => {
  console.log(`\nRow ${paymentSectionStart + idx + 1}:`);
  row.forEach((cell: any, cellIdx: number) => {
    if (cell && cell.toString().trim()) {
      console.log(`  Col ${cellIdx}: "${cell}"`);
    }
  });
});
