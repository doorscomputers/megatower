import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface PaymentData {
  sheetName: string;
  unitNumber: string;
  orNumber: string | null;
  electricAmount: number;
  waterAmount: number;
  duesAmount: number;
  pastDuesAmount: number;
  spAssessmentAmount: number;
  totalPayment: number;
}

async function main() {
  console.log("=== IMPORTING NOVEMBER 2025 PAYMENTS FOR 2ND FLOOR ===\n");

  // Read the Excel file
  const filePath = 'c:/Users/Warenski/Desktop/MEGATOWER I&II/December/2ND FLOOR December.xlsx';
  const wb = XLSX.readFile(filePath);

  console.log("Sheet names:", wb.SheetNames.join(", "));

  // Get tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    console.log("ERROR: No tenant found!");
    return;
  }

  // Sheets that are unit SOAs (exclude alternate/paid sheets)
  const unitSheets = wb.SheetNames.filter(name => {
    // Filter only numeric sheet names (1, 2, 3, 5, 6, etc.)
    const num = parseInt(name);
    return !isNaN(num) && name === String(num);
  });

  console.log("\nProcessing unit sheets:", unitSheets.join(", "));

  const payments: PaymentData[] = [];

  for (const sheetName of unitSheets) {
    const sheet = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    // Based on analysis of Sheet 1:
    // Row 36 (0-indexed): "PAYMENT AS OF:", "NOVEMBER 2025"
    // Row 37: ELECTRIC - OR# at [7], Amount at [11]
    // Row 38: WATER - OR# at [7], Amount at [11]
    // Row 39: ASSOC. DUES - OR# at [7], Amount at [11]
    // Row 40: PAST DUES - OR# at [7], Amount at [11]
    // Row 41: SPECIAL ASSESSMENT - OR# at [7], Amount at [11]
    // Row 42: ADVANCE PAYMENT
    // Row 43: TOTAL PAYMENT at [11]

    // Find the payment section by looking for "PAYMENT AS OF"
    let paymentStartRow = -1;
    for (let i = 30; i < Math.min(50, data.length); i++) {
      const row = data[i];
      if (row && row.some(cell => String(cell).includes("PAYMENT AS OF"))) {
        paymentStartRow = i + 1; // Next row is Electric
        break;
      }
    }

    if (paymentStartRow === -1) {
      console.log(`  Sheet ${sheetName}: Could not find payment section`);
      continue;
    }

    // Extract payment values using exact column indices from analysis
    const electricRow = data[paymentStartRow] || [];       // Row 37
    const waterRow = data[paymentStartRow + 1] || [];       // Row 38
    const duesRow = data[paymentStartRow + 2] || [];        // Row 39
    const pastDuesRow = data[paymentStartRow + 3] || [];    // Row 40
    const spRow = data[paymentStartRow + 4] || [];          // Row 41
    const totalRow = data[paymentStartRow + 6] || [];       // Row 43 (skip advance payment row)

    // Get OR# from column index 7
    const orNumber = electricRow[7] || null;

    // Get amounts from column index 11
    const electricAmount = parseFloat(electricRow[11]) || 0;
    const waterAmount = parseFloat(waterRow[11]) || 0;
    const duesAmount = parseFloat(duesRow[11]) || 0;
    const pastDuesAmount = parseFloat(pastDuesRow[11]) || 0;
    const spAssessmentAmount = parseFloat(spRow[11]) || 0;
    const totalPayment = parseFloat(totalRow[11]) || 0;

    // Map sheet name to unit number (e.g., "1" -> "M2-2F-1")
    const unitNumber = `M2-2F-${sheetName}`;

    const payment: PaymentData = {
      sheetName,
      unitNumber,
      orNumber: orNumber ? String(orNumber) : null,
      electricAmount,
      waterAmount,
      duesAmount,
      pastDuesAmount,
      spAssessmentAmount,
      totalPayment,
    };

    payments.push(payment);

    console.log(`\n  Sheet ${sheetName} (${unitNumber}):`);
    console.log(`    OR#: ${payment.orNumber || 'N/A'}`);
    console.log(`    Electric: ₱${electricAmount.toFixed(2)}`);
    console.log(`    Water: ₱${waterAmount.toFixed(2)}`);
    console.log(`    Dues: ₱${duesAmount.toFixed(2)}`);
    console.log(`    Past Dues: ₱${pastDuesAmount.toFixed(2)}`);
    console.log(`    SP Assessment: ₱${spAssessmentAmount.toFixed(2)}`);
    console.log(`    Total: ₱${totalPayment.toFixed(2)}`);
  }

  console.log("\n=== SUMMARY ===");
  console.log(`Total units processed: ${payments.length}`);
  console.log(`Units with payments: ${payments.filter(p => p.totalPayment > 0).length}`);

  // Now import to database
  console.log("\n=== IMPORTING TO DATABASE ===\n");

  let imported = 0;
  let skipped = 0;

  for (const payment of payments) {
    if (payment.totalPayment <= 0) {
      console.log(`  ${payment.unitNumber}: No payment, skipping`);
      skipped++;
      continue;
    }

    // Find unit in database
    const unit = await prisma.unit.findFirst({
      where: { tenantId: tenant.id, unitNumber: payment.unitNumber },
    });

    if (!unit) {
      console.log(`  ${payment.unitNumber}: Unit not found in database, skipping`);
      skipped++;
      continue;
    }

    // Find October 2025 bill for this unit (November payment pays October bill)
    const octoberBill = await prisma.bill.findFirst({
      where: {
        tenantId: tenant.id,
        unitId: unit.id,
        billingMonth: new Date(Date.UTC(2025, 9, 1)), // October 2025
      },
    });

    if (!octoberBill) {
      console.log(`  ${payment.unitNumber}: No October 2025 bill found, skipping`);
      skipped++;
      continue;
    }

    // Check if payment already exists with same OR#
    if (payment.orNumber) {
      const existingPayment = await prisma.payment.findFirst({
        where: { tenantId: tenant.id, orNumber: payment.orNumber },
      });
      if (existingPayment) {
        console.log(`  ${payment.unitNumber}: Payment with OR# ${payment.orNumber} already exists, skipping`);
        skipped++;
        continue;
      }
    }

    // Create payment record
    const newPayment = await prisma.payment.create({
      data: {
        tenantId: tenant.id,
        unitId: unit.id,
        orNumber: payment.orNumber,
        paymentDate: new Date(Date.UTC(2025, 10, 15)), // November 15, 2025 (approximate)
        electricAmount: payment.electricAmount,
        waterAmount: payment.waterAmount,
        duesAmount: payment.duesAmount,
        pastDuesAmount: payment.pastDuesAmount,
        spAssessmentAmount: payment.spAssessmentAmount,
        advanceDuesAmount: 0,
        advanceUtilAmount: 0,
        otherAdvanceAmount: 0,
        totalAmount: payment.totalPayment,
        paymentMethod: "CASH",
        status: "CONFIRMED",
      },
    });

    // Create BillPayment allocation
    const billPaymentTotal = Math.min(payment.totalPayment, Number(octoberBill.balance));

    await prisma.billPayment.create({
      data: {
        paymentId: newPayment.id,
        billId: octoberBill.id,
        electricAmount: Math.min(payment.electricAmount, Number(octoberBill.electricAmount)),
        waterAmount: Math.min(payment.waterAmount, Number(octoberBill.waterAmount)),
        duesAmount: Math.min(payment.duesAmount, Number(octoberBill.associationDues)),
        penaltyAmount: payment.pastDuesAmount,
        spAssessmentAmount: payment.spAssessmentAmount,
        otherAmount: 0,
        totalAmount: billPaymentTotal,
      },
    });

    // Update bill paid amount and balance
    const newPaidAmount = Number(octoberBill.paidAmount) + billPaymentTotal;
    const newBalance = Math.max(0, Number(octoberBill.totalAmount) - newPaidAmount);
    const newStatus = newBalance <= 0.01 ? "PAID" : newPaidAmount > 0 ? "PARTIAL" : "UNPAID";

    await prisma.bill.update({
      where: { id: octoberBill.id },
      data: {
        paidAmount: newPaidAmount,
        balance: newBalance,
        status: newStatus,
      },
    });

    // Handle overpayment (advance)
    const overpayment = payment.totalPayment - billPaymentTotal;
    if (overpayment > 0.01) {
      const existingAdvance = await prisma.unitAdvanceBalance.findUnique({
        where: { tenantId_unitId: { tenantId: tenant.id, unitId: unit.id } },
      });

      if (existingAdvance) {
        await prisma.unitAdvanceBalance.update({
          where: { id: existingAdvance.id },
          data: {
            advanceDues: { increment: overpayment },
          },
        });
      } else {
        await prisma.unitAdvanceBalance.create({
          data: {
            tenantId: tenant.id,
            unitId: unit.id,
            advanceDues: overpayment,
            advanceUtilities: 0,
          },
        });
      }
      console.log(`  ${payment.unitNumber}: Imported ₱${payment.totalPayment.toFixed(2)} (₱${overpayment.toFixed(2)} advance)`);
    } else {
      console.log(`  ${payment.unitNumber}: Imported ₱${payment.totalPayment.toFixed(2)}`);
    }

    imported++;
  }

  console.log("\n=== IMPORT COMPLETE ===");
  console.log(`  Imported: ${imported}`);
  console.log(`  Skipped: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
