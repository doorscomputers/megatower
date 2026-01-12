import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('========================================');
  console.log('SETUP VERIFICATION');
  console.log('========================================\n');

  // 1. Check SP Assessment Rate
  const settings = await prisma.tenantSettings.findFirst();
  console.log('1. SP Assessment Rate: ₱' + Number(settings?.spAssessmentRate).toFixed(2));

  // 2. Check units have SP Assessment enabled
  console.log('\n2. Unit SP Assessment Status:');
  const units = await prisma.unit.findMany({
    where: { unitNumber: { in: ['M2-2F-16', 'M2-2F-17'] } },
    select: { unitNumber: true, hasSpAssessment: true }
  });
  units.forEach(u => console.log(`   ${u.unitNumber}: hasSpAssessment = ${u.hasSpAssessment}`));

  // 3. Check Opening Balance bills exist
  console.log('\n3. Opening Balance Bills (Previous Balance):');
  const openingBills = await prisma.bill.findMany({
    where: {
      billType: 'OPENING_BALANCE',
      unit: { unitNumber: { in: ['M2-2F-16', 'M2-2F-17'] } }
    },
    include: { unit: { select: { unitNumber: true } } }
  });
  openingBills.forEach(b => console.log(`   ${b.unit.unitNumber}: ₱${Number(b.balance).toFixed(2)}`));

  // 4. Check Billing Adjustments (meter readings)
  console.log('\n4. September Billing Adjustments (Meter Readings):');
  const unitIds = units.map(u => u.unitNumber);
  const unitsWithIds = await prisma.unit.findMany({
    where: { unitNumber: { in: ['M2-2F-16', 'M2-2F-17'] } },
    select: { id: true, unitNumber: true }
  });

  for (const unit of unitsWithIds) {
    const adj = await prisma.billingAdjustment.findFirst({
      where: {
        unitId: unit.id,
        billingPeriod: { gte: new Date('2025-09-01'), lt: new Date('2025-10-01') }
      }
    });
    if (adj) {
      console.log(`   ${unit.unitNumber}:`);
      console.log(`     - SP Assessment in adjustment: ₱${Number(adj.spAssessment || 0).toFixed(2)}`);
    }
  }

  console.log('\n========================================');
  console.log('EXPECTED TOTALS AFTER BILL GENERATION');
  console.log('========================================\n');

  // Calculate expected totals for M2-2F-16
  console.log('M2-2F-16 (Mark Jayson Padua):');
  console.log('  Electric:        ₱1,410.24');
  console.log('  Water:           ₱370.00');
  console.log('  Assoc Dues:      ₱2,160.00');
  console.log('  -----------------------');
  console.log('  Subtotal:        ₱3,940.24');
  console.log('  Past Dues:       ₱4,769.83');
  console.log('  SP Assessment:   ₱849.10');
  console.log('  -----------------------');
  console.log('  EXPECTED TOTAL:  ₱9,559.17');

  console.log('\nM2-2F-17 (Joey Albert Cipriano):');
  console.log('  Electric:        ₱985.92');
  console.log('  Water:           ₱200.00');
  console.log('  Assoc Dues:      ₱1,530.00');
  console.log('  -----------------------');
  console.log('  Subtotal:        ₱2,715.92');
  console.log('  Past Dues:       ₱306.35');
  console.log('  SP Assessment:   ₱849.10');
  console.log('  -----------------------');
  console.log('  EXPECTED TOTAL:  ₱3,871.37');

  await prisma.$disconnect();
}

main();
