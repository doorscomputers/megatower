const ExcelJS = require('exceljs');

async function deepAnalysis() {
  const workbook = new ExcelJS.Workbook();
  const filePath = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/NOV 2025 MEGATOWER II/2ND FLOOR (t2).xlsx';

  try {
    await workbook.xlsx.readFile(filePath);

    console.log('='.repeat(120));
    console.log('DEEP ANALYSIS: SOA Structure & OR# Patterns');
    console.log('='.repeat(120));

    // Analyze first 5 sheets in detail
    const sheets = workbook.worksheets.slice(0, 5);

    sheets.forEach((sheet, idx) => {
      console.log('\n' + '='.repeat(120));
      console.log(`SHEET ${idx + 1}: "${sheet.name}"`);
      console.log('='.repeat(120));

      // Get unit and owner info
      const unitInfo = getCellValue(sheet.getRow(10).getCell(10));
      const unitNum = getCellValue(sheet.getRow(10).getCell(11));
      const owner = getCellValue(sheet.getRow(11).getCell(10));
      console.log(`Unit: ${unitInfo}-${unitNum} | Owner: ${owner}`);

      // Print the PAYMENT SECTION (rows 37-45) cell by cell
      console.log('\n--- PAYMENT SECTION (Rows 37-45) - Cell by Cell ---');
      for (let r = 37; r <= 45; r++) {
        const row = sheet.getRow(r);
        const cells = [];
        for (let c = 7; c <= 18; c++) {  // Columns G to R
          const val = getCellValue(row.getCell(c));
          if (val) {
            cells.push(`[${getColumnLetter(c)}${r}:${val}]`);
          }
        }
        if (cells.length > 0) {
          console.log(`Row ${r}: ${cells.join(' ')}`);
        }
      }

      // Detailed payment breakdown
      console.log('\n--- INTERPRETED PAYMENT DATA ---');

      // Row 37: PAYMENT AS OF header
      const paymentAsOf = getCellValue(sheet.getRow(37).getCell(10));
      console.log(`Payment Reference: ${paymentAsOf}`);

      // Row 38: ELECTRIC payment
      const elecLabel = getCellValue(sheet.getRow(38).getCell(8));
      const elecOR = getCellValue(sheet.getRow(38).getCell(12));
      const elecAmt = getCellValue(sheet.getRow(38).getCell(16));
      console.log(`ELECTRIC: OR#=${elecOR}, Amount=₱${elecAmt}`);

      // Row 39: WATER payment
      const waterLabel = getCellValue(sheet.getRow(39).getCell(8));
      const waterOR = getCellValue(sheet.getRow(39).getCell(12));
      const waterAmt = getCellValue(sheet.getRow(39).getCell(16));
      console.log(`WATER: OR#=${waterOR}, Amount=₱${waterAmt}`);

      // Row 40: ASSOC DUES payment
      const duesLabel = getCellValue(sheet.getRow(40).getCell(8));
      const duesOR = getCellValue(sheet.getRow(40).getCell(12));
      const duesAmt = getCellValue(sheet.getRow(40).getCell(16));
      console.log(`ASSOC DUES: OR#=${duesOR}, Amount=₱${duesAmt}`);

      // Row 41: PAST DUES payment
      const pastLabel = getCellValue(sheet.getRow(41).getCell(8));
      const pastOR = getCellValue(sheet.getRow(41).getCell(12));
      const pastAmt = getCellValue(sheet.getRow(41).getCell(16));
      console.log(`PAST DUES: OR#=${pastOR || '(empty)'}, Amount=₱${pastAmt || '(empty)'}`);

      // Row 42: SPECIAL ASSESSMENT payment
      const specLabel = getCellValue(sheet.getRow(42).getCell(8));
      const specOR = getCellValue(sheet.getRow(42).getCell(12));
      const specAmt = getCellValue(sheet.getRow(42).getCell(16));
      console.log(`SPECIAL ASSESSMENT: OR#=${specOR || '(empty)'}, Amount=₱${specAmt || '(empty)'}`);

      // Row 43: ADVANCE PAYMENT
      const advLabel = getCellValue(sheet.getRow(43).getCell(8));
      const advOR = getCellValue(sheet.getRow(43).getCell(12));
      const advAmt = getCellValue(sheet.getRow(43).getCell(16));
      console.log(`ADVANCE PAYMENT: OR#=${advOR || '(empty)'}, Amount=₱${advAmt || '(empty)'}`);

      // Row 44: TOTAL PAYMENT
      const totalAmt = getCellValue(sheet.getRow(44).getCell(16));
      console.log(`TOTAL PAYMENT: ₱${totalAmt}`);

      // Print the BALANCE RECORD section (rows 30-35)
      console.log('\n--- BALANCE RECORD (Past Dues) ---');
      for (let r = 30; r <= 36; r++) {
        const row = sheet.getRow(r);
        const cells = [];
        for (let c = 7; c <= 24; c++) {
          const val = getCellValue(row.getCell(c));
          if (val && String(val).trim()) {
            cells.push(`[${getColumnLetter(c)}:${String(val).substring(0, 20)}]`);
          }
        }
        if (cells.length > 0) {
          console.log(`Row ${r}: ${cells.join(' ')}`);
        }
      }

      // Print the NOTICE section (rows 47-54)
      console.log('\n--- NOTICES ---');
      for (let r = 47; r <= 54; r++) {
        const row = sheet.getRow(r);
        const val = getCellValue(row.getCell(7));
        if (val && String(val).trim().length > 5) {
          console.log(`${val}`);
        }
      }
    });

    // Summary: Unique OR# analysis
    console.log('\n\n' + '='.repeat(120));
    console.log('OR# ANALYSIS ACROSS ALL UNITS');
    console.log('='.repeat(120));

    const orData = [];
    workbook.worksheets.forEach((sheet, idx) => {
      if (idx >= 19) return; // Skip last few summary sheets

      const unitInfo = getCellValue(sheet.getRow(10).getCell(10));
      const unitNum = getCellValue(sheet.getRow(10).getCell(11));
      const unit = `${unitInfo}-${unitNum}`;

      const elecOR = getCellValue(sheet.getRow(38).getCell(12));
      const elecAmt = getCellValue(sheet.getRow(38).getCell(16));
      const waterOR = getCellValue(sheet.getRow(39).getCell(12));
      const waterAmt = getCellValue(sheet.getRow(39).getCell(16));
      const duesOR = getCellValue(sheet.getRow(40).getCell(12));
      const duesAmt = getCellValue(sheet.getRow(40).getCell(16));

      if (elecOR || waterOR || duesOR) {
        orData.push({
          unit,
          elecOR, elecAmt,
          waterOR, waterAmt,
          duesOR, duesAmt
        });
      }
    });

    console.log('\nUnit'.padEnd(15) + 'Elec OR#'.padEnd(12) + 'Elec Amt'.padEnd(12) + 'Water OR#'.padEnd(12) + 'Water Amt'.padEnd(12) + 'Dues OR#'.padEnd(12) + 'Dues Amt');
    console.log('-'.repeat(85));

    orData.forEach(d => {
      console.log(
        String(d.unit).padEnd(15) +
        String(d.elecOR || '-').padEnd(12) +
        String(d.elecAmt || '-').padEnd(12) +
        String(d.waterOR || '-').padEnd(12) +
        String(d.waterAmt || '-').padEnd(12) +
        String(d.duesOR || '-').padEnd(12) +
        String(d.duesAmt || '-')
      );
    });

    // Check if same OR# appears multiple times
    console.log('\n--- OR# UNIQUENESS CHECK ---');
    const allORs = [];
    orData.forEach(d => {
      if (d.elecOR) allORs.push({ or: d.elecOR, unit: d.unit, type: 'ELECTRIC', amount: d.elecAmt });
      if (d.waterOR) allORs.push({ or: d.waterOR, unit: d.unit, type: 'WATER', amount: d.waterAmt });
      if (d.duesOR) allORs.push({ or: d.duesOR, unit: d.unit, type: 'DUES', amount: d.duesAmt });
    });

    // Group by OR#
    const orGroups = {};
    allORs.forEach(item => {
      if (!orGroups[item.or]) orGroups[item.or] = [];
      orGroups[item.or].push(item);
    });

    console.log('\nOR#s used by MULTIPLE entries (possible batch OR# or same unit multiple types):');
    Object.entries(orGroups).forEach(([or, items]) => {
      if (items.length > 1) {
        // Check if same unit or different units
        const units = [...new Set(items.map(i => i.unit))];
        if (units.length === 1) {
          console.log(`  OR# ${or}: ${items.map(i => `${i.type}=₱${i.amount}`).join(', ')} [SAME UNIT: ${units[0]}]`);
        } else {
          console.log(`  OR# ${or}: DIFFERENT UNITS - ${items.map(i => `${i.unit}(${i.type})`).join(', ')}`);
        }
      }
    });

    console.log('\nOR#s used by SINGLE entry (unique):');
    let uniqueCount = 0;
    Object.entries(orGroups).forEach(([or, items]) => {
      if (items.length === 1) {
        uniqueCount++;
      }
    });
    console.log(`  Total unique OR#s: ${uniqueCount}`);

  } catch (error) {
    console.error('Error:', error);
  }
}

function getCellValue(cell) {
  if (!cell || !cell.value) return '';
  let val = cell.value;
  if (typeof val === 'object') {
    if (val.formula) return val.result || '';
    if (val.text) return val.text;
    if (val.richText) return val.richText.map(rt => rt.text).join('');
  }
  return val;
}

function getColumnLetter(col) {
  let letter = '';
  while (col > 0) {
    let mod = (col - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    col = Math.floor((col - mod) / 26);
  }
  return letter;
}

deepAnalysis();
