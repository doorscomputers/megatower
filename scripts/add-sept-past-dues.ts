import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Past dues extracted from September Excel worksheets 16 and 17
const pastDues = [
  {
    unitNumber: 'M2-2F-16',
    owner: 'MR. MARK JAYSON C. PADUA',
    // From Excel Row 32: Aug past dues total = 4336.21, 1st month penalty = 433.621
    // Total Past Dues = 4336.21 + 433.621 = 4769.831
    amount: 4769.83,
    remarks: 'Aug 2025 unpaid (Dues:2160 + Elec:1806.21 + Water:370) + Penalty:433.62'
  },
  {
    unitNumber: 'M2-2F-17',
    owner: 'JOEY ALBERT S. CIPRIANO',
    // From Excel Row 32: Past dues were mostly paid, remaining penalty = 306.35
    amount: 306.35,
    remarks: 'Aug 2025 remaining penalty'
  }
];

async function main() {
  console.log('========================================');
  console.log('ADDING PAST DUES FROM SEPTEMBER EXCEL');
  console.log('========================================\n');

  // Get tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.error('No tenant found!');
    return;
  }

  // Get units
  const unitNumbers = pastDues.map(p => p.unitNumber);
  const units = await prisma.unit.findMany({
    where: {
      tenantId: tenant.id,
      unitNumber: { in: unitNumbers }
    }
  });
  const unitMap = new Map(units.map(u => [u.unitNumber, u]));

  console.log(`Found ${units.length} units\n`);

  // Check for existing opening balance bills
  const unitIds = units.map(u => u.id);
  const existingBills = await prisma.bill.findMany({
    where: {
      unitId: { in: unitIds },
      billType: 'OPENING_BALANCE'
    }
  });
  const existingMap = new Map(existingBills.map(b => [b.unitId, b]));

  let created = 0;
  let updated = 0;

  for (const pastDue of pastDues) {
    const unit = unitMap.get(pastDue.unitNumber);
    if (!unit) {
      console.log(`[SKIP] Unit not found: ${pastDue.unitNumber}`);
      continue;
    }

    const existing = existingMap.get(unit.id);
    const now = new Date();

    if (existing) {
      // Update existing
      await prisma.bill.update({
        where: { id: existing.id },
        data: {
          totalAmount: pastDue.amount,
          balance: pastDue.amount - Number(existing.paidAmount),
          remarks: pastDue.remarks,
          updatedAt: now
        }
      });
      console.log(`[UPDATED] ${pastDue.unitNumber}: ₱${pastDue.amount.toFixed(2)}`);
      updated++;
    } else {
      // Create new opening balance bill
      const billNumber = `OB-${pastDue.unitNumber}`;

      await prisma.bill.create({
        data: {
          tenantId: tenant.id,
          unitId: unit.id,
          billNumber,
          billType: 'OPENING_BALANCE',
          billingMonth: new Date('2025-08-01'), // August 2025 (the month the past dues are from)
          billingPeriodStart: new Date('2025-07-27'),
          billingPeriodEnd: new Date('2025-08-26'),
          statementDate: new Date('2025-08-27'),
          dueDate: new Date('2025-09-05'), // Past due date
          electricAmount: 0,
          waterAmount: 0,
          associationDues: 0,
          penaltyAmount: 0,
          otherCharges: pastDue.amount,
          totalAmount: pastDue.amount,
          paidAmount: 0,
          balance: pastDue.amount,
          status: 'UNPAID',
          remarks: pastDue.remarks
        }
      });
      console.log(`[CREATED] ${pastDue.unitNumber}: ₱${pastDue.amount.toFixed(2)}`);
      console.log(`          ${pastDue.remarks}`);
      created++;
    }
  }

  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log(`Created: ${created}`);
  console.log(`Updated: ${updated}`);

  // Verify
  console.log('\n========================================');
  console.log('VERIFICATION');
  console.log('========================================\n');

  const verifyBills = await prisma.bill.findMany({
    where: {
      unitId: { in: unitIds },
      billType: 'OPENING_BALANCE'
    },
    include: {
      unit: true
    }
  });

  for (const bill of verifyBills) {
    console.log(`${bill.unit.unitNumber}: ₱${Number(bill.totalAmount).toFixed(2)} (${bill.status})`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
