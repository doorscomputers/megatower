import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) return;

  console.log("=== ALL READINGS FOR M2-2F-1 ===\n");

  // Get all readings for M2-2F-1 as a sample
  const unit = await prisma.unit.findFirst({
    where: { tenantId: tenant.id, unitNumber: 'M2-2F-1' }
  });

  if (!unit) {
    console.log("Unit not found");
    return;
  }

  const electricReadings = await prisma.electricReading.findMany({
    where: { unitId: unit.id },
    orderBy: { billingPeriod: 'asc' }
  });

  console.log("Electric Readings:");
  for (const r of electricReadings) {
    const period = r.billingPeriod.toISOString().slice(0, 7);
    console.log(`  ${period}: ${r.previousReading} -> ${r.presentReading} (${r.consumption} kWh)`);
  }

  const waterReadings = await prisma.waterReading.findMany({
    where: { unitId: unit.id },
    orderBy: { billingPeriod: 'asc' }
  });

  console.log("\nWater Readings:");
  for (const r of waterReadings) {
    const period = r.billingPeriod.toISOString().slice(0, 7);
    console.log(`  ${period}: ${r.previousReading} -> ${r.presentReading} (${r.consumption} cu.m)`);
  }

  // Compare with Excel November data
  console.log("\n\n=== EXPECTED FROM EXCEL (November 2025) ===");
  console.log("  Electric: 7734 -> 7875 (141 kWh)");
  console.log("  Water: 421 -> 424 (3 cu.m)");

  // Check October readings to understand the gap
  console.log("\n\n=== CHECKING ALL 2F NOVEMBER READINGS ===");

  const novElectric = await prisma.electricReading.findMany({
    where: {
      unit: { tenantId: tenant.id, unitNumber: { startsWith: 'M2-2F' } },
      billingPeriod: new Date(Date.UTC(2025, 10, 1))
    },
    include: { unit: { select: { unitNumber: true } } },
    orderBy: { unit: { unitNumber: 'asc' } }
  });

  for (const r of novElectric) {
    console.log(`${r.unit.unitNumber}: ${r.previousReading} -> ${r.presentReading} (${r.consumption} kWh)`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
