import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const filePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\NOV 2025.xlsx';

const floorSheets = ['GF', '2F', '3F', '4F', '5F', '6F'];

interface ReadingData {
  unitNumber: string;
  electricPres: number;
  electricPrev: number;
  electricCons: number;
  waterPres: number;
  waterPrev: number;
  waterCons: number;
}

async function main() {
  console.log('========================================');
  console.log('IMPORTING METER READINGS FROM NOV 2025.xlsx');
  console.log('========================================\n');

  const workbook = XLSX.readFile(filePath);
  const readings: ReadingData[] = [];

  // Process each floor sheet
  for (const sheetName of floorSheets) {
    if (!workbook.SheetNames.includes(sheetName)) continue;

    console.log(`Processing sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    // Data starts at row 8 (index 8)
    // Columns: UNIT(0), NAME(1), PRES(2), PREV(3), CONS(4), RATE(5), AMOUNT(6), PRES(7), PREV(8), CONS(9), AMOUNT(10), AREA(11)
    // Electric: columns 2,3,4 | Water: columns 7,8,9

    for (let i = 8; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 10) continue;

      const unitCell = row[0];
      if (!unitCell) continue;
      if (typeof unitCell !== 'string') continue;

      const unitStr = String(unitCell).trim();
      if (unitStr.toUpperCase().includes('TOTAL')) continue;
      if (unitStr.length <= 2 && !/^\d/.test(unitStr) && !unitStr.includes('F-')) continue;

      // Parse unit number
      const unitMatch = unitStr.match(/^(\d*F|GF)-(\d+\w*)$/i);
      if (!unitMatch) continue;

      const floor = unitMatch[1].toUpperCase();
      const unitNum = unitMatch[2];
      const unitNumber = `M1-${floor}-${unitNum}`;

      // Electric readings (columns 2, 3, 4)
      const electricPres = parseFloat(row[2]) || 0;
      const electricPrev = parseFloat(row[3]) || 0;
      const electricCons = parseFloat(row[4]) || 0;

      // Water readings (columns 7, 8, 9)
      const waterPres = parseFloat(row[7]) || 0;
      const waterPrev = parseFloat(row[8]) || 0;
      const waterCons = parseFloat(row[9]) || 0;

      readings.push({
        unitNumber,
        electricPres,
        electricPrev,
        electricCons,
        waterPres,
        waterPrev,
        waterCons
      });
    }
  }

  console.log(`\nTotal readings extracted: ${readings.length}`);

  // Get tenant and units
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found!');
    return;
  }

  const units = await prisma.unit.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, unitNumber: true }
  });
  const unitMap = new Map(units.map(u => [u.unitNumber.toUpperCase(), u.id]));

  // The billing period is November 2025 (readings taken Sept 27 - Oct 26)
  // billingPeriod should be the month the bill is FOR
  const billingPeriod = new Date('2025-11-01');
  const readingDate = new Date('2025-10-26'); // Reading date

  console.log(`\nBilling Period: November 2025`);
  console.log(`Reading Date: October 26, 2025`);

  console.log('\n========================================');
  console.log('IMPORTING ELECTRIC READINGS');
  console.log('========================================\n');

  let electricCreated = 0;
  let electricUpdated = 0;
  let electricSkipped = 0;

  for (const reading of readings) {
    const unitId = unitMap.get(reading.unitNumber.toUpperCase());
    if (!unitId) {
      console.log(`[SKIP] Unit not found: ${reading.unitNumber}`);
      electricSkipped++;
      continue;
    }

    // Check if reading already exists
    const existing = await prisma.electricReading.findUnique({
      where: {
        unitId_billingPeriod: {
          unitId,
          billingPeriod
        }
      }
    });

    if (existing) {
      // Update
      await prisma.electricReading.update({
        where: { id: existing.id },
        data: {
          previousReading: reading.electricPrev,
          presentReading: reading.electricPres,
          consumption: reading.electricCons,
          readingDate
        }
      });
      electricUpdated++;
    } else {
      // Create
      await prisma.electricReading.create({
        data: {
          unitId,
          billingPeriod,
          readingDate,
          previousReading: reading.electricPrev,
          presentReading: reading.electricPres,
          consumption: reading.electricCons
        }
      });
      electricCreated++;
    }
  }

  console.log(`Electric readings created: ${electricCreated}`);
  console.log(`Electric readings updated: ${electricUpdated}`);
  console.log(`Electric readings skipped: ${electricSkipped}`);

  console.log('\n========================================');
  console.log('IMPORTING WATER READINGS');
  console.log('========================================\n');

  let waterCreated = 0;
  let waterUpdated = 0;
  let waterSkipped = 0;

  for (const reading of readings) {
    const unitId = unitMap.get(reading.unitNumber.toUpperCase());
    if (!unitId) {
      waterSkipped++;
      continue;
    }

    // Check if reading already exists
    const existing = await prisma.waterReading.findUnique({
      where: {
        unitId_billingPeriod: {
          unitId,
          billingPeriod
        }
      }
    });

    if (existing) {
      // Update
      await prisma.waterReading.update({
        where: { id: existing.id },
        data: {
          previousReading: reading.waterPrev,
          presentReading: reading.waterPres,
          consumption: reading.waterCons,
          readingDate
        }
      });
      waterUpdated++;
    } else {
      // Create
      await prisma.waterReading.create({
        data: {
          unitId,
          billingPeriod,
          readingDate,
          previousReading: reading.waterPrev,
          presentReading: reading.waterPres,
          consumption: reading.waterCons
        }
      });
      waterCreated++;
    }
  }

  console.log(`Water readings created: ${waterCreated}`);
  console.log(`Water readings updated: ${waterUpdated}`);
  console.log(`Water readings skipped: ${waterSkipped}`);

  console.log('\n========================================');
  console.log('IMPORT COMPLETE');
  console.log('========================================');

  await prisma.$disconnect();
}

main().catch(console.error);
