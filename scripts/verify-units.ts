import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const filePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\NOV 2025.xlsx';

interface ExcelUnit {
  unitNumber: string;
  ownerName: string;
  area: number;
}

async function main() {
  console.log('========================================');
  console.log('VERIFYING DATABASE VS EXCEL');
  console.log('========================================\n');

  // Read Excel file
  const workbook = XLSX.readFile(filePath);
  const excelUnits: ExcelUnit[] = [];

  const floorSheets = ['GF', '2F', '3F', '4F', '5F', '6F'];

  for (const sheetName of floorSheets) {
    if (!workbook.SheetNames.includes(sheetName)) continue;

    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    for (let i = 8; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const unitCell = row[0];
      const nameCell = row[1];
      const areaCell = row[11];

      if (!unitCell || !nameCell) continue;
      if (typeof unitCell !== 'string') continue;

      const unitStr = String(unitCell).trim();
      if (unitStr.toUpperCase().includes('TOTAL')) continue;
      if (unitStr.length <= 2 && !/^\d/.test(unitStr) && !unitStr.includes('F-')) continue;

      const unitMatch = unitStr.match(/^(\d*F|GF)-(\d+\w*)$/i);
      if (!unitMatch) continue;

      const floor = unitMatch[1].toUpperCase();
      const unitNum = unitMatch[2];
      const unitNumber = `M1-${floor}-${unitNum}`;

      excelUnits.push({
        unitNumber,
        ownerName: String(nameCell).trim(),
        area: parseFloat(areaCell) || 0
      });
    }
  }

  console.log(`Excel units found: ${excelUnits.length}\n`);

  // Get database units
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found!');
    return;
  }

  const dbUnits = await prisma.unit.findMany({
    where: { tenantId: tenant.id },
    include: { owner: true },
    orderBy: [{ floorLevel: 'asc' }, { unitNumber: 'asc' }]
  });

  const dbUnitMap = new Map(dbUnits.map(u => [u.unitNumber.toUpperCase(), u]));

  console.log(`Database units: ${dbUnits.length}\n`);

  // Compare
  console.log('========================================');
  console.log('COMPARISON RESULTS');
  console.log('========================================\n');

  let matched = 0;
  let mismatched = 0;
  let missing = 0;

  console.log('| Unit | Excel Owner | DB Owner | Area | Status |');
  console.log('|------|-------------|----------|------|--------|');

  for (const excelUnit of excelUnits) {
    const dbUnit = dbUnitMap.get(excelUnit.unitNumber.toUpperCase());

    if (!dbUnit) {
      console.log(`| ${excelUnit.unitNumber} | ${excelUnit.ownerName.substring(0, 30)} | - | ${excelUnit.area} | MISSING |`);
      missing++;
      continue;
    }

    const dbOwnerName = dbUnit.owner
      ? [dbUnit.owner.firstName, dbUnit.owner.middleName, dbUnit.owner.lastName].filter(Boolean).join(' ') || dbUnit.owner.lastName
      : 'No Owner';

    const excelOwnerShort = excelUnit.ownerName.substring(0, 30);
    const dbOwnerShort = dbOwnerName.substring(0, 30);

    // Check if names roughly match (case insensitive, ignoring punctuation)
    const normalizeNm = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');
    const namesMatch = normalizeNm(excelUnit.ownerName).includes(normalizeNm(dbOwnerName.split(' ').pop() || '')) ||
                       normalizeNm(dbOwnerName).includes(normalizeNm(excelUnit.ownerName.split(',')[0] || ''));

    if (namesMatch) {
      matched++;
    } else {
      console.log(`| ${excelUnit.unitNumber} | ${excelOwnerShort} | ${dbOwnerShort} | ${excelUnit.area} | CHECK |`);
      mismatched++;
    }
  }

  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log(`Total Excel units: ${excelUnits.length}`);
  console.log(`Matched: ${matched}`);
  console.log(`Need checking: ${mismatched}`);
  console.log(`Missing in DB: ${missing}`);

  // Show all M1 units with owners
  console.log('\n========================================');
  console.log('ALL M1 UNITS IN DATABASE');
  console.log('========================================\n');

  const m1Units = dbUnits.filter(u => u.unitNumber.startsWith('M1-'));

  let currentFloor = '';
  for (const unit of m1Units) {
    if (unit.floorLevel !== currentFloor) {
      currentFloor = unit.floorLevel;
      console.log(`\n--- ${currentFloor} ---`);
    }

    const ownerName = unit.owner
      ? [unit.owner.lastName, unit.owner.firstName].filter(Boolean).join(', ') || unit.owner.lastName
      : 'No Owner';

    console.log(`${unit.unitNumber}: ${ownerName} (${unit.area} sqm)`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
