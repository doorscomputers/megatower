import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const filePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\New folder\\novembersoameterreading\\NOV 2025.xlsx';

// Floor mapping from sheet names
const floorMapping: Record<string, string> = {
  'GF': 'GF',
  '2F': '2F',
  '3F': '3F',
  '4F': '4F',
  '5F': '5F',
  '6F': '6F'
};

interface ExtractedUnit {
  unitNumber: string;
  ownerName: string;
  floor: string;
  area: number;
}

function parseOwnerName(fullName: string): { firstName: string; lastName: string; middleName: string } {
  let name = fullName.trim();

  // Handle "Sps." prefix (spouses)
  if (name.toLowerCase().includes('sps.')) {
    // Keep as lastName for spouses
    name = name.replace(/sps\.\s*/gi, '').trim();
    return { firstName: '', lastName: name, middleName: '' };
  }

  // Handle "LAST, FIRST" format
  if (name.includes(',')) {
    const parts = name.split(',').map(p => p.trim());
    const lastName = parts[0];
    const rest = parts.slice(1).join(' ').trim();

    // Check if rest contains "&" (spouses)
    if (rest.includes('&')) {
      return { firstName: rest, lastName, middleName: '' };
    }

    const restParts = rest.split(/\s+/);
    return {
      firstName: restParts[0] || '',
      lastName,
      middleName: restParts.slice(1).join(' ') || ''
    };
  }

  // Handle names with "&" (spouses without "Sps." prefix)
  if (name.includes('&')) {
    return { firstName: '', lastName: name, middleName: '' };
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

async function main() {
  console.log('========================================');
  console.log('EXTRACTING FROM NOV 2025.xlsx');
  console.log('========================================\n');

  const workbook = XLSX.readFile(filePath);
  console.log('Sheet names:', workbook.SheetNames);

  const extractedUnits: ExtractedUnit[] = [];

  // Process each floor sheet
  for (const sheetName of Object.keys(floorMapping)) {
    if (!workbook.SheetNames.includes(sheetName)) {
      console.log(`Sheet ${sheetName} not found, skipping`);
      continue;
    }

    console.log(`\nProcessing sheet: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    // Data starts at row 8 (index 8)
    for (let i = 8; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;

      const unitCell = row[0];
      const nameCell = row[1];
      const areaCell = row[11]; // Area column

      // Skip empty rows, totals, or non-unit rows
      if (!unitCell || !nameCell) continue;
      if (typeof unitCell !== 'string') continue;
      if (unitCell.toUpperCase().includes('TOTAL')) continue;

      // Skip rows like "A", "B" which are sub-meters
      const unitStr = String(unitCell).trim();
      if (unitStr.length <= 2 && !/^\d/.test(unitStr) && !unitStr.includes('F-')) continue;

      // Parse unit number - should be like "GF-1", "2F-1", etc.
      const unitMatch = unitStr.match(/^(\d*F|GF)-(\d+\w*)$/i);
      if (!unitMatch) {
        // Try matching just the number part if floor is already known from sheet
        const numMatch = unitStr.match(/^(\d+\w*)$/);
        if (numMatch && sheetName) {
          // Use sheet name as floor
          const unitNumber = `M1-${floorMapping[sheetName]}-${numMatch[1]}`;
          extractedUnits.push({
            unitNumber,
            ownerName: String(nameCell).trim(),
            floor: floorMapping[sheetName],
            area: parseFloat(areaCell) || 0
          });
        }
        continue;
      }

      const floor = unitMatch[1].toUpperCase();
      const unitNum = unitMatch[2];

      // Format: M1-{floor}-{num} for Megatower 1
      const unitNumber = `M1-${floor}-${unitNum}`;

      extractedUnits.push({
        unitNumber,
        ownerName: String(nameCell).trim(),
        floor,
        area: parseFloat(areaCell) || 0
      });
    }
  }

  console.log(`\nTotal units extracted: ${extractedUnits.length}`);

  // Print extracted data
  console.log('\nExtracted units:');
  for (const unit of extractedUnits) {
    console.log(`  ${unit.unitNumber}: ${unit.ownerName} (${unit.area} sqm)`);
  }

  // Get tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found!');
    return;
  }

  console.log(`\nUsing tenant: ${tenant.name}`);

  // Get existing units
  const existingUnits = await prisma.unit.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, unitNumber: true, ownerId: true, area: true }
  });
  const existingUnitMap = new Map(existingUnits.map(u => [u.unitNumber.toUpperCase(), u]));
  console.log(`Existing units in database: ${existingUnits.length}`);

  console.log('\n========================================');
  console.log('STEP 1: CREATING/UPDATING UNITS');
  console.log('========================================\n');

  let unitsCreated = 0;
  let unitsUpdated = 0;
  let unitsExisted = 0;

  for (const unitData of extractedUnits) {
    const existing = existingUnitMap.get(unitData.unitNumber.toUpperCase());

    if (!existing) {
      // Create new unit
      const newUnit = await prisma.unit.create({
        data: {
          tenantId: tenant.id,
          unitNumber: unitData.unitNumber,
          floorLevel: unitData.floor,
          unitType: 'RESIDENTIAL',
          area: unitData.area
        }
      });
      console.log(`[CREATED] Unit: ${unitData.unitNumber} (${unitData.area} sqm)`);
      existingUnitMap.set(unitData.unitNumber.toUpperCase(), {
        id: newUnit.id,
        unitNumber: newUnit.unitNumber,
        ownerId: null,
        area: newUnit.area
      });
      unitsCreated++;
    } else {
      // Update area if it was 0 and we have a value
      if (unitData.area > 0 && (!existing.area || Number(existing.area) === 0)) {
        await prisma.unit.update({
          where: { id: existing.id },
          data: { area: unitData.area }
        });
        console.log(`[UPDATED] Unit area: ${unitData.unitNumber} -> ${unitData.area} sqm`);
        unitsUpdated++;
      } else {
        unitsExisted++;
      }
    }
  }

  console.log(`\nUnits created: ${unitsCreated}`);
  console.log(`Units updated: ${unitsUpdated}`);
  console.log(`Units unchanged: ${unitsExisted}`);

  console.log('\n========================================');
  console.log('STEP 2: CREATING/UPDATING OWNERS');
  console.log('========================================\n');

  let ownersCreated = 0;
  let ownersUpdated = 0;

  for (const unitData of extractedUnits) {
    const unit = existingUnitMap.get(unitData.unitNumber.toUpperCase());
    if (!unit) continue;

    const parsedName = parseOwnerName(unitData.ownerName);

    // Get fresh unit with owner
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

      // Link to unit
      await prisma.unit.update({
        where: { id: unit.id },
        data: { ownerId: newOwner.id }
      });

      console.log(`[CREATED] Owner for ${unitData.unitNumber}: ${unitData.ownerName}`);
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
      console.log(`[UPDATED] Owner for ${unitData.unitNumber}: ${unitData.ownerName}`);
      ownersUpdated++;
    }
  }

  console.log('\n========================================');
  console.log('IMPORT COMPLETE');
  console.log('========================================');
  console.log(`Units created: ${unitsCreated}`);
  console.log(`Units updated (area): ${unitsUpdated}`);
  console.log(`Units unchanged: ${unitsExisted}`);
  console.log(`Owners created: ${ownersCreated}`);
  console.log(`Owners updated: ${ownersUpdated}`);

  await prisma.$disconnect();
}

main().catch(console.error);
