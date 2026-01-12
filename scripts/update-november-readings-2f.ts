import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== UPDATING NOVEMBER 2025 READINGS TO MATCH EXCEL ===\n");

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

  // Billing period for November 2025
  const billingPeriod = new Date(Date.UTC(2025, 10, 1)); // November 2025
  const readingDate = new Date(Date.UTC(2025, 10, 26)); // Nov 26

  let electricUpdated = 0;
  let waterUpdated = 0;

  // Process data rows (starting from row 8)
  for (let i = 8; i < data.length; i++) {
    const row = data[i] || [];
    const unitCode = row[0];

    if (!unitCode || typeof unitCode !== 'string' || !unitCode.startsWith('2F-')) {
      continue;
    }

    const unitNumber = `M2-${unitCode}`;

    // Extract readings from Excel
    const electricPres = parseFloat(row[2]) || 0;
    const electricPrev = parseFloat(row[3]) || 0;
    const electricCons = parseFloat(row[4]) || 0;
    const waterPres = parseFloat(row[7]) || 0;
    const waterPrev = parseFloat(row[8]) || 0;
    const waterCons = parseFloat(row[9]) || 0;

    // Find unit
    const unit = await prisma.unit.findFirst({
      where: { tenantId: tenant.id, unitNumber },
    });

    if (!unit) {
      console.log(`${unitNumber}: Unit not found, skipping`);
      continue;
    }

    console.log(`\n${unitNumber}:`);
    console.log(`  Excel Electric: ${electricPrev} -> ${electricPres} (${electricCons} kWh)`);
    console.log(`  Excel Water: ${waterPrev} -> ${waterPres} (${waterCons} cu.m)`);

    // Update Electric Reading
    const existingElectric = await prisma.electricReading.findUnique({
      where: { unitId_billingPeriod: { unitId: unit.id, billingPeriod } },
    });

    if (existingElectric) {
      // Compare values
      if (Number(existingElectric.previousReading) !== electricPrev ||
          Number(existingElectric.presentReading) !== electricPres) {
        console.log(`  DB Electric: ${existingElectric.previousReading} -> ${existingElectric.presentReading} (${existingElectric.consumption} kWh)`);

        await prisma.electricReading.update({
          where: { id: existingElectric.id },
          data: {
            previousReading: electricPrev,
            presentReading: electricPres,
            consumption: electricCons,
            readingDate,
          },
        });
        console.log(`  Electric: ✓ Updated`);
        electricUpdated++;
      } else {
        console.log(`  Electric: Already correct`);
      }
    } else {
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
      console.log(`  Electric: ✓ Created`);
      electricUpdated++;
    }

    // Update Water Reading
    const existingWater = await prisma.waterReading.findUnique({
      where: { unitId_billingPeriod: { unitId: unit.id, billingPeriod } },
    });

    if (existingWater) {
      if (Number(existingWater.previousReading) !== waterPrev ||
          Number(existingWater.presentReading) !== waterPres) {
        console.log(`  DB Water: ${existingWater.previousReading} -> ${existingWater.presentReading} (${existingWater.consumption} cu.m)`);

        await prisma.waterReading.update({
          where: { id: existingWater.id },
          data: {
            previousReading: waterPrev,
            presentReading: waterPres,
            consumption: waterCons,
            readingDate,
          },
        });
        console.log(`  Water: ✓ Updated`);
        waterUpdated++;
      } else {
        console.log(`  Water: Already correct`);
      }
    } else {
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
      console.log(`  Water: ✓ Created`);
      waterUpdated++;
    }
  }

  console.log("\n=== UPDATE COMPLETE ===");
  console.log(`  Electric readings updated: ${electricUpdated}`);
  console.log(`  Water readings updated: ${waterUpdated}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
