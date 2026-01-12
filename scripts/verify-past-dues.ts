import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verify() {
  const units = await prisma.unit.findMany({
    where: { unitNumber: { in: ['M2-2F-16', 'M2-2F-17'] } },
    include: {
      bills: {
        where: { status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        orderBy: { billingMonth: 'asc' }
      }
    }
  });

  console.log('========================================');
  console.log('UNPAID BILLS VERIFICATION');
  console.log('========================================');

  for (const unit of units) {
    console.log('\n' + unit.unitNumber + ':');
    let total = 0;
    for (const bill of unit.bills) {
      const balance = Number(bill.balance);
      total += balance;
      const monthStr = bill.billingMonth.toISOString().slice(0, 7);
      console.log(`  - ${bill.billType} (${monthStr}): P${balance.toFixed(2)}`);
    }
    console.log(`  TOTAL PREVIOUS BALANCE: P${total.toFixed(2)}`);
  }

  await prisma.$disconnect();
}

verify();
