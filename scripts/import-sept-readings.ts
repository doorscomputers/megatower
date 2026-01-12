import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const filePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (sept 2025).xlsx';

interface ReadingData {
  unitNumber: string;
  ownerName: string;
  electricPres: number;
  electricPrev: number;
  electricCons: number;
  electricRate: number;
  waterPres: number;
  waterPrev: number;
  waterCons: number;
  area: number;
  associationDues: number;
}

async function main() {
  console.log('========================================');
  console.log('IMPORTING SEPTEMBER 2025 READINGS');
  console.log('M2-2F (2nd Floor) Only');
  console.log('========================================\n');

  const workbook = XLSX.readFile(filePath);
  console.log('Sheets found:', workbook.SheetNames.length);

  const readings: ReadingData[] = [];

  // Process each sheet (each sheet is one unit's SOA)
  for (const sheetName of workbook.SheetNames) {
    // Skip sheets with (A) suffix (balance records) or "paid" suffix
    if (sheetName.includes('(A)') || sheetName.toLowerCase().includes('paid')) {
      console.log(`[SKIP] Sheet "${sheetName}" - balance record/paid`);
      continue;
    }

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    if (data.length < 20) {
      console.log(`[SKIP] Sheet "${sheetName}" - not enough rows`);
      continue;
    }

    // Row 9: Unit info - Floor (5), Unit Number (6), Building (7)
    const row9 = data[9] || [];
    const floor = row9[5];
    const unitNum = row9[6];
    const buildingIndicator = row9[7];

    // Row 10: Owner name (5)
    const row10 = data[10] || [];
    const ownerName = row10[5];

    // Row 16: Electric readings - Pres (7), Prev (9), Cons (11), Rate (13)
    const row16 = data[16] || [];
    const electricPres = parseFloat(row16[7]) || 0;
    const electricPrev = parseFloat(row16[9]) || 0;
    const electricCons = parseFloat(row16[11]) || 0;
    const electricRate = parseFloat(row16[13]) || 12.48;

    // Row 19: Water readings - Pres (7), Prev (9), Cons (11)
    const row19 = data[19] || [];
    const waterPres = parseFloat(row19[7]) || 0;
    const waterPrev = parseFloat(row19[9]) || 0;
    const waterCons = parseFloat(row19[11]) || 0;

    // Row 23: Rate (7), Area (9), Dues Amount (10)
    const row23 = data[23] || [];
    const area = parseFloat(row23[9]) || 0;
    const associationDues = parseFloat(row23[10]) || 0;

    if (!floor || unitNum === undefined) {
      console.log(`[SKIP] Sheet "${sheetName}" - missing floor/unit data`);
      continue;
    }

    // Determine building prefix
    let building = 'M2'; // Default for this file
    if (buildingIndicator && String(buildingIndicator).toLowerCase().includes('megatower 1')) {
      building = 'M1';
    }

    // Format unit number: M2-2F-{num}
    const normalizedFloor = String(floor).toUpperCase().trim();
    const unitNumber = `${building}-${normalizedFloor}-${unitNum}`;

    readings.push({
      unitNumber,
      ownerName: String(ownerName || '').trim(),
      electricPres,
      electricPrev,
      electricCons,
      electricRate,
      waterPres,
      waterPrev,
      waterCons,
      area,
      associationDues
    });

    console.log(`[PARSED] ${unitNumber}: Electric ${electricCons} kWh, Water ${waterCons} cu.m, Area ${area} sqm`);
  }

  console.log(`\nTotal readings extracted: ${readings.length}`);

  // Get tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found!');
    return;
  }
  console.log(`\nUsing tenant: ${tenant.name}`);

  // Get units and create map
  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, unitNumber: true, area: true }
  });
  const unitMap = new Map(units.map(u => [u.unitNumber.toUpperCase(), u]));
  console.log(`Database units: ${units.length}`);

  // September 2025 billing period
  // Readings taken July 27 - August 26 for September billing
  const billingPeriod = new Date('2025-09-01');
  const readingDate = new Date('2025-08-26');

  console.log(`\nBilling Period: September 2025`);
  console.log(`Reading Date: August 26, 2025`);

  console.log('\n========================================');
  console.log('IMPORTING ELECTRIC READINGS');
  console.log('========================================\n');

  let electricCreated = 0;
  let electricSkipped = 0;

  for (const reading of readings) {
    const unit = unitMap.get(reading.unitNumber.toUpperCase());
    if (!unit) {
      console.log(`[SKIP] Unit not found in DB: ${reading.unitNumber}`);
      electricSkipped++;
      continue;
    }

    // Check if reading exists
    const existing = await prisma.electricReading.findUnique({
      where: {
        unitId_billingPeriod: {
          unitId: unit.id,
          billingPeriod
        }
      }
    });

    if (existing) {
      await prisma.electricReading.update({
        where: { id: existing.id },
        data: {
          previousReading: reading.electricPrev,
          presentReading: reading.electricPres,
          consumption: reading.electricCons,
          readingDate
        }
      });
      console.log(`[UPDATED] ${reading.unitNumber}: Electric ${reading.electricCons} kWh`);
    } else {
      await prisma.electricReading.create({
        data: {
          unitId: unit.id,
          billingPeriod,
          readingDate,
          previousReading: reading.electricPrev,
          presentReading: reading.electricPres,
          consumption: reading.electricCons
        }
      });
      console.log(`[CREATED] ${reading.unitNumber}: Electric ${reading.electricCons} kWh`);
    }
    electricCreated++;

    // Update unit area if it was 0 or missing
    if (reading.area > 0 && (!unit.area || Number(unit.area) === 0)) {
      await prisma.unit.update({
        where: { id: unit.id },
        data: { area: reading.area }
      });
      console.log(`[AREA] ${reading.unitNumber}: Updated area to ${reading.area} sqm`);
    }
  }

  console.log(`\nElectric readings imported: ${electricCreated}`);
  console.log(`Electric readings skipped: ${electricSkipped}`);

  console.log('\n========================================');
  console.log('IMPORTING WATER READINGS');
  console.log('========================================\n');

  let waterCreated = 0;
  let waterSkipped = 0;

  for (const reading of readings) {
    const unit = unitMap.get(reading.unitNumber.toUpperCase());
    if (!unit) {
      waterSkipped++;
      continue;
    }

    const existing = await prisma.waterReading.findUnique({
      where: {
        unitId_billingPeriod: {
          unitId: unit.id,
          billingPeriod
        }
      }
    });

    if (existing) {
      await prisma.waterReading.update({
        where: { id: existing.id },
        data: {
          previousReading: reading.waterPrev,
          presentReading: reading.waterPres,
          consumption: reading.waterCons,
          readingDate
        }
      });
      console.log(`[UPDATED] ${reading.unitNumber}: Water ${reading.waterCons} cu.m`);
    } else {
      await prisma.waterReading.create({
        data: {
          unitId: unit.id,
          billingPeriod,
          readingDate,
          previousReading: reading.waterPrev,
          presentReading: reading.waterPres,
          consumption: reading.waterCons
        }
      });
      console.log(`[CREATED] ${reading.unitNumber}: Water ${reading.waterCons} cu.m`);
    }
    waterCreated++;
  }

  console.log(`\nWater readings imported: ${waterCreated}`);
  console.log(`Water readings skipped: ${waterSkipped}`);

  console.log('\n========================================');
  console.log('SUMMARY OF SEPTEMBER DATA');
  console.log('========================================\n');

  console.log('| Unit | Owner | Electric | Water | Area |');
  console.log('|------|-------|----------|-------|------|');
  for (const reading of readings) {
    const ownerShort = reading.ownerName.substring(0, 25).padEnd(25);
    console.log(`| ${reading.unitNumber.padEnd(10)} | ${ownerShort} | ${String(reading.electricCons).padStart(8)} | ${String(reading.waterCons).padStart(5)} | ${String(reading.area).padStart(5)} |`);
  }

  console.log('\n========================================');
  console.log('IMPORT COMPLETE');
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch(console.error);
