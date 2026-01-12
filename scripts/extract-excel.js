const ExcelJS = require('exceljs');

async function extractExcelData() {
  const workbook = new ExcelJS.Workbook();
  const filePath = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/NOV 2025 MEGATOWER II/2ND FLOOR (t2).xlsx';

  // DEEP ANALYSIS - Look at exact row structure

  try {
    await workbook.xlsx.readFile(filePath);

    console.log('='.repeat(100));
    console.log('OR# AND PAYMENT ANALYSIS - 2ND FLOOR (t2).xlsx');
    console.log('='.repeat(100));
    console.log('Total Sheets (Units):', workbook.worksheets.length);
    console.log();

    // Collect all payment data
    const payments = [];

    workbook.eachSheet((sheet, sheetId) => {
      // Get unit info from row 10
      const unitRow = sheet.getRow(10);
      const floor = getCellValue(unitRow.getCell(10)); // Column J
      const unitNum = getCellValue(unitRow.getCell(11)); // Column K
      const building = getCellValue(unitRow.getCell(12)); // Column L

      // Get owner from row 11
      const ownerRow = sheet.getRow(11);
      const owner = getCellValue(ownerRow.getCell(10)); // Column J

      // Get electric data (row 17)
      const electricRow = sheet.getRow(17);
      const electricPres = getCellValue(electricRow.getCell(11)); // Column K
      const electricPrev = getCellValue(electricRow.getCell(14)); // Column N
      const electricCons = getCellValue(electricRow.getCell(16)); // Column P
      const electricAmount = getCellValue(electricRow.getCell(22)); // Column V

      // Get water data (row 20)
      const waterRow = sheet.getRow(20);
      const waterPres = getCellValue(waterRow.getCell(11));
      const waterPrev = getCellValue(waterRow.getCell(14));
      const waterCons = getCellValue(waterRow.getCell(16));
      const waterAmount = getCellValue(waterRow.getCell(22));

      // Get association dues (row 24-25)
      const duesRow = sheet.getRow(24);
      const duesRate = getCellValue(duesRow.getCell(12));
      const duesArea = getCellValue(duesRow.getCell(14));
      const duesAmount = getCellValue(duesRow.getCell(15));

      // Get payment info with OR#s (rows 38-44)
      const electricPayRow = sheet.getRow(38);
      const electricOR = getCellValue(electricPayRow.getCell(12)); // Column L
      const electricPayAmt = getCellValue(electricPayRow.getCell(16)); // Column P

      const waterPayRow = sheet.getRow(39);
      const waterOR = getCellValue(waterPayRow.getCell(12));
      const waterPayAmt = getCellValue(waterPayRow.getCell(16));

      const duesPayRow = sheet.getRow(40);
      const duesOR = getCellValue(duesPayRow.getCell(12));
      const duesPayAmt = getCellValue(duesPayRow.getCell(16));

      const pastDuesRow = sheet.getRow(41);
      const pastDuesOR = getCellValue(pastDuesRow.getCell(12));
      const pastDuesAmt = getCellValue(pastDuesRow.getCell(16));

      const specialRow = sheet.getRow(42);
      const specialOR = getCellValue(specialRow.getCell(12));
      const specialAmt = getCellValue(specialRow.getCell(16));

      const advanceRow = sheet.getRow(43);
      const advanceOR = getCellValue(advanceRow.getCell(12));
      const advanceAmt = getCellValue(advanceRow.getCell(16));

      const totalPayRow = sheet.getRow(44);
      const totalPayAmt = getCellValue(totalPayRow.getCell(16));

      // Get total amount due (row 46)
      const totalDueRow = sheet.getRow(45);
      const totalAmountDue = getCellValue(totalDueRow.getCell(22));

      payments.push({
        sheet: sheet.name,
        unit: `${floor}-${unitNum}`,
        building,
        owner,
        billing: {
          electric: { pres: electricPres, prev: electricPrev, cons: electricCons, amount: electricAmount },
          water: { pres: waterPres, prev: waterPrev, cons: waterCons, amount: waterAmount },
          dues: { rate: duesRate, area: duesArea, amount: duesAmount }
        },
        payments: {
          electric: { or: electricOR, amount: electricPayAmt },
          water: { or: waterOR, amount: waterPayAmt },
          dues: { or: duesOR, amount: duesPayAmt },
          pastDues: { or: pastDuesOR, amount: pastDuesAmt },
          special: { or: specialOR, amount: specialAmt },
          advance: { or: advanceOR, amount: advanceAmt },
          total: totalPayAmt
        },
        totalDue: totalAmountDue
      });
    });

    // Print summary table
    console.log('\n' + '='.repeat(100));
    console.log('PAYMENT OR# SUMMARY BY UNIT');
    console.log('='.repeat(100));
    console.log('Unit'.padEnd(10) + 'Owner'.padEnd(35) + 'Elec OR#'.padEnd(12) + 'Water OR#'.padEnd(12) + 'Dues OR#'.padEnd(12) + 'PastDue OR#'.padEnd(12) + 'Special OR#');
    console.log('-'.repeat(100));

    payments.forEach(p => {
      console.log(
        String(p.unit).padEnd(10) +
        String(p.owner || '').substring(0, 32).padEnd(35) +
        String(p.payments.electric.or || '-').padEnd(12) +
        String(p.payments.water.or || '-').padEnd(12) +
        String(p.payments.dues.or || '-').padEnd(12) +
        String(p.payments.pastDues.or || '-').padEnd(12) +
        String(p.payments.special.or || '-')
      );
    });

    // Print unique OR# patterns
    console.log('\n' + '='.repeat(100));
    console.log('UNIQUE OR# NUMBERS FOUND');
    console.log('='.repeat(100));

    const orNumbers = new Set();
    payments.forEach(p => {
      [p.payments.electric.or, p.payments.water.or, p.payments.dues.or,
       p.payments.pastDues.or, p.payments.special.or, p.payments.advance.or]
        .filter(or => or && or !== '-')
        .forEach(or => orNumbers.add(or));
    });

    const sortedORs = Array.from(orNumbers).sort((a, b) => {
      const numA = parseInt(a) || 0;
      const numB = parseInt(b) || 0;
      return numA - numB;
    });

    console.log('Total unique OR#:', sortedORs.length);
    console.log('OR# range:', sortedORs.join(', '));

    // Detailed billing analysis
    console.log('\n' + '='.repeat(100));
    console.log('DETAILED BILLING DATA FOR TEST CASES');
    console.log('='.repeat(100));

    payments.slice(0, 10).forEach((p, i) => {
      console.log(`\n--- Unit ${p.unit} (${p.owner}) ---`);
      console.log(`Electric: Pres=${p.billing.electric.pres}, Prev=${p.billing.electric.prev}, Cons=${p.billing.electric.cons}, Amount=₱${p.billing.electric.amount}`);
      console.log(`Water: Pres=${p.billing.water.pres}, Prev=${p.billing.water.prev}, Cons=${p.billing.water.cons}, Amount=₱${p.billing.water.amount}`);
      console.log(`Assoc Dues: Rate=${p.billing.dues.rate}, Area=${p.billing.dues.area}sqm, Amount=₱${p.billing.dues.amount}`);
      console.log(`Payments: Electric OR#${p.payments.electric.or}=₱${p.payments.electric.amount}, Water OR#${p.payments.water.or}=₱${p.payments.water.amount}, Dues OR#${p.payments.dues.or}=₱${p.payments.dues.amount}`);
      console.log(`Total Paid: ₱${p.payments.total}, Total Due: ₱${p.totalDue}`);
    });

    // Print OR# usage pattern
    console.log('\n' + '='.repeat(100));
    console.log('OR# USAGE PATTERNS');
    console.log('='.repeat(100));

    const orUsage = {};
    payments.forEach(p => {
      const collectOR = (or, type, unit) => {
        if (or && or !== '-' && or !== '') {
          if (!orUsage[or]) orUsage[or] = [];
          orUsage[or].push({ unit, type });
        }
      };
      collectOR(p.payments.electric.or, 'ELECTRIC', p.unit);
      collectOR(p.payments.water.or, 'WATER', p.unit);
      collectOR(p.payments.dues.or, 'DUES', p.unit);
      collectOR(p.payments.pastDues.or, 'PAST_DUES', p.unit);
      collectOR(p.payments.special.or, 'SPECIAL', p.unit);
      collectOR(p.payments.advance.or, 'ADVANCE', p.unit);
    });

    // Show OR#s that are used for multiple payment types
    Object.entries(orUsage).forEach(([or, usages]) => {
      const types = [...new Set(usages.map(u => u.type))];
      if (types.length > 1 || usages.length > 1) {
        console.log(`OR# ${or}: ${usages.map(u => `${u.unit}(${u.type})`).join(', ')}`);
      }
    });

  } catch (error) {
    console.error('Error reading Excel file:', error);
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

extractExcelData();
