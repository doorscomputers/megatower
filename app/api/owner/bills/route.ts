import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Get all bills for the logged-in owner's units
 */
export async function GET(request: NextRequest) {
  try {
    const { user } = await requireAuth(await headers())

    const ownerId = user.ownerId
    if (!ownerId) {
      return NextResponse.json(
        { error: "No owner account linked to this user" },
        { status: 400 }
      )
    }

    // Get owner's units
    const owner = await prisma.owner.findUnique({
      where: { id: ownerId },
      include: {
        units: {
          where: { isActive: true },
          select: { id: true },
        },
      },
    })

    if (!owner) {
      return NextResponse.json({ error: "Owner not found" }, { status: 404 })
    }

    const unitIds = owner.units.map((u) => u.id)

    // Get all bills for owner's units
    const bills = await prisma.bill.findMany({
      where: {
        unitId: { in: unitIds },
      },
      include: {
        unit: {
          select: { unitNumber: true, floorLevel: true },
        },
      },
      orderBy: { billingMonth: "desc" },
    })

    return NextResponse.json({
      bills: bills.map((b) => ({
        id: b.id,
        billNumber: b.billNumber,
        billingMonth: b.billingMonth,
        billingPeriodStart: b.billingPeriodStart,
        billingPeriodEnd: b.billingPeriodEnd,
        statementDate: b.statementDate,
        dueDate: b.dueDate,
        electricAmount: Number(b.electricAmount),
        waterAmount: Number(b.waterAmount),
        associationDues: Number(b.associationDues),
        penaltyAmount: Number(b.penaltyAmount),
        otherCharges: Number(b.otherCharges),
        totalAmount: Number(b.totalAmount),
        paidAmount: Number(b.paidAmount),
        balance: Number(b.balance),
        status: b.status,
        unit: b.unit,
      })),
    })
  } catch (error: any) {
    console.error("Error fetching owner bills:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch bills" },
      { status: 500 }
    )
  }
}
