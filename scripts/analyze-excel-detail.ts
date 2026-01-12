import * as ExcelJS from 'exceljs';

async function analyzeExcelDetail() {
  const excelFilePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (sept 2025).xlsx';

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelFilePath);

  // Analyze first sheet in detail
  const worksheet = workbook.worksheets[0];
  console.log(`\nAnalyzing worksheet: ${worksheet.name}`);
  console.log('Looking for billing amounts...\n');

  // Display rows 1-50 to find the billing details
  for (let rowNum = 1; rowNum <= Math.min(50, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    const rowData: any[] = [];

    for (let col = 1; col <= Math.min(20, worksheet.columnCount); col++) {
      const cell = row.getCell(col);
      let value = cell.value;

      if (value && typeof value === 'object' && 'result' in value) {
        value = value.result;
      }

      if (value !== null && value !== undefined && value !== '' && value !== ' ') {
        rowData.push(`[${col}]: ${value}`);
      }
    }

    if (rowData.length > 0) {
      console.log(`Row ${rowNum}: ${rowData.join(' | ')}`);
    }
  }
}

analyzeExcelDetail()
  .then(() => console.log('\nDone!'))
  .catch(console.error);
