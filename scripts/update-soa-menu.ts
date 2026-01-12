import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateMenu() {
  console.log('Updating SOA menu...');

  // Update the SOA menu item to point to the monthly SOA page
  const result = await prisma.menu.updateMany({
    where: { path: '/billing/soa' },
    data: {
      path: '/billing/soa/monthly',
      label: 'Monthly SOA'
    }
  });

  console.log(`Updated ${result.count} menu item(s)`);

  // Verify
  const menu = await prisma.menu.findFirst({
    where: { name: 'soa' }
  });
  console.log(`Menu now: "${menu?.label}" -> ${menu?.path}`);

  await prisma.$disconnect();
}

updateMenu();
