import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Extract September 2025 payments from the 2nd Floor October SOA
 *
 * The October SOA shows payments made in September in the "PAYMENT AS OF: SEPTEMBER 2025" section
 */

interface PaymentRecord {
  unitNumber: string;
  ownerName: string;
  electric: number;
  water: number;
  associationDues: number;
  pastDues: number;
  specialAssessment: number;
  advancePayment: number;
  totalPayment: number;
  previousBalance: number;
  orNumbers: string[];
}

function cleanNumber(value: string | number): number {
  if (typeof value === 'number') return value;
  if (!value || value === ' -   ' || value === '-') return 0;

  // Remove spaces, commas, and PHP symbol
  const cleaned = value.toString().replace(/[,\s₱]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function parseOctoberSOA(filePath: string): PaymentRecord[] {
  console.log(`\nParsing: ${path.basename(filePath)}`);

  const workbook = XLSX.readFile(filePath);

  // Process all sheets (each sheet might be a different unit)
  const allPayments: PaymentRecord[] = [];

  workbook.SheetNames.forEach((sheetName) => {
    console.log(`\n--- Processing Sheet: ${sheetName} ---`);

    const worksheet = workbook.Sheets[sheetName];
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: ''
    });

    // Find unit number (typically in row 10, starts with "UNIT NO:")
    let unitNumber = '';
    let ownerName = '';

    for (let i = 0; i < Math.min(15, rawData.length); i++) {
      const row = rawData[i];

      // Look for unit number
      if (row.some((cell: string) => cell && cell.toString().includes('UNIT NO'))) {
        // Unit number is usually a few columns after
        const unitParts = row.filter((cell: string) => cell && cell.toString().trim() && !cell.toString().includes('UNIT NO'));
        if (unitParts.length > 0) {
          unitNumber = unitParts.slice(0, 3).join(' ').trim();
        }
      }

      // Look for owner name
      if (row.some((cell: string) => cell && cell.toString().includes('UNIT OWNER'))) {
        const ownerParts = row.filter((cell: string) =>
          cell &&
          cell.toString().trim() &&
          !cell.toString().includes('UNIT OWNER') &&
          !cell.toString().includes('DUE DATE')
        );
        if (ownerParts.length > 0) {
          ownerName = ownerParts[0].toString().trim();
        }
      }
    }

    if (!unitNumber) {
      console.log(`  No unit number found in sheet ${sheetName}, skipping...`);
      return;
    }

    console.log(`  Unit: ${unitNumber}, Owner: ${ownerName}`);

    // Find payment section - look for "PAYMENT AS OF:" and "SEPTEMBER 2025"
    let paymentSectionStart = -1;
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i];
      if (row.some((cell: string) => cell && cell.toString().includes('PAYMENT AS OF')) &&
          row.some((cell: string) => cell && cell.toString().includes('SEPTEMBER'))) {
        paymentSectionStart = i;
        console.log(`  Payment section found at row ${i + 1}`);
        break;
      }
    }

    if (paymentSectionStart === -1) {
      console.log(`  No September payment section found, skipping...`);
      return;
    }

    // Extract payment details from the next ~10 rows
    const paymentSection = rawData.slice(paymentSectionStart, paymentSectionStart + 10);

    const payment: PaymentRecord = {
      unitNumber,
      ownerName,
      electric: 0,
      water: 0,
      associationDues: 0,
      pastDues: 0,
      specialAssessment: 0,
      advancePayment: 0,
      totalPayment: 0,
      previousBalance: 0,
      orNumbers: []
    };

    // Parse payment rows - amounts are typically at column index 11
    paymentSection.forEach((row: any[]) => {
      const rowText = row.join(' ').toUpperCase();

      if (rowText.includes('ELECTRIC') && !rowText.includes('WATER')) {
        // Amount is typically at column 11
        if (row[11]) {
          payment.electric = cleanNumber(row[11]);
        }

        // Extract OR number
        const orIndex = row.findIndex((cell: string) => cell && cell.toString().includes('OR#'));
        if (orIndex !== -1 && row[orIndex + 1]) {
          payment.orNumbers.push(`Electric: OR# ${row[orIndex + 1]}`);
        }
      }

      if (rowText.includes('WATER') && !rowText.includes('ELECTRIC')) {
        if (row[11]) {
          payment.water = cleanNumber(row[11]);
        }

        const orIndex = row.findIndex((cell: string) => cell && cell.toString().includes('OR#'));
        if (orIndex !== -1 && row[orIndex + 1]) {
          payment.orNumbers.push(`Water: OR# ${row[orIndex + 1]}`);
        }
      }

      if (rowText.includes('ASSOC') && rowText.includes('DUES')) {
        if (row[11]) {
          payment.associationDues = cleanNumber(row[11]);
        }

        const orIndex = row.findIndex((cell: string) => cell && cell.toString().includes('OR#'));
        if (orIndex !== -1 && row[orIndex + 1]) {
          payment.orNumbers.push(`Association Dues: OR# ${row[orIndex + 1]}`);
        }
      }

      if (rowText.includes('PAST DUES') && !rowText.includes('TOTAL')) {
        if (row[11]) {
          payment.pastDues = cleanNumber(row[11]);
        }
      }

      if (rowText.includes('SPECIAL ASSESSMENT')) {
        if (row[11]) {
          payment.specialAssessment = cleanNumber(row[11]);
        }

        const orIndex = row.findIndex((cell: string) => cell && cell.toString().includes('OR#'));
        if (orIndex !== -1 && row[orIndex + 1]) {
          payment.orNumbers.push(`Special Assessment: OR# ${row[orIndex + 1]}`);
        }
      }

      if (rowText.includes('ADVANCE PAYMENT')) {
        if (row[11]) {
          payment.advancePayment = cleanNumber(row[11]);
        }
      }

      if (rowText.includes('TOTAL PAYMENT')) {
        if (row[11]) {
          payment.totalPayment = cleanNumber(row[11]);
        }
      }
    });

    // Find previous balance (typically in row 45, last column with amount)
    if (rawData.length > 44) {
      const prevBalRow = rawData[44]; // Row 45 (0-indexed)
      const amounts = prevBalRow.filter((cell: any) => {
        const str = cell.toString().trim();
        return str && (str.includes('.') || str.match(/^\d+$/)) && str !== '-' && str !== ' -   ';
      });
      if (amounts.length > 0) {
        payment.previousBalance = cleanNumber(amounts[amounts.length - 1]);
      }
    }

    console.log(`  Extracted Payment:`, {
      electric: payment.electric,
      water: payment.water,
      associationDues: payment.associationDues,
      totalPayment: payment.totalPayment
    });

    allPayments.push(payment);
  });

  return allPayments;
}

function generateReport(payments: PaymentRecord[]) {
  console.log('\n\n');
  console.log('='.repeat(100));
  console.log('SEPTEMBER 2025 PAYMENT SUMMARY - 2ND FLOOR');
  console.log('='.repeat(100));
  console.log('');

  let totalElectric = 0;
  let totalWater = 0;
  let totalAssocDues = 0;
  let totalPastDues = 0;
  let totalSpecialAssess = 0;
  let totalAdvance = 0;
  let grandTotal = 0;

  payments.forEach((payment, idx) => {
    console.log(`${idx + 1}. ${payment.unitNumber} - ${payment.ownerName}`);
    console.log(`   Electric:           PHP ${payment.electric.toFixed(2)}`);
    console.log(`   Water:              PHP ${payment.water.toFixed(2)}`);
    console.log(`   Association Dues:   PHP ${payment.associationDues.toFixed(2)}`);
    console.log(`   Past Dues:          PHP ${payment.pastDues.toFixed(2)}`);
    console.log(`   Special Assessment: PHP ${payment.specialAssessment.toFixed(2)}`);
    console.log(`   Advance Payment:    PHP ${payment.advancePayment.toFixed(2)}`);
    console.log(`   ---`);
    console.log(`   TOTAL PAYMENT:      PHP ${payment.totalPayment.toFixed(2)}`);
    console.log(`   Previous Balance:   PHP ${payment.previousBalance.toFixed(2)}`);

    if (payment.orNumbers.length > 0) {
      console.log(`   OR Numbers: ${payment.orNumbers.join(', ')}`);
    }
    console.log('');

    totalElectric += payment.electric;
    totalWater += payment.water;
    totalAssocDues += payment.associationDues;
    totalPastDues += payment.pastDues;
    totalSpecialAssess += payment.specialAssessment;
    totalAdvance += payment.advancePayment;
    grandTotal += payment.totalPayment;
  });

  console.log('='.repeat(100));
  console.log('TOTALS');
  console.log('='.repeat(100));
  console.log(`Total Electric:           PHP ${totalElectric.toFixed(2)}`);
  console.log(`Total Water:              PHP ${totalWater.toFixed(2)}`);
  console.log(`Total Association Dues:   PHP ${totalAssocDues.toFixed(2)}`);
  console.log(`Total Past Dues:          PHP ${totalPastDues.toFixed(2)}`);
  console.log(`Total Special Assessment: PHP ${totalSpecialAssess.toFixed(2)}`);
  console.log(`Total Advance:            PHP ${totalAdvance.toFixed(2)}`);
  console.log(`---`);
  console.log(`GRAND TOTAL:              PHP ${grandTotal.toFixed(2)}`);
  console.log('='.repeat(100));

  // Also save to CSV
  const csvPath = path.join(__dirname, 'september-2025-payments.csv');
  const csvLines = [
    'Unit Number,Owner Name,Electric,Water,Association Dues,Past Dues,Special Assessment,Advance Payment,Total Payment,Previous Balance,OR Numbers'
  ];

  payments.forEach((payment) => {
    csvLines.push([
      payment.unitNumber,
      payment.ownerName,
      payment.electric.toFixed(2),
      payment.water.toFixed(2),
      payment.associationDues.toFixed(2),
      payment.pastDues.toFixed(2),
      payment.specialAssessment.toFixed(2),
      payment.advancePayment.toFixed(2),
      payment.totalPayment.toFixed(2),
      payment.previousBalance.toFixed(2),
      `"${payment.orNumbers.join('; ')}"`
    ].join(','));
  });

  fs.writeFileSync(csvPath, csvLines.join('\n'), 'utf-8');
  console.log(`\nReport saved to: ${csvPath}`);
}

function main() {
  const octoberFile = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx';

  console.log('==========================================');
  console.log('SEPTEMBER 2025 PAYMENT EXTRACTION');
  console.log('==========================================');

  const payments = parseOctoberSOA(octoberFile);

  if (payments.length === 0) {
    console.log('\nNo payments found!');
    return;
  }

  generateReport(payments);
}

main();
