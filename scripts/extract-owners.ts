import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const files = [
  'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\3rd FLOOR (nov 2025.xlsx',
  'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\4TH FLOOR (nov 2025.xlsx',
  'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\5TH FLOOR (nov 2025.xlsx',
  'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\6th FLOOR (nov 2025.xlsx',
  'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\GROUND FLOOR (nov 2025.xlsx',
  'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\LG-08 M2 (parking) nov 2025.xlsx',
  'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\LG-11 M2 (parking) nov 2025.xlsx',
  'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\mp 2020 (nov 2025.xlsx',
];

interface ExtractedUnit {
  unitNumber: string;
  ownerName: string;
  floor: string;
  building: string;
  sourceFile: string;
}

function parseOwnerName(fullName: string): { firstName: string; lastName: string; middleName: string } {
  let name = fullName.trim();

  const prefixes = ['SPS.', 'MR.', 'MS.', 'MRS.', 'DR.', 'ENGR.', 'ATTY.'];
  for (const prefix of prefixes) {
    if (name.toUpperCase().startsWith(prefix)) {
      name = name.substring(prefix.length).trim();
    }
  }

  // For spouses or names with &, keep as lastName
  if (fullName.toUpperCase().includes('SPS.') || fullName.includes(' & ')) {
    return { firstName: '', lastName: name, middleName: '' };
  }

  // Handle "LAST, FIRST M.I." format
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    const lastName = parts[0];
    const rest = parts.slice(1).join(' ').trim();
    const restParts = rest.split(/\s+/);
    return {
      firstName: restParts[0] || '',
      lastName,
      middleName: restParts.slice(1).join(' ') || ''
    };
  }

  const parts = name.split(/\s+/).filter(p => p.length > 0);
  if (parts.length === 1) {
    return { firstName: '', lastName: parts[0], middleName: '' };
  } else if (parts.length === 2) {
    return { firstName: parts[0], lastName: parts[1], middleName: '' };
  } else {
    return {
      firstName: parts[0],
      lastName: parts[parts.length - 1],
      middleName: parts.slice(1, -1).join(' ')
    };
  }
}

function normalizeFloor(floor: string): string {
  const f = floor.toUpperCase().trim();
  if (f === 'GF' || f === 'GROUND' || f === 'G') return 'GF';
  if (f === '2F' || f === '2') return '2F';
  if (f === '3F' || f === '3') return '3F';
  if (f === '4F' || f === '4') return '4F';
  if (f === '5F' || f === '5') return '5F';
  if (f === '6F' || f === '6') return '6F';
  if (f.includes('LG')) return 'LG';
  if (f.includes('MP')) return 'MP';
  return f;
}

function normalizeUnitNum(num: string | number): string {
  const s = String(num).trim();
  if (/^\d+$/.test(s)) {
    return String(parseInt(s, 10));
  }
  return s;
}

function formatUnitNumber(building: string, floor: string, unitNum: string | number): string {
  const floorNorm = normalizeFloor(floor);
  const num = normalizeUnitNum(unitNum);
  return `${building}-${floorNorm}-${num}`;
}

async function main() {
  console.log('========================================');
  console.log('STEP 1: EXTRACTING UNITS FROM EXCEL');
  console.log('========================================\n');

  const extractedUnits: ExtractedUnit[] = [];

  for (const filePath of files) {
    console.log(`Reading: ${path.basename(filePath)}`);

    try {
      if (!fs.existsSync(filePath)) {
        console.log(`  -> File not found, skipping`);
        continue;
      }

      const workbook = XLSX.readFile(filePath);

      for (const sheetName of workbook.SheetNames) {
        const sheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        // Skip balance record sheets and paid sheets
        if (sheetName.includes('A') || sheetName.includes('paid')) {
          continue;
        }

        if (data[9] && data[10]) {
          const row9 = data[9];
          const row10 = data[10];

          const floor = row9[5];
          const unitNum = row9[6];
          const buildingIndicator = row9[7];
          const ownerName = row10[5];

          if (floor && unitNum !== undefined && ownerName) {
            let building = 'M1';
            if (buildingIndicator && String(buildingIndicator).toLowerCase().includes('megatower 2')) {
              building = 'M2';
            }

            const unitNumber = formatUnitNumber(building, String(floor), unitNum);

            extractedUnits.push({
              unitNumber,
              ownerName: String(ownerName).trim(),
              floor: normalizeFloor(String(floor)),
              building,
              sourceFile: path.basename(filePath)
            });
          }
        }
      }
    } catch (error: any) {
      console.error(`  -> Error: ${error.message}`);
    }
  }

  console.log(`\nTotal units extracted: ${extractedUnits.length}`);

  // Remove duplicates (keep first occurrence)
  const uniqueUnits = new Map<string, ExtractedUnit>();
  for (const unit of extractedUnits) {
    if (!uniqueUnits.has(unit.unitNumber)) {
      uniqueUnits.set(unit.unitNumber, unit);
    }
  }
  console.log(`Unique units: ${uniqueUnits.size}`);

  // Get tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found in database!');
    return;
  }
  console.log(`\nUsing tenant: ${tenant.name} (${tenant.id})`);

  // Get existing units
  const existingUnits = await prisma.unit.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, unitNumber: true, ownerId: true }
  });
  const existingUnitMap = new Map(existingUnits.map(u => [u.unitNumber.toUpperCase(), u]));
  console.log(`Existing units in database: ${existingUnits.length}`);

  console.log('\n========================================');
  console.log('STEP 2: CREATING MISSING UNITS');
  console.log('========================================\n');

  let unitsCreated = 0;
  let unitsExisted = 0;

  for (const [unitNumber, unitData] of uniqueUnits) {
    const existing = existingUnitMap.get(unitNumber.toUpperCase());

    if (!existing) {
      // Create the unit
      const newUnit = await prisma.unit.create({
        data: {
          tenantId: tenant.id,
          unitNumber: unitNumber,
          floorLevel: unitData.floor,
          unitType: 'RESIDENTIAL', // Default to residential
          area: 0 // Will need to be updated later
        }
      });
      console.log(`[CREATED] Unit: ${unitNumber}`);
      existingUnitMap.set(unitNumber.toUpperCase(), { id: newUnit.id, unitNumber: newUnit.unitNumber, ownerId: null });
      unitsCreated++;
    } else {
      unitsExisted++;
    }
  }

  console.log(`\nUnits created: ${unitsCreated}`);
  console.log(`Units already existed: ${unitsExisted}`);

  console.log('\n========================================');
  console.log('STEP 3: CREATING OWNERS AND LINKING');
  console.log('========================================\n');

  let ownersCreated = 0;
  let ownersUpdated = 0;

  for (const [unitNumber, unitData] of uniqueUnits) {
    const unit = existingUnitMap.get(unitNumber.toUpperCase());

    if (!unit) {
      console.log(`[SKIP] Unit not found: ${unitNumber}`);
      continue;
    }

    const parsedName = parseOwnerName(unitData.ownerName);

    // Get fresh unit data to check if owner exists
    const fullUnit = await prisma.unit.findUnique({
      where: { id: unit.id },
      include: { owner: true }
    });

    if (!fullUnit) continue;

    if (!fullUnit.ownerId) {
      // Create new owner
      const newOwner = await prisma.owner.create({
        data: {
          tenantId: tenant.id,
          firstName: parsedName.firstName,
          lastName: parsedName.lastName,
          middleName: parsedName.middleName,
          email: null,
          phone: null
        }
      });

      // Link owner to unit
      await prisma.unit.update({
        where: { id: unit.id },
        data: { ownerId: newOwner.id }
      });

      console.log(`[CREATED] Owner for ${unitNumber}: ${unitData.ownerName}`);
      ownersCreated++;
    } else {
      // Update existing owner
      await prisma.owner.update({
        where: { id: fullUnit.ownerId },
        data: {
          firstName: parsedName.firstName,
          lastName: parsedName.lastName,
          middleName: parsedName.middleName
        }
      });
      console.log(`[UPDATED] Owner for ${unitNumber}: ${unitData.ownerName}`);
      ownersUpdated++;
    }
  }

  console.log('\n========================================');
  console.log('IMPORT COMPLETE');
  console.log('========================================');
  console.log(`Units created: ${unitsCreated}`);
  console.log(`Units already existed: ${unitsExisted}`);
  console.log(`Owners created: ${ownersCreated}`);
  console.log(`Owners updated: ${ownersUpdated}`);

  await prisma.$disconnect();
}

main().catch(console.error);
