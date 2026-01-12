import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Get all payments for the logged-in owner's units
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

    // Get all payments for owner's units
    const payments = await prisma.payment.findMany({
      where: {
        unitId: { in: unitIds },
      },
      include: {
        unit: {
          select: { unitNumber: true, floorLevel: true },
        },
        billPayments: {
          include: {
            bill: {
              select: { billNumber: true, billingMonth: true },
            },
          },
        },
      },
      orderBy: { paymentDate: "desc" },
    })

    return NextResponse.json({
      payments: payments.map((p) => ({
        id: p.id,
        orNumber: p.orNumber,
        arNumber: p.arNumber,
        paymentDate: p.paymentDate,
        amount: Number(p.totalAmount),
        paymentMethod: p.paymentMethod,
        referenceNumber: p.referenceNumber,
        checkNumber: p.checkNumber,
        checkDate: p.checkDate,
        bankName: p.bankName,
        status: p.status,
        remarks: p.remarks,
        unit: p.unit,
        appliedToBills: p.billPayments.map((bp) => ({
          billNumber: bp.bill.billNumber,
          billingMonth: bp.bill.billingMonth,
          amount: Number(bp.totalAmount),
        })),
      })),
    })
  } catch (error: any) {
    console.error("Error fetching owner payments:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch payments" },
      { status: 500 }
    )
  }
}
