import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const filePath = 'c:\\Users\\Warenski\\Desktop\\MEGATOWER I&II\\Actual\\2ND FLOOR (oct 2025).xlsx';

interface UnitData {
  sheetName: string;
  unitNumber: string;
  ownerName: string;
  // October readings (for October bill - period 8-27 to 9-26)
  electricPresent: number;
  electricPrevious: number;
  electricConsumption: number;
  electricRate: number;
  electricAmount: number;
  waterPresent: number;
  waterPrevious: number;
  waterConsumption: number;
  waterAmount: number;
  area: number;
  duesAmount: number;
  parkingArea: number;
  parkingAmount: number;
  totalAmount: number;
  // September payments
  septPayments: {
    electricOR: string;
    electricAmount: number;
    waterOR: string;
    waterAmount: number;
    duesOR: string;
    duesAmount: number;
    pastDuesOR: string;
    pastDuesAmount: number;
    spAssessOR: string;
    spAssessAmount: number;
    totalPayment: number;
  };
  // Past dues (if any)
  pastDues: {
    month: string;
    duesAmount: number;
    electricAmount: number;
    waterAmount: number;
    total: number;
    penalty1: number;
    penalty2: number;
    penalty3: number;
    totalWithPenalty: number;
  }[];
  // SP Assessment in adjustments
  spAssessment: number;
  totalAmountDue: number;
}

async function extractData(): Promise<UnitData[]> {
  const workbook = XLSX.readFile(filePath);
  const units: UnitData[] = [];

  // Process each sheet (excluding special sheets like "6 (A)", "16 (A)", etc.)
  for (const sheetName of workbook.SheetNames) {
    // Skip sheets with (A) suffix - they are duplicates
    if (sheetName.includes('(A)') || sheetName.includes('paid')) {
      console.log(`Skipping sheet: ${sheetName}`);
      continue;
    }

    const worksheet = workbook.Sheets[sheetName];
    const data: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

    // Extract unit number from row 9 (index 8)
    const unitRow = data[9] || [];
    const floorLevel = unitRow[5] || ''; // "2F"
    const unitNum = unitRow[6] || ''; // 1, 2, 3, etc.
    const unitNumber = `M2-${floorLevel}-${unitNum}`;

    // Extract owner name from row 10 (index 9)
    const ownerRow = data[10] || [];
    const ownerName = String(ownerRow[5] || '').trim();

    // Extract electric readings from row 16 (index 15)
    const electricRow = data[16] || [];
    const electricPresent = Number(electricRow[7]) || 0;
    const electricPrevious = Number(electricRow[9]) || 0;
    const electricConsumption = Number(electricRow[11]) || 0;
    const electricRate = Number(electricRow[13]) || 11.94;
    const electricAmount = Number(electricRow[18]) || 0;

    // Extract water readings from row 19 (index 18)
    const waterRow = data[19] || [];
    const waterPresent = Number(waterRow[7]) || 0;
    const waterPrevious = Number(waterRow[9]) || 0;
    const waterConsumption = Number(waterRow[11]) || 0;
    const waterAmount = Number(waterRow[18]) || 0;

    // Extract association dues from row 23-24 (index 22-23)
    const duesRow = data[23] || [];
    const area = Number(duesRow[9]) || 0;
    const duesAmount = Number(duesRow[10]) || 0;

    const parkingRow = data[24] || [];
    const parkingArea = Number(parkingRow[9]) || 0;
    const parkingAmount = Number(parkingRow[10]) || 0;

    // Total amount from row 26 (index 25)
    const totalRow = data[26] || [];
    const totalAmount = Number(totalRow[17]) || Number(totalRow[18]) || 0;

    // September payments from rows 37-43 (indices 36-42)
    const electricPayRow = data[37] || [];
    const waterPayRow = data[38] || [];
    const duesPayRow = data[39] || [];
    const pastDuesPayRow = data[40] || [];
    const spAssessPayRow = data[41] || [];
    const totalPayRow = data[43] || [];

    const septPayments = {
      electricOR: String(electricPayRow[7] || '').replace('OR#', '').trim(),
      electricAmount: Number(electricPayRow[11]) || 0,
      waterOR: String(waterPayRow[7] || '').replace('OR#', '').trim(),
      waterAmount: Number(waterPayRow[11]) || 0,
      duesOR: String(duesPayRow[7] || '').replace('OR#', '').trim(),
      duesAmount: Number(duesPayRow[11]) || 0,
      pastDuesOR: String(pastDuesPayRow[7] || '').replace('OR#', '').trim(),
      pastDuesAmount: Number(pastDuesPayRow[11]) || 0,
      spAssessOR: String(spAssessPayRow[7] || '').replace('OR#', '').trim(),
      spAssessAmount: Number(spAssessPayRow[11]) || 0,
      totalPayment: Number(totalPayRow[11]) || 0,
    };

    // Past dues from rows 32-34 (indices 31-33)
    const pastDues: UnitData['pastDues'] = [];
    for (let i = 32; i <= 34; i++) {
      const pdRow = data[i] || [];
      const month = String(pdRow[2] || '').trim();
      const total = Number(pdRow[9]) || 0;
      if (month && total > 0) {
        pastDues.push({
          month,
          duesAmount: Number(pdRow[4]) || 0,
          electricAmount: Number(pdRow[5]) || 0,
          waterAmount: Number(pdRow[7]) || 0,
          total,
          penalty1: Number(pdRow[11]) || 0,
          penalty2: Number(pdRow[13]) || 0,
          penalty3: Number(pdRow[15]) || 0,
          totalWithPenalty: Number(pdRow[18]) || 0,
        });
      }
    }

    // SP Assessment from adjustments (row 37, index 18)
    const spAssessment = Number(electricPayRow[18]) || 0;

    // Total amount due from row 44 (index 43)
    const totalDueRow = data[44] || [];
    const totalAmountDue = Number(totalDueRow[17]) || Number(totalDueRow[16]) || 0;

    if (unitNumber && unitNumber !== 'M2--') {
      units.push({
        sheetName,
        unitNumber,
        ownerName,
        electricPresent,
        electricPrevious,
        electricConsumption,
        electricRate,
        electricAmount,
        waterPresent,
        waterPrevious,
        waterConsumption,
        waterAmount,
        area,
        duesAmount,
        parkingArea,
        parkingAmount,
        totalAmount,
        septPayments,
        pastDues,
        spAssessment,
        totalAmountDue,
      });
    }
  }

  return units;
}

async function saveToDatabase(units: UnitData[]) {
  // Get tenant
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) {
    throw new Error('No tenant found');
  }

  console.log('\n=== EXTRACTED DATA FROM OCTOBER EXCEL ===\n');

  for (const unit of units) {
    console.log(`\n--- ${unit.unitNumber} (${unit.ownerName}) ---`);
    console.log(`October Current Charges:`);
    console.log(`  Electric: ${unit.electricPrevious} → ${unit.electricPresent} = ${unit.electricConsumption} kWh × ${unit.electricRate} = P${unit.electricAmount.toFixed(2)}`);
    console.log(`  Water: ${unit.waterPrevious} → ${unit.waterPresent} = ${unit.waterConsumption} cu.m = P${unit.waterAmount.toFixed(2)}`);
    console.log(`  Dues: ${unit.area} sqm × P60 = P${unit.duesAmount.toFixed(2)}`);
    if (unit.parkingAmount > 0) {
      console.log(`  Parking: ${unit.parkingArea} sqm = P${unit.parkingAmount.toFixed(2)}`);
    }
    console.log(`  Total Current: P${unit.totalAmount.toFixed(2)}`);

    if (unit.septPayments.totalPayment > 0) {
      console.log(`September Payments (Total: P${unit.septPayments.totalPayment.toFixed(2)}):`);
      if (unit.septPayments.electricAmount > 0) console.log(`  Electric: P${unit.septPayments.electricAmount.toFixed(2)} (OR# ${unit.septPayments.electricOR})`);
      if (unit.septPayments.waterAmount > 0) console.log(`  Water: P${unit.septPayments.waterAmount.toFixed(2)} (OR# ${unit.septPayments.waterOR})`);
      if (unit.septPayments.duesAmount > 0) console.log(`  Dues: P${unit.septPayments.duesAmount.toFixed(2)} (OR# ${unit.septPayments.duesOR})`);
      if (unit.septPayments.spAssessAmount > 0) console.log(`  SP Assess: P${unit.septPayments.spAssessAmount.toFixed(2)} (OR# ${unit.septPayments.spAssessOR})`);
    }

    if (unit.pastDues.length > 0) {
      console.log(`Past Dues:`);
      for (const pd of unit.pastDues) {
        console.log(`  ${pd.month}: P${pd.total.toFixed(2)} + penalties = P${pd.totalWithPenalty.toFixed(2)}`);
      }
    }

    console.log(`Total Amount Due: P${unit.totalAmountDue.toFixed(2)}`);
  }

  // Now save the data
  console.log('\n\n=== SAVING TO DATABASE ===\n');

  const septemberBillingMonth = new Date(Date.UTC(2025, 8, 1)); // September 2025
  const octoberBillingMonth = new Date(Date.UTC(2025, 9, 1)); // October 2025
  const paymentDate = new Date(Date.UTC(2025, 8, 15)); // September 15, 2025

  for (const unit of units) {
    // Find the unit in database
    const dbUnit = await prisma.unit.findFirst({
      where: {
        unitNumber: unit.unitNumber,
        tenantId: tenant.id,
      },
    });

    if (!dbUnit) {
      console.log(`Unit ${unit.unitNumber} not found in database - SKIPPING`);
      continue;
    }

    // 1. Save September payment if there was one
    if (unit.septPayments.totalPayment > 0) {
      // Check if payment already exists by unitId and date (to avoid duplicates)
      const orNumber = unit.septPayments.electricOR || unit.septPayments.duesOR || null;
      const existingPayment = await prisma.payment.findFirst({
        where: {
          unitId: dbUnit.id,
          tenantId: tenant.id,
          paymentDate: paymentDate,
        },
      });

      // Also check if this exact OR# already exists for this tenant (unique constraint)
      const existingOR = orNumber ? await prisma.payment.findFirst({
        where: {
          tenantId: tenant.id,
          orNumber: orNumber,
        },
      }) : null;

      if (!existingPayment) {
        // If OR# already exists for another unit, append unit number to make it unique
        let finalOrNumber = orNumber;
        if (existingOR && existingOR.unitId !== dbUnit.id) {
          finalOrNumber = orNumber ? `${orNumber}-${unit.sheetName}` : null;
        }

        // Create payment
        const payment = await prisma.payment.create({
          data: {
            unitId: dbUnit.id,
            tenantId: tenant.id,
            paymentDate: paymentDate,
            totalAmount: unit.septPayments.totalPayment,
            electricAmount: unit.septPayments.electricAmount,
            waterAmount: unit.septPayments.waterAmount,
            duesAmount: unit.septPayments.duesAmount,
            pastDuesAmount: unit.septPayments.pastDuesAmount,
            spAssessmentAmount: unit.septPayments.spAssessAmount,
            advanceDuesAmount: 0,
            advanceUtilAmount: 0,
            paymentMethod: 'CASH',
            orNumber: finalOrNumber,
            remarks: 'Imported from October Excel - September payment',
          },
        });
        console.log(`Created September payment for ${unit.unitNumber}: P${unit.septPayments.totalPayment.toFixed(2)} (OR# ${payment.orNumber})`);

        // Update September bill status to PAID if payment covers full amount
        const septBill = await prisma.bill.findFirst({
          where: {
            unitId: dbUnit.id,
            tenantId: tenant.id,
            billingMonth: septemberBillingMonth,
          },
        });

        if (septBill) {
          const newPaidAmount = Number(septBill.paidAmount) + unit.septPayments.totalPayment;
          const newStatus = newPaidAmount >= Number(septBill.totalAmount) ? 'PAID' : 'PARTIAL';
          await prisma.bill.update({
            where: { id: septBill.id },
            data: {
              paidAmount: newPaidAmount,
              status: newStatus,
            },
          });
          console.log(`Updated September bill status to ${newStatus}`);
        }
      } else {
        console.log(`Payment already exists for ${unit.unitNumber} - skipping`);
      }
    }

    // 2. Save October meter readings
    const readingDate = new Date(Date.UTC(2025, 8, 26)); // September 26, 2025 (end of reading period)
    const octoberBillingPeriod = new Date(Date.UTC(2025, 9, 1)); // October 2025

    // Check if electric reading already exists
    if (unit.electricPresent > 0) {
      const existingElectric = await prisma.electricReading.findUnique({
        where: {
          unitId_billingPeriod: {
            unitId: dbUnit.id,
            billingPeriod: octoberBillingPeriod,
          },
        },
      });

      if (!existingElectric) {
        await prisma.electricReading.create({
          data: {
            unitId: dbUnit.id,
            readingDate: readingDate,
            billingPeriod: octoberBillingPeriod,
            previousReading: unit.electricPrevious,
            presentReading: unit.electricPresent,
            consumption: unit.electricConsumption,
            remarks: 'Imported from October Excel',
          },
        });
        console.log(`Created electric reading for ${unit.unitNumber}: ${unit.electricPrevious}→${unit.electricPresent} = ${unit.electricConsumption} kWh`);
      } else {
        console.log(`Electric reading already exists for ${unit.unitNumber} - skipping`);
      }
    }

    // Check if water reading already exists
    if (unit.waterPresent > 0) {
      const existingWater = await prisma.waterReading.findUnique({
        where: {
          unitId_billingPeriod: {
            unitId: dbUnit.id,
            billingPeriod: octoberBillingPeriod,
          },
        },
      });

      if (!existingWater) {
        await prisma.waterReading.create({
          data: {
            unitId: dbUnit.id,
            readingDate: readingDate,
            billingPeriod: octoberBillingPeriod,
            previousReading: unit.waterPrevious,
            presentReading: unit.waterPresent,
            consumption: unit.waterConsumption,
            remarks: 'Imported from October Excel',
          },
        });
        console.log(`Created water reading for ${unit.unitNumber}: ${unit.waterPrevious}→${unit.waterPresent} = ${unit.waterConsumption} cu.m`);
      } else {
        console.log(`Water reading already exists for ${unit.unitNumber} - skipping`);
      }
    }
  }

  console.log('\n=== IMPORT COMPLETE ===');
}

async function main() {
  try {
    const units = await extractData();
    console.log(`Extracted data for ${units.length} units`);
    await saveToDatabase(units);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
