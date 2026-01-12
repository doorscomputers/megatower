import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check current status
  const units = await prisma.unit.findMany({
    where: { unitNumber: { in: ['M2-2F-16', 'M2-2F-17'] } },
    select: { id: true, unitNumber: true, hasSpAssessment: true }
  });

  console.log('Current SP Assessment status:');
  units.forEach(u => console.log(`  ${u.unitNumber}: hasSpAssessment = ${u.hasSpAssessment}`));

  // Enable SP Assessment for these units
  const result = await prisma.unit.updateMany({
    where: { unitNumber: { in: ['M2-2F-16', 'M2-2F-17'] } },
    data: { hasSpAssessment: true }
  });

  console.log(`\nUpdated ${result.count} units to enable SP Assessment`);

  // Verify
  const updated = await prisma.unit.findMany({
    where: { unitNumber: { in: ['M2-2F-16', 'M2-2F-17'] } },
    select: { unitNumber: true, hasSpAssessment: true }
  });

  console.log('\nAfter update:');
  updated.forEach(u => console.log(`  ${u.unitNumber}: hasSpAssessment = ${u.hasSpAssessment}`));

  await prisma.$disconnect();
}

main();
