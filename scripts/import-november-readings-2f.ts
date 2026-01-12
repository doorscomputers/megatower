import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== IMPORTING NOVEMBER 2025 METER READINGS FOR 2ND FLOOR ===\n");

  // Get tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log("ERROR: No tenant found!");
    return;
  }

  // Read the Excel file
  const filePath = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/December/DECEMBER 2025.xlsx';
  const wb = XLSX.readFile(filePath);

  const sheet = wb.Sheets['2F'];
  if (!sheet) {
    console.log("ERROR: Sheet '2F' not found!");
    return;
  }

  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

  // Excel structure (from analysis):
  // Row 7: Headers (UNIT, NAME, PRES, PREV, CONS, RATE, AMOUNT, PRES, PREV, CONS, ?, AREA, RATE, AMOUNT)
  // Row 8+: Data rows
  // Col 0: UNIT (e.g., "2F-1")
  // Col 2: Electric PRES
  // Col 3: Electric PREV
  // Col 4: Electric CONS
  // Col 7: Water PRES
  // Col 8: Water PREV
  // Col 9: Water CONS

  // Billing period for November 2025 (Oct 27 - Nov 26)
  const billingPeriod = new Date(Date.UTC(2025, 10, 1)); // November 2025
  const readingDate = new Date(Date.UTC(2025, 10, 26)); // Nov 26 reading date

  let electricImported = 0;
  let waterImported = 0;
  let skipped = 0;

  // Process data rows (starting from row 8, index 8)
  for (let i = 8; i < data.length; i++) {
    const row = data[i] || [];
    const unitCode = row[0];

    if (!unitCode || typeof unitCode !== 'string' || !unitCode.startsWith('2F-')) {
      continue;
    }

    // Map Excel unit code (e.g., "2F-1") to database unit number (e.g., "M2-2F-1")
    const unitNumber = `M2-${unitCode}`;

    // Extract readings
    const electricPres = parseFloat(row[2]) || 0;
    const electricPrev = parseFloat(row[3]) || 0;
    const electricCons = parseFloat(row[4]) || 0;
    const waterPres = parseFloat(row[7]) || 0;
    const waterPrev = parseFloat(row[8]) || 0;
    const waterCons = parseFloat(row[9]) || 0;

    console.log(`\nProcessing ${unitCode} -> ${unitNumber}:`);
    console.log(`  Electric: ${electricPrev} -> ${electricPres} (${electricCons} kWh)`);
    console.log(`  Water: ${waterPrev} -> ${waterPres} (${waterCons} cu.m)`);

    // Find unit in database
    const unit = await prisma.unit.findFirst({
      where: { tenantId: tenant.id, unitNumber },
    });

    if (!unit) {
      console.log(`  ERROR: Unit not found in database, skipping`);
      skipped++;
      continue;
    }

    // Check for existing November readings (using unique constraint on unitId + billingPeriod)
    const existingElectric = await prisma.electricReading.findUnique({
      where: { unitId_billingPeriod: { unitId: unit.id, billingPeriod } },
    });

    const existingWater = await prisma.waterReading.findUnique({
      where: { unitId_billingPeriod: { unitId: unit.id, billingPeriod } },
    });

    // Import Electric Reading
    if (existingElectric) {
      console.log(`  Electric: Already exists, skipping`);
    } else if (electricCons > 0 || electricPres > 0) {
      await prisma.electricReading.create({
        data: {
          unitId: unit.id,
          billingPeriod,
          readingDate,
          previousReading: electricPrev,
          presentReading: electricPres,
          consumption: electricCons,
        },
      });
      console.log(`  Electric: ✓ Imported`);
      electricImported++;
    } else {
      console.log(`  Electric: No reading data`);
    }

    // Import Water Reading
    if (existingWater) {
      console.log(`  Water: Already exists, skipping`);
    } else if (waterCons >= 0 && waterPres > 0) {
      await prisma.waterReading.create({
        data: {
          unitId: unit.id,
          billingPeriod,
          readingDate,
          previousReading: waterPrev,
          presentReading: waterPres,
          consumption: waterCons,
        },
      });
      console.log(`  Water: ✓ Imported`);
      waterImported++;
    } else {
      console.log(`  Water: No reading data`);
    }
  }

  console.log("\n=== IMPORT COMPLETE ===");
  console.log(`  Electric readings imported: ${electricImported}`);
  console.log(`  Water readings imported: ${waterImported}`);
  console.log(`  Units skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
