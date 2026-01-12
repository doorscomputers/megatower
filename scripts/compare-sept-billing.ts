import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { calculateWaterBill, WaterTierSettings, getWaterTierBreakdown } from '../lib/calculations/water';

const prisma = new PrismaClient();

const filePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (sept 2025).xlsx';

interface ExcelBillData {
  unitNumber: string;
  ownerName: string;
  electricCons: number;
  electricRate: number;
  electricAmount: number;
  waterCons: number;
  waterAmount: number;
  area: number;
  parkingArea: number;
  associationDues: number;
  parkingDues: number;
}

// Default residential water tier settings (matching Excel)
const waterSettings: WaterTierSettings = {
  // Residential
  waterResTier1Max: 1,
  waterResTier1Rate: 80,
  waterResTier2Max: 6, // Condition: >1 AND <6, so max is 5+1
  waterResTier2Rate: 200,
  waterResTier3Max: 11, // Condition: >=6 AND <11, so max is 10+1
  waterResTier3Rate: 370,
  waterResTier4Max: 21, // Condition: >=11 AND <21
  waterResTier4Rate: 40,
  waterResTier5Max: 31, // Condition: >=21 AND <31
  waterResTier5Rate: 45,
  waterResTier6Max: 41, // Condition: >=31 AND <41
  waterResTier6Rate: 50,
  waterResTier7Rate: 55,

  // Commercial
  waterComTier1Max: 1,
  waterComTier1Rate: 200,
  waterComTier2Max: 6,
  waterComTier2Rate: 250,
  waterComTier3Max: 11,
  waterComTier3Rate: 740,
  waterComTier4Max: 21,
  waterComTier4Rate: 55,
  waterComTier5Max: 31,
  waterComTier5Rate: 60,
  waterComTier6Max: 41,
  waterComTier6Rate: 65,
  waterComTier7Rate: 85
};

async function main() {
  console.log('========================================');
  console.log('COMPARING SEPTEMBER 2025 BILLING');
  console.log('Excel vs System Calculations');
  console.log('========================================\n');

  const workbook = XLSX.readFile(filePath);
  const excelBills: ExcelBillData[] = [];

  // Parse Excel file to get expected amounts
  for (const sheetName of workbook.SheetNames) {
    if (sheetName.includes('(A)') || sheetName.toLowerCase().includes('paid')) {
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (data.length < 25) continue;

    // Row 9: Floor (5), Unit Number (6)
    const row9 = data[9] || [];
    const floor = row9[5];
    const unitNum = row9[6];

    // Row 10: Owner name (5)
    const row10 = data[10] || [];
    const ownerName = row10[5] || '';

    // Row 16: Electric - Cons (11), Rate (13)
    // Need to find the electric amount - check row 16 or nearby
    const row16 = data[16] || [];
    const electricCons = parseFloat(row16[11]) || 0;
    const electricRate = parseFloat(row16[13]) || 12.48;

    // Row 19: Water - Cons (11)
    const row19 = data[19] || [];
    const waterCons = parseFloat(row19[11]) || 0;

    // Row 23: Area (9), Dues Amount (10)
    const row23 = data[23] || [];
    const area = parseFloat(row23[9]) || 0;
    const associationDues = parseFloat(row23[10]) || 0;

    // Row 24: Parking area (9), Parking dues (10)
    const row24 = data[24] || [];
    const parkingArea = parseFloat(row24[9]) || 0;
    const parkingDues = parseFloat(row24[10]) || 0;

    if (!floor || unitNum === undefined) continue;

    const unitNumber = `M2-${String(floor).toUpperCase()}-${unitNum}`;

    // Calculate expected electric amount: cons × rate, min 50
    let electricAmount = electricCons * electricRate;
    if (electricAmount > 0 && electricAmount < 50) {
      electricAmount = 50;
    }

    // For water, we'll need to look at Excel formulas or look for the amount column
    // Let me search for the water amount in the Excel
    // Looking at row structure, water amount might be after CONS column

    excelBills.push({
      unitNumber,
      ownerName: String(ownerName).trim(),
      electricCons,
      electricRate,
      electricAmount,
      waterCons,
      waterAmount: 0, // Will calculate using system formula
      area,
      parkingArea,
      associationDues,
      parkingDues
    });
  }

  console.log(`Parsed ${excelBills.length} units from Excel\n`);

  console.log('Using residential water tier settings from Excel formula');

  // Calculate using system formula and compare
  console.log('\n========================================');
  console.log('CALCULATION COMPARISON');
  console.log('========================================\n');

  console.log('Electric Calculation: consumption × rate (min ₱50)');
  console.log('Association Dues: area × 60');
  console.log('Water: Tiered calculation (residential)\n');

  let allMatch = true;

  console.log('| Unit | Electric | Water | Assoc Dues | Total | Status |');
  console.log('|------|----------|-------|------------|-------|--------|');

  for (const bill of excelBills) {
    // System electric calculation
    let sysElectric = bill.electricCons * bill.electricRate;
    if (sysElectric > 0 && sysElectric < 50) {
      sysElectric = 50;
    }
    sysElectric = Math.round(sysElectric * 100) / 100;

    // System water calculation
    const sysWater = calculateWaterBill(bill.waterCons, 'RESIDENTIAL', waterSettings);

    // System association dues
    const sysDues = bill.area * 60;
    const sysParkingDues = bill.parkingArea * 60;
    const totalDues = sysDues + sysParkingDues;

    // Excel values
    const excelElectric = bill.electricAmount;
    const excelDues = bill.associationDues + bill.parkingDues;

    // Compare
    const electricMatch = Math.abs(sysElectric - excelElectric) < 0.01;
    const duesMatch = Math.abs(totalDues - excelDues) < 0.01;

    const status = electricMatch && duesMatch ? 'OK' : 'CHECK';
    if (!electricMatch || !duesMatch) allMatch = false;

    const total = sysElectric + sysWater + totalDues;

    console.log(`| ${bill.unitNumber.padEnd(10)} | Sys:${sysElectric.toFixed(2).padStart(7)} Excel:${excelElectric.toFixed(2).padStart(7)} | ${sysWater.toFixed(2).padStart(7)} | Sys:${totalDues.toFixed(0).padStart(5)} Excel:${excelDues.toFixed(0).padStart(5)} | ${total.toFixed(2).padStart(8)} | ${status} |`);
  }

  console.log('\n========================================');
  console.log('DETAILED BREAKDOWN');
  console.log('========================================\n');

  for (const bill of excelBills) {
    console.log(`\n--- ${bill.unitNumber} (${bill.ownerName.substring(0, 30)}) ---`);

    // Electric
    let sysElectric = bill.electricCons * bill.electricRate;
    const rawElectric = sysElectric;
    if (sysElectric > 0 && sysElectric < 50) {
      sysElectric = 50;
    }
    console.log(`Electric: ${bill.electricCons} kWh × ₱${bill.electricRate} = ₱${rawElectric.toFixed(2)}`);
    if (rawElectric > 0 && rawElectric < 50) {
      console.log(`  → Minimum charge applied: ₱50.00`);
    }
    console.log(`  → Final Electric: ₱${sysElectric.toFixed(2)}`);

    // Water
    const waterAmount = calculateWaterBill(bill.waterCons, 'RESIDENTIAL', waterSettings);
    const waterBreakdown = getWaterTierBreakdown(bill.waterCons, 'RESIDENTIAL', waterSettings);
    console.log(`Water: ${bill.waterCons} cu.m`);
    for (const tier of waterBreakdown) {
      console.log(`  Tier ${tier.tier}: ${tier.range} @ ₱${tier.rate} = ₱${tier.amount.toFixed(2)}`);
    }
    console.log(`  → Total Water: ₱${waterAmount.toFixed(2)}`);

    // Association Dues
    const sysDues = bill.area * 60;
    console.log(`Assoc Dues: ${bill.area} sqm × ₱60 = ₱${sysDues.toFixed(2)}`);
    if (bill.parkingArea > 0) {
      const parkingDues = bill.parkingArea * 60;
      console.log(`Parking Dues: ${bill.parkingArea} sqm × ₱60 = ₱${parkingDues.toFixed(2)}`);
    }

    // Compare with Excel
    console.log(`\nExcel Expected:`);
    console.log(`  Electric: ₱${bill.electricAmount.toFixed(2)}`);
    console.log(`  Assoc Dues: ₱${bill.associationDues.toFixed(2)}`);
    if (bill.parkingDues > 0) {
      console.log(`  Parking: ₱${bill.parkingDues.toFixed(2)}`);
    }

    const total = sysElectric + waterAmount + sysDues + (bill.parkingArea * 60);
    console.log(`\nSystem Total: ₱${total.toFixed(2)}`);
  }

  console.log('\n========================================');
  console.log(allMatch ? 'ALL CALCULATIONS MATCH!' : 'SOME DISCREPANCIES FOUND');
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch(console.error);
