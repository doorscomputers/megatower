import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const SP_ASSESSMENT_RATE = 849.10;

async function main() {
  // Find September bills for units 16 and 17
  const bills = await prisma.bill.findMany({
    where: {
      unit: { unitNumber: { in: ['M2-2F-16', 'M2-2F-17'] } },
      billType: 'REGULAR',
      billingMonth: { gte: new Date('2025-09-01'), lt: new Date('2025-10-01') }
    },
    include: { unit: { select: { unitNumber: true } } }
  });

  console.log('========================================');
  console.log('ADDING SP ASSESSMENT TO SEPTEMBER BILLS');
  console.log('========================================\n');

  for (const bill of bills) {
    console.log(`${bill.unit.unitNumber}:`);
    console.log(`  Current SP Assessment: ${Number(bill.spAssessment).toFixed(2)}`);
    console.log(`  Current Total: ${Number(bill.totalAmount).toFixed(2)}`);

    if (Number(bill.spAssessment) === 0) {
      const newTotal = Number(bill.totalAmount) + SP_ASSESSMENT_RATE;
      const newBalance = Number(bill.balance) + SP_ASSESSMENT_RATE;

      await prisma.bill.update({
        where: { id: bill.id },
        data: {
          spAssessment: SP_ASSESSMENT_RATE,
          totalAmount: newTotal,
          balance: newBalance
        }
      });

      console.log(`  NEW SP Assessment: ${SP_ASSESSMENT_RATE.toFixed(2)}`);
      console.log(`  NEW Total: ${newTotal.toFixed(2)}`);
    } else {
      console.log('  [SKIP] SP Assessment already set');
    }
    console.log();
  }

  // Verify final totals
  console.log('========================================');
  console.log('VERIFICATION');
  console.log('========================================\n');

  const updated = await prisma.bill.findMany({
    where: {
      unit: { unitNumber: { in: ['M2-2F-16', 'M2-2F-17'] } },
      billType: 'REGULAR',
      billingMonth: { gte: new Date('2025-09-01'), lt: new Date('2025-10-01') }
    },
    include: { unit: { select: { unitNumber: true } } }
  });

  for (const bill of updated) {
    console.log(`${bill.unit.unitNumber}:`);
    console.log(`  Electric: ${Number(bill.electricAmount).toFixed(2)}`);
    console.log(`  Water: ${Number(bill.waterAmount).toFixed(2)}`);
    console.log(`  Assoc Dues: ${Number(bill.associationDues).toFixed(2)}`);
    console.log(`  SP Assessment: ${Number(bill.spAssessment).toFixed(2)}`);
    console.log(`  Penalty: ${Number(bill.penaltyAmount).toFixed(2)}`);
    console.log(`  Other Charges: ${Number(bill.otherCharges).toFixed(2)}`);
    console.log(`  TOTAL: ${Number(bill.totalAmount).toFixed(2)}`);
    console.log();
  }

  await prisma.$disconnect();
}

main();
