import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - Fetch all units with their existing opening balance (if any)
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(request.url)
    const floor = searchParams.get("floor")

    // Get all units with owner info
    const units = await prisma.unit.findMany({
      where: {
        tenantId: tenantId,
        isActive: true,
        ...(floor && { floorLevel: floor }),
      },
      include: {
        owner: true,
      },
      orderBy: [{ floorLevel: "asc" }, { unitNumber: "asc" }],
    })

    // Get existing opening balance bills for these units
    const unitIds = units.map((u) => u.id)
    const openingBalances = await prisma.bill.findMany({
      where: {
        unitId: { in: unitIds },
        billType: "OPENING_BALANCE",
      },
    })

    // Create a map for quick lookup
    const balanceMap = new Map(openingBalances.map((b) => [b.unitId, b]))

    // Combine units with their opening balance
    const result = units.map((unit) => {
      const ob = balanceMap.get(unit.id)
      return {
        id: unit.id,
        unitNumber: unit.unitNumber,
        floorLevel: unit.floorLevel,
        lastName: unit.owner?.lastName || '',
        firstName: unit.owner?.firstName || '',
        middleName: unit.owner?.middleName || '',
        openingBalance: ob ? Number(ob.totalAmount) : null,
        openingBalanceBillId: ob?.id || null,
        status: ob ? "saved" : "new",
      }
    })

    return NextResponse.json(result)
  } catch (error: any) {
    console.error("Error fetching opening balances:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch opening balances" },
      { status: 500 }
    )
  }
}

// POST - Save opening balances (create or update)
export async function POST(request: NextRequest) {
  try {
    const { tenantId, user } = await requireAuth(await headers())

    const body = await request.json()
    const { balances } = body as {
      balances: Array<{ unitId: string; amount: number; remarks?: string }>
    }

    if (!balances || !Array.isArray(balances)) {
      return NextResponse.json(
        { error: "Invalid request body - expected balances array" },
        { status: 400 }
      )
    }

    // Filter out entries with no amount or zero amount
    const validBalances = balances.filter((b) => b.amount && b.amount > 0)

    if (validBalances.length === 0) {
      return NextResponse.json(
        { error: "No valid balances to save" },
        { status: 400 }
      )
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Get unit info for bill numbers
    const unitIds = validBalances.map((b) => b.unitId)
    const units = await prisma.unit.findMany({
      where: { id: { in: unitIds }, tenantId: tenantId },
      select: { id: true, unitNumber: true },
    })
    const unitMap = new Map(units.map((u) => [u.id, u.unitNumber]))

    // Check for existing opening balance bills
    const existingBills = await prisma.bill.findMany({
      where: {
        unitId: { in: unitIds },
        billType: "OPENING_BALANCE",
      },
    })
    const existingMap = new Map(existingBills.map((b) => [b.unitId, b]))

    const results = { created: 0, updated: 0, errors: [] as string[] }

    // Process each balance
    for (const entry of validBalances) {
      const { unitId, amount, remarks } = entry
      const unitNumber = unitMap.get(unitId)

      if (!unitNumber) {
        results.errors.push(`Unit ${unitId} not found`)
        continue
      }

      const existing = existingMap.get(unitId)
      const now = new Date()

      if (existing) {
        // Update existing opening balance
        const paidAmount = Number(existing.paidAmount)
        const newBalance = Math.max(0, amount - paidAmount)
        // Recalculate status based on new balance
        const newStatus =
          newBalance <= 0.01
            ? "PAID"
            : paidAmount > 0
            ? "PARTIAL"
            : "UNPAID"

        await prisma.bill.update({
          where: { id: existing.id },
          data: {
            totalAmount: amount,
            balance: newBalance,
            status: newStatus,
            remarks: remarks || existing.remarks,
            updatedAt: now,
          },
        })
        results.updated++
      } else {
        // Create new opening balance bill
        const billNumber = `OB-${unitNumber}`

        await prisma.bill.create({
          data: {
            tenantId,
            unitId,
            billNumber,
            billType: "OPENING_BALANCE",
            billingMonth: now,
            billingPeriodStart: now,
            billingPeriodEnd: now,
            statementDate: now,
            dueDate: now,
            // Put entire amount in "otherCharges" for opening balance
            electricAmount: 0,
            waterAmount: 0,
            associationDues: 0,
            penaltyAmount: 0,
            otherCharges: amount,
            totalAmount: amount,
            paidAmount: 0,
            balance: amount,
            status: "UNPAID",
            generatedBy: user?.id,
            remarks: remarks || "Opening Balance",
          },
        })
        results.created++
      }
    }

    return NextResponse.json({
      success: true,
      created: results.created,
      updated: results.updated,
      errors: results.errors,
    })
  } catch (error: any) {
    console.error("Error saving opening balances:", error)
    return NextResponse.json(
      { error: error.message || "Failed to save opening balances" },
      { status: 500 }
    )
  }
}
