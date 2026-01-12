import * as XLSX from 'xlsx';

const filePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (sept 2025).xlsx';

const workbook = XLSX.readFile(filePath);

// Focus on worksheets 16 and 17
const targetSheets = ['16', '17'];

for (const sheetName of targetSheets) {
  if (!workbook.SheetNames.includes(sheetName)) {
    console.log(`Sheet "${sheetName}" not found`);
    continue;
  }

  console.log(`\n========================================`);
  console.log(`Sheet: ${sheetName}`);
  console.log(`========================================`);

  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Get unit info from row 9
  const row9 = data[9] || [];
  const floor = row9[5];
  const unitNum = row9[6];
  console.log(`Unit: ${floor}-${unitNum}`);

  // Get owner from row 10
  const row10 = data[10] || [];
  console.log(`Owner: ${row10[5]}`);

  // Look at Balance Record section (rows 29-40)
  console.log('\nBalance Record Section:');
  for (let i = 29; i < Math.min(45, data.length); i++) {
    if (data[i] && data[i].some((cell: any) => cell !== null && cell !== undefined)) {
      console.log(`Row ${i}: ${JSON.stringify(data[i].slice(0, 15))}`);
    }
  }

  // Look for TOTAL row
  console.log('\nSearching for TOTAL PAST DUES...');
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (row) {
      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (cell && typeof cell === 'string' && cell.toUpperCase().includes('TOTAL')) {
          console.log(`Found at Row ${i}, Col ${j}: "${cell}" - Next values: ${JSON.stringify(row.slice(j, j + 5))}`);
        }
      }
      // Also check for numeric values that might be totals
      if (row[9] && typeof row[9] === 'number' && row[9] > 1000) {
        console.log(`Potential total at Row ${i}, Col 9: ${row[9]}`);
      }
    }
  }
}
