import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("=== IMPORTING MISSING NOVEMBER 2025 PAYMENTS ===\n");

  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log("ERROR: No tenant found!");
    return;
  }

  // Read the Excel file
  const filePath = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/December/2ND FLOOR December.xlsx';
  const wb = XLSX.readFile(filePath);

  // Units that were skipped due to duplicate OR# 21685
  const missingUnits = ['7', '8', '9', '12', '19'];

  for (const sheetName of missingUnits) {
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    // Find the payment section
    let paymentStartRow = -1;
    for (let i = 30; i < Math.min(50, data.length); i++) {
      const row = data[i];
      if (row && row.some(cell => String(cell).includes("PAYMENT AS OF"))) {
        paymentStartRow = i + 1;
        break;
      }
    }

    if (paymentStartRow === -1) {
      console.log(`Sheet ${sheetName}: Could not find payment section`);
      continue;
    }

    const electricRow = data[paymentStartRow] || [];
    const waterRow = data[paymentStartRow + 1] || [];
    const duesRow = data[paymentStartRow + 2] || [];
    const pastDuesRow = data[paymentStartRow + 3] || [];
    const spRow = data[paymentStartRow + 4] || [];
    const totalRow = data[paymentStartRow + 6] || [];

    const electricAmount = parseFloat(electricRow[11]) || 0;
    const waterAmount = parseFloat(waterRow[11]) || 0;
    const duesAmount = parseFloat(duesRow[11]) || 0;
    const pastDuesAmount = parseFloat(pastDuesRow[11]) || 0;
    const spAssessmentAmount = parseFloat(spRow[11]) || 0;
    const totalPayment = parseFloat(totalRow[11]) || 0;

    const unitNumber = `M2-2F-${sheetName}`;
    // Create unique OR# by appending unit number
    const orNumber = `21685-M2-2F-${sheetName}`;

    console.log(`\nSheet ${sheetName} (${unitNumber}):`);
    console.log(`  OR#: ${orNumber}`);
    console.log(`  Electric: ₱${electricAmount.toFixed(2)}`);
    console.log(`  Water: ₱${waterAmount.toFixed(2)}`);
    console.log(`  Dues: ₱${duesAmount.toFixed(2)}`);
    console.log(`  Total: ₱${totalPayment.toFixed(2)}`);

    if (totalPayment <= 0) {
      console.log(`  Skipping - no payment`);
      continue;
    }

    // Find unit
    const unit = await prisma.unit.findFirst({
      where: { tenantId: tenant.id, unitNumber },
    });

    if (!unit) {
      console.log(`  Unit not found in database`);
      continue;
    }

    // Check if already imported
    const existing = await prisma.payment.findFirst({
      where: { tenantId: tenant.id, orNumber },
    });

    if (existing) {
      console.log(`  Already imported`);
      continue;
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        tenantId: tenant.id,
        unitId: unit.id,
        orNumber,
        paymentDate: new Date(Date.UTC(2025, 10, 15)),
        electricAmount,
        waterAmount,
        duesAmount,
        pastDuesAmount,
        spAssessmentAmount,
        advanceDuesAmount: 0,
        advanceUtilAmount: 0,
        otherAdvanceAmount: 0,
        totalAmount: totalPayment,
        paymentMethod: "CASH",
        status: "CONFIRMED",
      },
    });

    // Store as advance (no November bills yet)
    const existingAdvance = await prisma.unitAdvanceBalance.findUnique({
      where: { tenantId_unitId: { tenantId: tenant.id, unitId: unit.id } },
    });

    if (existingAdvance) {
      await prisma.unitAdvanceBalance.update({
        where: { id: existingAdvance.id },
        data: { advanceDues: { increment: totalPayment } },
      });
    } else {
      await prisma.unitAdvanceBalance.create({
        data: {
          tenantId: tenant.id,
          unitId: unit.id,
          advanceDues: totalPayment,
          advanceUtilities: 0,
        },
      });
    }

    console.log(`  ✓ Imported as advance balance`);
  }

  console.log("\n=== DONE ===");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
