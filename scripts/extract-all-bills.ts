import * as ExcelJS from 'exceljs';
import * as fs from 'fs';

interface BillData {
  unitNumber: string;
  ownerName: string;
  electric: number;
  water: number;
  associationDues: number;
  spAssessment: number;
  total: number;
}

async function extractAllBills() {
  const excelFilePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (sept 2025).xlsx';
  const outputCsvPath = 'D:\\Megatower\\scripts\\september-2025-bills.csv';

  console.log('Reading Excel file:', excelFilePath);

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(excelFilePath);

  const billsData: BillData[] = [];

  // Process each worksheet
  workbook.eachSheet((worksheet, sheetId) => {
    console.log(`\nProcessing Sheet ${sheetId}: ${worksheet.name}`);

    try {
      // Find unit number (Row 10, Column 10-11)
      const unitFloor = worksheet.getCell('J10').value?.toString() || '';
      const unitNum = worksheet.getCell('K10').value?.toString() || '';
      const unitNumber = `${unitFloor} ${unitNum}`.trim();

      // Find owner name (Row 11, Column 10)
      const ownerName = worksheet.getCell('J11').value?.toString() || '';

      // Find billing amounts - need to locate them in the sheet
      // Based on the structure, let's look for the payment records
      // Row 38-43 shows the payment breakdown with amounts in column 16-17

      let electric = 0;
      let water = 0;
      let associationDues = 0;
      let spAssessment = 0;

      // Look through rows to find the current billing amounts
      // The amounts appear to be in the "PAYMENT AS OF" section
      for (let rowNum = 35; rowNum <= 45; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const label = row.getCell(8).value?.toString()?.toUpperCase() || '';

        if (label.includes('ELECTRIC')) {
          const amount = parseFloat(row.getCell(16).value?.toString() || '0');
          if (amount > 0) electric = amount;
        } else if (label.includes('WATER')) {
          const amount = parseFloat(row.getCell(16).value?.toString() || '0');
          if (amount > 0) water = amount;
        } else if (label.includes('ASSOC')) {
          const amount = parseFloat(row.getCell(16).value?.toString() || '0');
          if (amount > 0) associationDues = amount;
        } else if (label.includes('SPECIAL')) {
          const amount = parseFloat(row.getCell(16).value?.toString() || '0');
          if (amount > 0) spAssessment = amount;
        }
      }

      // Also check for SP Assessment in the right side
      for (let rowNum = 35; rowNum <= 45; rowNum++) {
        const row = worksheet.getRow(rowNum);
        const label = row.getCell(18).value?.toString()?.toUpperCase() || '';

        if (label.includes('SP') && label.includes('ASSESS')) {
          const amount = parseFloat(row.getCell(20).value?.toString() || '0');
          if (amount > 0) spAssessment = amount;
        }
      }

      const total = electric + water + associationDues + spAssessment;

      if (unitNumber) {
        billsData.push({
          unitNumber,
          ownerName,
          electric,
          water,
          associationDues,
          spAssessment,
          total
        });

        console.log(`  Unit: ${unitNumber}`);
        console.log(`  Owner: ${ownerName}`);
        console.log(`  Electric: ${electric}`);
        console.log(`  Water: ${water}`);
        console.log(`  Assoc Dues: ${associationDues}`);
        console.log(`  SP Assessment: ${spAssessment}`);
        console.log(`  Total: ${total}`);
      }
    } catch (error) {
      console.log(`  Error processing sheet: ${error}`);
    }
  });

  // Generate CSV
  console.log(`\n\nGenerating CSV file: ${outputCsvPath}`);

  const csvLines = [
    'Unit Number,Owner Name,Electric,Water,Association Dues,SP Assessment,Total'
  ];

  billsData.forEach(bill => {
    csvLines.push(
      `"${bill.unitNumber}","${bill.ownerName}",${bill.electric},${bill.water},${bill.associationDues},${bill.spAssessment},${bill.total}`
    );
  });

  fs.writeFileSync(outputCsvPath, csvLines.join('\n'), 'utf-8');

  console.log(`\nCSV file created successfully!`);
  console.log(`Total records: ${billsData.length}`);
}

extractAllBills()
  .then(() => console.log('\nExtraction complete!'))
  .catch(console.error);
