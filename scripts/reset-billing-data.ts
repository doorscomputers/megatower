import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('========================================');
  console.log('RESETTING ALL BILLING DATA');
  console.log('========================================\n');

  console.log('WARNING: This will delete ALL billing-related records!');
  console.log('Tables to be cleared:');
  console.log('  - SOADocument');
  console.log('  - SOABatch');
  console.log('  - BillPayment (junction table)');
  console.log('  - Penalty');
  console.log('  - Bill');
  console.log('  - Payment');
  console.log('  - ElectricReading');
  console.log('  - WaterReading');
  console.log('  - BillingAdjustment');
  console.log('  - UnitAdvanceBalance');
  console.log('  - BillingChecklist');
  console.log('\n');

  // Delete in order to avoid FK violations
  console.log('Step 1: Deleting SOADocument...');
  const soaDocResult = await prisma.sOADocument.deleteMany({});
  console.log(`  Deleted ${soaDocResult.count} SOA documents`);

  console.log('Step 2: Deleting SOABatch...');
  const soaBatchResult = await prisma.sOABatch.deleteMany({});
  console.log(`  Deleted ${soaBatchResult.count} SOA batches`);

  console.log('Step 3: Deleting BillPayment (junction)...');
  const billPaymentResult = await prisma.billPayment.deleteMany({});
  console.log(`  Deleted ${billPaymentResult.count} bill-payment links`);

  console.log('Step 4: Deleting Penalty...');
  const penaltyResult = await prisma.penalty.deleteMany({});
  console.log(`  Deleted ${penaltyResult.count} penalties`);

  console.log('Step 5: Deleting Bill...');
  const billResult = await prisma.bill.deleteMany({});
  console.log(`  Deleted ${billResult.count} bills`);

  console.log('Step 6: Deleting Payment...');
  const paymentResult = await prisma.payment.deleteMany({});
  console.log(`  Deleted ${paymentResult.count} payments`);

  console.log('Step 7: Deleting ElectricReading...');
  const electricResult = await prisma.electricReading.deleteMany({});
  console.log(`  Deleted ${electricResult.count} electric readings`);

  console.log('Step 8: Deleting WaterReading...');
  const waterResult = await prisma.waterReading.deleteMany({});
  console.log(`  Deleted ${waterResult.count} water readings`);

  console.log('Step 9: Deleting BillingAdjustment...');
  const adjustmentResult = await prisma.billingAdjustment.deleteMany({});
  console.log(`  Deleted ${adjustmentResult.count} billing adjustments`);

  console.log('Step 10: Deleting UnitAdvanceBalance...');
  const advanceResult = await prisma.unitAdvanceBalance.deleteMany({});
  console.log(`  Deleted ${advanceResult.count} advance balances`);

  console.log('Step 11: Deleting BillingChecklist...');
  const checklistResult = await prisma.billingChecklist.deleteMany({});
  console.log(`  Deleted ${checklistResult.count} billing checklists`);

  console.log('\n========================================');
  console.log('RESET COMPLETE');
  console.log('========================================');
  console.log('Summary:');
  console.log(`  SOA Documents:     ${soaDocResult.count}`);
  console.log(`  SOA Batches:       ${soaBatchResult.count}`);
  console.log(`  Bill-Payment links: ${billPaymentResult.count}`);
  console.log(`  Penalties:         ${penaltyResult.count}`);
  console.log(`  Bills:             ${billResult.count}`);
  console.log(`  Payments:          ${paymentResult.count}`);
  console.log(`  Electric Readings: ${electricResult.count}`);
  console.log(`  Water Readings:    ${waterResult.count}`);
  console.log(`  Adjustments:       ${adjustmentResult.count}`);
  console.log(`  Advance Balances:  ${advanceResult.count}`);
  console.log(`  Checklists:        ${checklistResult.count}`);

  await prisma.$disconnect();
}

main().catch(console.error);
