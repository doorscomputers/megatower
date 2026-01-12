import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"
import * as XLSX from "xlsx"

interface ParsedUnit {
  unitNumber: string
  ownerName: string
  balance: number
  buildingPrefix: string
  // Previous readings for initial setup
  electricPrevReading: number | null
  electricPresReading: number | null
  electricConsumption: number | null
  waterPrevReading: number | null
  waterPresReading: number | null
  waterConsumption: number | null
}

/**
 * Parse Excel file to extract unit numbers, balances, and meter readings
 *
 * Excel structure (based on actual SOA files):
 * - Row 9, col 5: Floor (e.g., "2F")
 * - Row 9, col 6: Unit number (e.g., "1")
 * - Row 9, col 7: Building (e.g., "Megatower 2")
 * - Row 10, col 5: Owner name
 * - Row 16, col 7: Electric present reading
 * - Row 16, col 9: Electric previous reading
 * - Row 16, col 11: Electric consumption
 * - Row 19, col 7: Water present reading
 * - Row 19, col 9: Water previous reading
 * - Row 19, col 11: Water consumption
 * - Row 44, col 17: Balance amount (row before "TOTAL AMOUNT DUE AND PAYABLE" label)
 * - Row 45, col 0: "TOTAL AMOUNT DUE AND PAYABLE" label
 */
function parseExcelBuffer(buffer: ArrayBuffer): ParsedUnit[] {
  const wb = XLSX.read(buffer, { type: "array" })
  const results: ParsedUnit[] = []

  for (const sheetName of wb.SheetNames) {
    // Skip summary, balance, and paid sheets
    const upperName = sheetName.toUpperCase()
    if (upperName.includes("SUMMARY") || upperName.includes("BALANCES") || upperName.includes("PAID")) continue

    const ws = wb.Sheets[sheetName]
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][]

    if (data.length < 15) continue

    // Row 9: Unit info (cols 5-7)
    const unitRow = data[9] || []
    const floorPrefix = String(unitRow[5] || "").trim()  // "2F"
    const unitNum = String(unitRow[6] || "").trim()       // "1"
    const building = String(unitRow[7] || "").trim()      // "Megatower 2"

    if (!floorPrefix && !unitNum) continue

    // Row 10: Owner name (col 5)
    const ownerRow = data[10] || []
    const ownerName = String(ownerRow[5] || "").trim()

    // Determine building prefix from building field
    // "Megatower 2" -> M2, "Megatower" or "Megatower 1" -> M1
    const buildingPrefix = building.includes("2") ? "M2" : "M1"

    // Extract meter readings
    // Electric: Row 16 (values), cols 7=present, 9=previous, 11=consumption
    const electricRow = data[16] || []
    const electricPresReading = parseFloat(electricRow[7]) || null
    const electricPrevReading = parseFloat(electricRow[9]) || null
    const electricConsumption = parseFloat(electricRow[11]) || null

    // Water: Row 19 (values), cols 7=present, 9=previous, 11=consumption
    const waterRow = data[19] || []
    const waterPresReading = parseFloat(waterRow[7]) || null
    const waterPrevReading = parseFloat(waterRow[9]) || null
    const waterConsumption = parseFloat(waterRow[11]) || null

    // Find TOTAL AMOUNT DUE AND PAYABLE - check col 0 for label
    let balance = 0
    for (let i = 40; i < Math.min(55, data.length); i++) {
      const row = data[i] || []
      if (String(row[0]).toUpperCase().includes("TOTAL AMOUNT DUE AND PAYABLE")) {
        // Value is in the row above at col 17
        const prevRow = data[i - 1] || []
        balance = parseFloat(prevRow[17]) || 0
        break
      }
    }

    // Build unit number (without prefix - will be added later)
    const normalizedUnit = String(unitNum).replace(/\s+/g, "")
    const unitNumber = `${floorPrefix}-${normalizedUnit}`

    results.push({
      unitNumber,
      ownerName,
      balance,
      buildingPrefix,
      electricPrevReading,
      electricPresReading,
      electricConsumption,
      waterPrevReading,
      waterPresReading,
      waterConsumption,
    })
  }

  return results
}

// POST - Import balances from Excel file
export async function POST(request: NextRequest) {
  try {
    const { tenantId, user } = await requireAuth(await headers())

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const buildingPrefix = formData.get("buildingPrefix") as string || "M1"

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      )
    }

    // Read file content
    const buffer = await file.arrayBuffer()
    const parsedUnits = parseExcelBuffer(buffer)

    if (parsedUnits.length === 0) {
      return NextResponse.json(
        { error: "No units found in Excel file" },
        { status: 400 }
      )
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Use auto-detected building prefix from each unit's Excel data
    const unitsWithPrefix = parsedUnits.map((u) => ({
      ...u,
      unitNumber: `${u.buildingPrefix}-${u.unitNumber}`,
    }))

    // Get all units for this tenant
    const dbUnits = await prisma.unit.findMany({
      where: { tenantId: tenantId, isActive: true },
      select: { id: true, unitNumber: true },
    })
    const unitMap = new Map(dbUnits.map((u) => [u.unitNumber, u.id]))

    // Check existing opening balances
    const existingBills = await prisma.bill.findMany({
      where: {
        tenantId,
        billType: "OPENING_BALANCE",
      },
      select: { id: true, unitId: true, totalAmount: true },
    })
    const billMap = new Map(existingBills.map((b) => [b.unitId, b]))

    const results = {
      matched: [] as Array<{
        unitNumber: string
        ownerName: string
        newBalance: number
        previousBalance: number | null
        action: "create" | "update" | "skip"
        electricPrevReading: number | null
        electricPresReading: number | null
        waterPrevReading: number | null
        waterPresReading: number | null
      }>,
      unmatched: [] as Array<{
        unitNumber: string
        ownerName: string
        balance: number
        electricPrevReading: number | null
        waterPrevReading: number | null
      }>,
    }

    // Match units
    for (const parsed of unitsWithPrefix) {
      const unitId = unitMap.get(parsed.unitNumber)

      if (!unitId) {
        results.unmatched.push({
          unitNumber: parsed.unitNumber,
          ownerName: parsed.ownerName,
          balance: parsed.balance,
          electricPrevReading: parsed.electricPrevReading,
          waterPrevReading: parsed.waterPrevReading,
        })
        continue
      }

      const existingBill = billMap.get(unitId)
      const previousBalance = existingBill ? Number(existingBill.totalAmount) : null

      let action: "create" | "update" | "skip" = "create"
      if (existingBill) {
        if (Math.abs(Number(existingBill.totalAmount) - parsed.balance) < 0.01) {
          action = "skip"
        } else {
          action = "update"
        }
      }

      results.matched.push({
        unitNumber: parsed.unitNumber,
        ownerName: parsed.ownerName,
        newBalance: parsed.balance,
        previousBalance,
        action,
        electricPrevReading: parsed.electricPrevReading,
        electricPresReading: parsed.electricPresReading,
        waterPrevReading: parsed.waterPrevReading,
        waterPresReading: parsed.waterPresReading,
      })
    }

    return NextResponse.json({
      success: true,
      filename: file.name,
      buildingPrefix,
      matched: results.matched,
      unmatched: results.unmatched,
    })
  } catch (error: any) {
    console.error("Error parsing Excel file:", error)
    return NextResponse.json(
      { error: error.message || "Failed to parse Excel file" },
      { status: 500 }
    )
  }
}

// PUT - Apply the imported balances and readings
export async function PUT(request: NextRequest) {
  try {
    const { tenantId, user } = await requireAuth(await headers())

    const body = await request.json()
    const { balances, billingPeriod } = body as {
      balances: Array<{
        unitNumber: string
        balance: number
        action: "create" | "update" | "skip"
        electricPrevReading?: number | null
        electricPresReading?: number | null
        waterPrevReading?: number | null
        waterPresReading?: number | null
      }>
      billingPeriod?: string // e.g., "2025-11" for November 2025
    }

    if (!balances || !Array.isArray(balances)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      )
    }

    // All items are processed - balances only update if action != skip
    // but readings are always saved/updated
    if (balances.length === 0) {
      return NextResponse.json(
        { error: "No data to process" },
        { status: 400 }
      )
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Get unit IDs
    const unitNumbers = balances.map((b) => b.unitNumber)
    const units = await prisma.unit.findMany({
      where: { tenantId: tenantId, unitNumber: { in: unitNumbers } },
      select: { id: true, unitNumber: true },
    })
    const unitIdMap = new Map(units.map((u) => [u.unitNumber, u.id]))

    // Get existing opening balance bills
    const unitIds = Array.from(unitIdMap.values())
    const existingBills = await prisma.bill.findMany({
      where: {
        tenantId: tenantId,
        unitId: { in: unitIds },
        billType: "OPENING_BALANCE",
      },
    })
    const billMap = new Map(existingBills.map((b) => [b.unitId, b]))

    const results = {
      created: 0,
      updated: 0,
      readingsCreated: 0,
      errors: [] as string[],
    }
    const now = new Date()

    // Parse billing period or use current date
    const billingDate = billingPeriod
      ? new Date(`${billingPeriod}-01`)
      : now

    for (const entry of balances) {
      const unitId = unitIdMap.get(entry.unitNumber)
      if (!unitId) {
        results.errors.push(`Unit ${entry.unitNumber} not found`)
        continue
      }

      // Only update balances if action is not "skip"
      if (entry.action !== "skip") {
        const existingBill = billMap.get(unitId)

        if (existingBill) {
          // Update existing
          await prisma.bill.update({
            where: { id: existingBill.id },
            data: {
              otherCharges: entry.balance,
              totalAmount: entry.balance,
              balance: entry.balance - Number(existingBill.paidAmount),
              updatedAt: now,
            },
          })
          results.updated++
        } else {
          // Create new
          await prisma.bill.create({
            data: {
              tenantId,
              unitId,
              billNumber: `OB-${entry.unitNumber}`,
              billType: "OPENING_BALANCE",
              billingMonth: now,
              billingPeriodStart: now,
              billingPeriodEnd: now,
              statementDate: now,
              dueDate: now,
              electricAmount: 0,
              waterAmount: 0,
              associationDues: 0,
              penaltyAmount: 0,
              otherCharges: entry.balance,
              totalAmount: entry.balance,
              paidAmount: 0,
              balance: entry.balance,
              status: "UNPAID",
              generatedBy: user?.id,
              remarks: "Opening Balance (imported from Excel)",
            },
          })
          results.created++
        }
      }

      // Create or update meter readings if provided
      if (entry.electricPrevReading != null && entry.electricPresReading != null) {
        const existingElectric = await prisma.electricReading.findFirst({
          where: {
            unitId,
            billingPeriod: billingDate,
          },
        })

        if (existingElectric) {
          // Update existing reading
          await prisma.electricReading.update({
            where: { id: existingElectric.id },
            data: {
              previousReading: entry.electricPrevReading,
              presentReading: entry.electricPresReading,
              consumption: entry.electricPresReading - entry.electricPrevReading,
              readBy: user?.id,
              remarks: "Updated from Excel SOA import",
            },
          })
          results.readingsCreated++
        } else {
          // Create new reading
          await prisma.electricReading.create({
            data: {
              unitId,
              readingDate: billingDate,
              billingPeriod: billingDate,
              previousReading: entry.electricPrevReading,
              presentReading: entry.electricPresReading,
              consumption: entry.electricPresReading - entry.electricPrevReading,
              readBy: user?.id,
              remarks: "Imported from Excel SOA",
            },
          })
          results.readingsCreated++
        }
      }

      if (entry.waterPrevReading != null && entry.waterPresReading != null) {
        const existingWater = await prisma.waterReading.findFirst({
          where: {
            unitId,
            billingPeriod: billingDate,
          },
        })

        if (existingWater) {
          // Update existing reading
          await prisma.waterReading.update({
            where: { id: existingWater.id },
            data: {
              previousReading: entry.waterPrevReading,
              presentReading: entry.waterPresReading,
              consumption: entry.waterPresReading - entry.waterPrevReading,
              readBy: user?.id,
              remarks: "Updated from Excel SOA import",
            },
          })
          results.readingsCreated++
        } else {
          // Create new reading
          await prisma.waterReading.create({
            data: {
              unitId,
              readingDate: billingDate,
              billingPeriod: billingDate,
              previousReading: entry.waterPrevReading,
              presentReading: entry.waterPresReading,
              consumption: entry.waterPresReading - entry.waterPrevReading,
              readBy: user?.id,
              remarks: "Imported from Excel SOA",
            },
          })
          results.readingsCreated++
        }
      }
    }

    return NextResponse.json({
      success: true,
      created: results.created,
      updated: results.updated,
      readingsCreated: results.readingsCreated,
      errors: results.errors,
    })
  } catch (error: any) {
    console.error("Error applying balances:", error)
    return NextResponse.json(
      { error: error.message || "Failed to apply balances" },
      { status: 500 }
    )
  }
}
