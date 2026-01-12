/**
 * Compare Generated November Bills with Excel December SOA
 *
 * Extracts billing amounts from Excel SOA sheets and compares with database bills
 */

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface ExcelSOAData {
  unitNumber: string;
  sheetName: string;
  electricPres: number;
  electricPrev: number;
  electricCons: number;
  electricRate: number;
  electricAmount: number;
  waterPres: number;
  waterPrev: number;
  waterCons: number;
  waterAmount: number;
  area: number;
  duesRate: number;
  duesAmount: number;
  totalAmount: number | null;
}

async function main() {
  console.log('='.repeat(80));
  console.log('COMPARING NOVEMBER 2025 BILLS WITH EXCEL DECEMBER SOA');
  console.log('='.repeat(80));

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log("No tenant found!");
    return;
  }

  // Read the readings Excel (has calculated amounts)
  const readingsFile = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/December/DECEMBER 2025.xlsx';
  const readingsWb = XLSX.readFile(readingsFile);
  const readingsSheet = readingsWb.Sheets['2F'];
  const readingsData = XLSX.utils.sheet_to_json(readingsSheet, { header: 1 }) as any[][];

  // Extract Excel calculated values
  const excelData: ExcelSOAData[] = [];

  // Data starts at row 8
  for (let i = 8; i < readingsData.length; i++) {
    const row = readingsData[i] || [];
    const unitCode = row[0];
    if (!unitCode || typeof unitCode !== 'string' || !unitCode.startsWith('2F-')) continue;

    const data: ExcelSOAData = {
      sheetName: unitCode.replace('2F-', ''),
      unitNumber: `M2-${unitCode}`,
      electricPres: parseFloat(row[2]) || 0,
      electricPrev: parseFloat(row[3]) || 0,
      electricCons: parseFloat(row[4]) || 0,
      electricRate: parseFloat(row[5]) || 10.01,
      electricAmount: parseFloat(row[6]) || 0,  // Calculated electric amount in Excel
      waterPres: parseFloat(row[7]) || 0,
      waterPrev: parseFloat(row[8]) || 0,
      waterCons: parseFloat(row[9]) || 0,
      waterAmount: parseFloat(row[10]) || 0,     // Water amount in Excel
      area: parseFloat(row[11]) || 0,
      duesRate: parseFloat(row[12]) || 60,
      duesAmount: parseFloat(row[13]) || 0,      // Dues amount in Excel
      totalAmount: null,                          // We'll calculate
    };

    // Calculate total from Excel
    data.totalAmount = data.electricAmount + data.waterAmount + data.duesAmount;
    excelData.push(data);
  }

  // Get database bills for November 2025
  const billingPeriod = new Date(Date.UTC(2025, 10, 1));
  const dbBills = await prisma.bill.findMany({
    where: {
      tenantId: tenant.id,
      billingMonth: billingPeriod,
      unit: { unitNumber: { startsWith: 'M2-2F' } }
    },
    include: { unit: { select: { unitNumber: true, area: true } } },
    orderBy: { unit: { unitNumber: 'asc' } }
  });

  // Get the system settings for comparison
  const settings = await prisma.tenantSettings.findFirst({
    where: { tenantId: tenant.id }
  });

  console.log(`\nSystem Electric Rate: ₱${settings?.electricRate || 'N/A'}/kWh`);
  console.log(`Excel Electric Rate: ₱10.01/kWh`);

  // Compare
  console.log('\n' + '='.repeat(80));
  console.log('COMPARISON TABLE');
  console.log('='.repeat(80));

  console.log('\nUnit'.padEnd(12) +
    '| Electric'.padEnd(25) +
    '| Water'.padEnd(20) +
    '| Dues'.padEnd(20) +
    '| Total'.padEnd(22) +
    '| DIFF');
  console.log(''.padEnd(12) +
    '| Excel     DB'.padEnd(25) +
    '| Excel   DB'.padEnd(20) +
    '| Excel   DB'.padEnd(20) +
    '| Excel     DB'.padEnd(22) +
    '|');
  console.log('-'.repeat(110));

  let totalExcel = 0;
  let totalDB = 0;
  const discrepancies: any[] = [];

  for (const excel of excelData) {
    const dbBill = dbBills.find(b => b.unit.unitNumber === excel.unitNumber);

    if (!dbBill) {
      console.log(`${excel.unitNumber.padEnd(11)} | NO DB BILL FOUND`);
      continue;
    }

    const dbElectric = Number(dbBill.electricAmount);
    const dbWater = Number(dbBill.waterAmount);
    const dbDues = Number(dbBill.associationDues);
    const dbTotal = dbElectric + dbWater + dbDues;

    const excelTotal = excel.totalAmount || 0;
    const diffTotal = excelTotal - dbTotal;

    totalExcel += excelTotal;
    totalDB += dbTotal;

    const excelStr = `${excel.electricAmount.toFixed(2).padStart(10)} ${dbElectric.toFixed(2).padStart(10)}`;
    const waterStr = `${excel.waterAmount.toFixed(0).padStart(6)} ${dbWater.toFixed(0).padStart(6)}`;
    const duesStr = `${excel.duesAmount.toFixed(0).padStart(6)} ${dbDues.toFixed(0).padStart(6)}`;
    const totalStr = `${excelTotal.toFixed(2).padStart(10)} ${dbTotal.toFixed(2).padStart(10)}`;
    const diffStr = diffTotal !== 0 ? (diffTotal > 0 ? '+' : '') + diffTotal.toFixed(2) : 'OK';

    console.log(`${excel.unitNumber.padEnd(11)} |${excelStr} |${waterStr} |${duesStr} |${totalStr} | ${diffStr}`);

    if (Math.abs(diffTotal) > 0.01) {
      discrepancies.push({
        unit: excel.unitNumber,
        excelElectric: excel.electricAmount,
        dbElectric,
        electricDiff: excel.electricAmount - dbElectric,
        excelWater: excel.waterAmount,
        dbWater,
        waterDiff: excel.waterAmount - dbWater,
        excelDues: excel.duesAmount,
        dbDues,
        duesDiff: excel.duesAmount - dbDues,
        totalDiff: diffTotal
      });
    }
  }

  console.log('-'.repeat(110));
  console.log(`TOTALS`.padEnd(11) + ` |                       |            |            |${totalExcel.toFixed(2).padStart(10)} ${totalDB.toFixed(2).padStart(10)} | ${(totalExcel - totalDB).toFixed(2)}`);

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('DISCREPANCY ANALYSIS');
  console.log('='.repeat(80));

  if (discrepancies.length === 0) {
    console.log('\n✓ No discrepancies found! All bills match.');
  } else {
    console.log(`\n✗ Found ${discrepancies.length} units with discrepancies:\n`);

    for (const d of discrepancies) {
      console.log(`${d.unit}:`);
      if (Math.abs(d.electricDiff) > 0.01) {
        console.log(`  Electric: Excel ₱${d.excelElectric.toFixed(2)} vs DB ₱${d.dbElectric.toFixed(2)} (diff: ${d.electricDiff.toFixed(2)})`);
      }
      if (Math.abs(d.waterDiff) > 0.01) {
        console.log(`  Water: Excel ₱${d.excelWater.toFixed(2)} vs DB ₱${d.dbWater.toFixed(2)} (diff: ${d.waterDiff.toFixed(2)})`);
      }
      if (Math.abs(d.duesDiff) > 0.01) {
        console.log(`  Dues: Excel ₱${d.excelDues.toFixed(2)} vs DB ₱${d.dbDues.toFixed(2)} (diff: ${d.duesDiff.toFixed(2)})`);
      }
      console.log(`  Total Diff: ${d.totalDiff > 0 ? '+' : ''}${d.totalDiff.toFixed(2)}`);
      console.log('');
    }

    // Check if it's the electric rate issue
    const electricDiscrepancies = discrepancies.filter(d => Math.abs(d.electricDiff) > 0.01);
    if (electricDiscrepancies.length === discrepancies.length) {
      console.log('\n*** LIKELY CAUSE: Electric rate mismatch ***');
      console.log(`Excel uses ₱10.01/kWh, check system settings.`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
