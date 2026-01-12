import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating SP Assessment rate to 849.10...');

  const result = await prisma.tenantSettings.updateMany({
    data: {
      spAssessmentRate: 849.10
    }
  });

  console.log(`Updated ${result.count} tenant settings`);

  // Verify the update
  const settings = await prisma.tenantSettings.findFirst();
  console.log('New spAssessmentRate:', settings?.spAssessmentRate?.toString());

  await prisma.$disconnect();
}

main().catch(console.error);
