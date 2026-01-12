import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Updating electric rate to 12.48...');

  const result = await prisma.tenantSettings.updateMany({
    data: {
      electricRate: 12.48
    }
  });

  console.log(`Updated ${result.count} tenant settings`);

  // Verify the update
  const settings = await prisma.tenantSettings.findFirst();
  console.log('New electricRate:', settings?.electricRate?.toString());

  await prisma.$disconnect();
}

main().catch(console.error);
