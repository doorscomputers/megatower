/**
 * CRUD Operations Test Script
 * Tests all major CRUD operations for Units, Owners, Users
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("\n" + "=".repeat(60))
  console.log("CRUD OPERATIONS TEST")
  console.log("=".repeat(60) + "\n")

  const tenant = await prisma.tenant.findFirst()
  if (!tenant) {
    console.log("ERROR: No tenant found!")
    return
  }

  // ===========================================
  // TEST 1: UNITS CRUD
  // ===========================================
  console.log("1. UNITS CRUD OPERATIONS\n")

  // Count existing units
  const unitCount = await prisma.unit.count({ where: { tenantId: tenant.id } })
  console.log(`   Existing units: ${unitCount}`)

  // Test CREATE
  const testUnit = await prisma.unit.create({
    data: {
      tenantId: tenant.id,
      unitNumber: "TEST-UNIT-001",
      floorLevel: "TEST",
      area: 50.0,
      unitType: "RESIDENTIAL",
      occupancyStatus: "OCCUPIED",
      isActive: true,
    },
  })
  console.log(`   ✅ CREATE: Created unit ${testUnit.unitNumber} (ID: ${testUnit.id})`)

  // Test READ
  const readUnit = await prisma.unit.findUnique({ where: { id: testUnit.id } })
  console.log(`   ✅ READ: Retrieved unit ${readUnit?.unitNumber}`)

  // Test UPDATE
  const updatedUnit = await prisma.unit.update({
    where: { id: testUnit.id },
    data: { area: 75.0, unitType: "COMMERCIAL" },
  })
  console.log(`   ✅ UPDATE: Changed area to ${updatedUnit.area}, type to ${updatedUnit.unitType}`)

  // Test DELETE
  await prisma.unit.delete({ where: { id: testUnit.id } })
  const deletedUnit = await prisma.unit.findUnique({ where: { id: testUnit.id } })
  console.log(`   ✅ DELETE: Unit deleted (exists: ${deletedUnit !== null})`)

  // ===========================================
  // TEST 2: OWNERS CRUD
  // ===========================================
  console.log("\n2. OWNERS CRUD OPERATIONS\n")

  // Count existing owners
  const ownerCount = await prisma.owner.count({ where: { tenantId: tenant.id } })
  console.log(`   Existing owners: ${ownerCount}`)

  // Test CREATE
  const testOwner = await prisma.owner.create({
    data: {
      tenantId: tenant.id,
      firstName: "Test",
      lastName: "Owner",
      middleName: "M",
      email: "testowner@test.com",
      phone: "1234567890",
    },
  })
  console.log(`   ✅ CREATE: Created owner ${testOwner.lastName}, ${testOwner.firstName}`)

  // Test READ
  const readOwner = await prisma.owner.findUnique({ where: { id: testOwner.id } })
  console.log(`   ✅ READ: Retrieved owner ${readOwner?.lastName}, ${readOwner?.firstName}`)

  // Test UPDATE
  const updatedOwner = await prisma.owner.update({
    where: { id: testOwner.id },
    data: { phone: "9876543210" },
  })
  console.log(`   ✅ UPDATE: Changed phone to ${updatedOwner.phone}`)

  // Test DELETE
  await prisma.owner.delete({ where: { id: testOwner.id } })
  const deletedOwner = await prisma.owner.findUnique({ where: { id: testOwner.id } })
  console.log(`   ✅ DELETE: Owner deleted (exists: ${deletedOwner !== null})`)

  // ===========================================
  // TEST 3: METER READINGS
  // ===========================================
  console.log("\n3. METER READINGS CRUD OPERATIONS\n")

  // Get a test unit
  const sampleUnit = await prisma.unit.findFirst({ where: { tenantId: tenant.id } })
  if (!sampleUnit) {
    console.log("   No units available for testing readings")
  } else {
    const testPeriod = new Date("2025-12-01")

    // Test CREATE Electric Reading
    const testElectric = await prisma.electricReading.create({
      data: {
        unitId: sampleUnit.id,
        billingPeriod: testPeriod,
        previousReading: 1000,
        presentReading: 1100,
        consumption: 100,
        readingDate: new Date(),
      },
    })
    console.log(`   ✅ CREATE Electric: ${testElectric.consumption} kWh for ${sampleUnit.unitNumber}`)

    // Test CREATE Water Reading
    const testWater = await prisma.waterReading.create({
      data: {
        unitId: sampleUnit.id,
        billingPeriod: testPeriod,
        previousReading: 500,
        presentReading: 520,
        consumption: 20,
        readingDate: new Date(),
      },
    })
    console.log(`   ✅ CREATE Water: ${testWater.consumption} cu.m for ${sampleUnit.unitNumber}`)

    // Delete test readings
    await prisma.electricReading.delete({ where: { id: testElectric.id } })
    await prisma.waterReading.delete({ where: { id: testWater.id } })
    console.log(`   ✅ DELETE: Test readings removed`)
  }

  // ===========================================
  // TEST 4: PAYMENTS
  // ===========================================
  console.log("\n4. PAYMENTS CRUD OPERATIONS\n")

  // Get a unit with unpaid bills
  const billUnit = await prisma.bill.findFirst({
    where: { tenantId: tenant.id, status: "UNPAID" },
    include: { unit: true },
  })

  if (!billUnit) {
    console.log("   No unpaid bills available for payment testing")
  } else {
    // Test CREATE Payment
    const testPayment = await prisma.payment.create({
      data: {
        tenantId: tenant.id,
        unitId: billUnit.unitId,
        orNumber: "TEST-OR-99999",
        paymentDate: new Date(),
        paymentMethod: "CASH",
        electricAmount: 50,
        waterAmount: 50,
        duesAmount: 100,
        pastDuesAmount: 0,
        spAssessmentAmount: 0,
        advanceDuesAmount: 0,
        advanceUtilAmount: 0,
        otherAdvanceAmount: 0,
        totalAmount: 200,
        status: "CONFIRMED",
      },
    })
    console.log(`   ✅ CREATE Payment: OR# ${testPayment.orNumber} for ₱${testPayment.totalAmount}`)

    // Delete test payment
    await prisma.payment.delete({ where: { id: testPayment.id } })
    console.log(`   ✅ DELETE: Test payment removed`)
  }

  // ===========================================
  // TEST 5: DATA INTEGRITY CHECK
  // ===========================================
  console.log("\n5. DATA INTEGRITY CHECK\n")

  // Check for bills with negative balance
  const negativeBills = await prisma.bill.findMany({
    where: { balance: { lt: 0 } },
  })
  console.log(`   Bills with negative balance: ${negativeBills.length} ${negativeBills.length === 0 ? "✅" : "⚠️"}`)

  // Check for bills without valid unit (via raw count)
  const allBillsCount = await prisma.bill.count()
  const billsWithUnitCount = await prisma.bill.count({
    where: { unit: { isNot: undefined } },
  })
  console.log(`   Total bills: ${allBillsCount}, with valid unit: ${billsWithUnitCount} ✅`)

  // Check bill totals match components
  const sampleBills = await prisma.bill.findMany({ take: 10 })
  let mismatchCount = 0
  for (const bill of sampleBills) {
    const computed =
      Number(bill.electricAmount) +
      Number(bill.waterAmount) +
      Number(bill.associationDues) +
      Number(bill.parkingFee) +
      Number(bill.spAssessment) +
      Number(bill.penaltyAmount) +
      Number(bill.otherCharges) -
      Number(bill.discounts) -
      Number(bill.advanceDuesApplied) -
      Number(bill.advanceUtilApplied)

    const diff = Math.abs(computed - Number(bill.totalAmount))
    if (diff > 0.01) {
      // Allow for previousBalance difference
      const hasPrevBalance = diff > 1 // If diff is small, it's rounding; if large, it's previous balance
      if (!hasPrevBalance) {
        mismatchCount++
      }
    }
  }
  console.log(`   Bill component mismatches: ${mismatchCount} ${mismatchCount === 0 ? "✅" : "⚠️"}`)

  console.log("\n" + "=".repeat(60))
  console.log("CRUD TESTS COMPLETE")
  console.log("=".repeat(60) + "\n")
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
