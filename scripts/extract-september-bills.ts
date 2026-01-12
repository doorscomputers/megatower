import * as ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as path from 'path';

async function extractSeptemberBills() {
  const excelFilePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (sept 2025).xlsx';
  const outputCsvPath = 'D:\\Megatower\\scripts\\september-2025-bills.csv';

  console.log('Reading Excel file:', excelFilePath);

  // Create workbook and read file
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelFilePath);

  // Log worksheet information
  console.log('\nWorksheets in file:');
  workbook.eachSheet((worksheet, sheetId) => {
    console.log(`  Sheet ${sheetId}: ${worksheet.name} (${worksheet.rowCount} rows, ${worksheet.columnCount} cols)`);
  });

  // Get the first worksheet (or specify by name if needed)
  const worksheet = workbook.worksheets[0];
  console.log(`\nAnalyzing worksheet: ${worksheet.name}`);

  // Display first 20 rows to understand structure
  console.log('\nFirst 20 rows of data:');
  console.log('═'.repeat(120));

  for (let rowNum = 1; rowNum <= Math.min(20, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    const rowData: any[] = [];

    // Get values from first 15 columns
    for (let col = 1; col <= Math.min(15, worksheet.columnCount); col++) {
      const cell = row.getCell(col);
      let value = cell.value;

      // Handle formula cells
      if (value && typeof value === 'object' && 'result' in value) {
        value = value.result;
      }

      rowData.push(value);
    }

    console.log(`Row ${rowNum}:`, JSON.stringify(rowData, null, 2));
  }

  console.log('═'.repeat(120));
  console.log('\nPlease review the structure above to identify the correct columns.');
}

// Run the extraction
extractSeptemberBills()
  .then(() => {
    console.log('\nAnalysis complete!');
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
