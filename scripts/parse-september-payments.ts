import * as XLSX from 'xlsx';
import * as path from 'path';

/**
 * Script to extract September 2025 payments from October 2025 SOA Excel file
 *
 * Logic:
 * - October SOA shows "Prev Bal" which is the balance after September payments
 * - September SOA shows the original September balance
 * - Payment = September Total Due - October Prev Bal
 */

interface UnitPaymentData {
  unitNumber: string;
  septemberTotalDue: number;
  octoberPrevBal: number;
  septemberPayment: number;
  ownerName?: string;
}

function parseExcelFile(filePath: string) {
  console.log(`\n=== Parsing: ${path.basename(filePath)} ===`);

  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Get the range to see all cells
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  console.log(`Sheet range: ${XLSX.utils.encode_range(range)}`);

  // Convert to array of arrays to see the raw structure
  const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });

  console.log(`Found ${rawData.length} rows`);

  return { rawData, sheetName, worksheet };
}

function main() {
  const octoberFile = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx';
  const septemberFile = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (sept 2025).xlsx';

  console.log('==========================================');
  console.log('SEPTEMBER 2025 PAYMENT EXTRACTION SCRIPT');
  console.log('==========================================');

  // Parse both files
  const octoberData = parseExcelFile(octoberFile);
  const septemberData = parseExcelFile(septemberFile);

  console.log('\n=== RAW DATA STRUCTURE ===');
  console.log('\nOctober SOA - Rows 45-59 (final balance):');
  octoberData.rawData.slice(44, 59).forEach((row: any, idx: number) => {
    console.log(`Row ${idx + 45}:`, row);
  });

  console.log('\n\nSeptember SOA - Rows 45-59 (final balance):');
  septemberData.rawData.slice(44, 59).forEach((row: any, idx: number) => {
    console.log(`Row ${idx + 45}:`, row);
  });
}

main();
