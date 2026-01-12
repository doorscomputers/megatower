import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

// GET /api/billing/[id] - Get single bill
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const bill = await prisma.bill.findUnique({
      where: {
        id: params.id,
        tenantId,
      },
      include: {
        unit: {
          include: {
            owner: true,
          },
        },
      },
    })

    if (!bill) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    return NextResponse.json(bill)
  } catch (error) {
    console.error("Error fetching bill:", error)
    return NextResponse.json(
      { error: "Failed to fetch bill" },
      { status: 500 }
    )
  }
}

// PUT /api/billing/[id] - Update bill
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const body = await request.json()
    const {
      electricAmount,
      waterAmount,
      associationDues,
      parkingFee,
      spAssessment,
      penaltyAmount,
      otherCharges,
      discounts,
      notes,
    } = body

    // Check if bill exists and belongs to tenant
    const existing = await prisma.bill.findUnique({
      where: {
        id: params.id,
        tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    // Check if bill is locked (distributed via SOA)
    if (existing.isLocked) {
      return NextResponse.json(
        {
          error: "Cannot modify a locked bill. This bill has been distributed to the unit owner. Contact an administrator to unlock it first.",
          isLocked: true,
          lockedAt: existing.lockedAt
        },
        { status: 403 }
      )
    }

    // Calculate new total
    const electric = parseFloat(electricAmount) || 0
    const water = parseFloat(waterAmount) || 0
    const dues = parseFloat(associationDues) || 0
    const parking = parseFloat(parkingFee) || 0
    const sp = parseFloat(spAssessment) || 0
    const penalty = parseFloat(penaltyAmount) || 0
    const other = parseFloat(otherCharges) || 0
    const discount = parseFloat(discounts) || 0

    const newTotal = electric + water + dues + parking + sp + penalty + other - discount
    const newBalance = newTotal - Number(existing.paidAmount)

    // Determine new status based on balance
    let newStatus = existing.status
    if (newBalance <= 0) {
      newStatus = "PAID"
    } else if (Number(existing.paidAmount) > 0) {
      newStatus = "PARTIAL"
    } else {
      newStatus = "UNPAID"
    }

    // Update the bill
    const updatedBill = await prisma.bill.update({
      where: { id: params.id },
      data: {
        electricAmount: electric,
        waterAmount: water,
        associationDues: dues,
        parkingFee: parking,
        spAssessment: sp,
        penaltyAmount: penalty,
        otherCharges: other,
        discounts: discount,
        totalAmount: newTotal,
        balance: newBalance,
        status: newStatus,
        // Add audit note if provided
        ...(notes && { notes }),
      },
      include: {
        unit: {
          include: {
            owner: true,
          },
        },
      },
    })

    return NextResponse.json({
      success: true,
      message: "Bill updated successfully",
      bill: updatedBill,
    })
  } catch (error) {
    console.error("Error updating bill:", error)
    return NextResponse.json(
      { error: "Failed to update bill" },
      { status: 500 }
    )
  }
}

// DELETE /api/billing/[id] - Delete single bill
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireAuth(await headers())

    // Check if bill exists and belongs to tenant
    const existing = await prisma.bill.findUnique({
      where: {
        id: params.id,
        tenantId,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: "Bill not found" }, { status: 404 })
    }

    // Check if bill is locked (distributed via SOA)
    if (existing.isLocked) {
      return NextResponse.json(
        {
          error: "Cannot delete a locked bill. This bill has been distributed to the unit owner. Contact an administrator to unlock it first.",
          isLocked: true,
          lockedAt: existing.lockedAt
        },
        { status: 403 }
      )
    }

    // Check if bill has payments
    if (Number(existing.paidAmount) > 0) {
      return NextResponse.json(
        { error: "Cannot delete bill with recorded payments" },
        { status: 400 }
      )
    }

    // Delete the bill
    await prisma.bill.delete({
      where: { id: params.id },
    })

    return NextResponse.json({
      success: true,
      message: "Bill deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting bill:", error)
    return NextResponse.json(
      { error: "Failed to delete bill" },
      { status: 500 }
    )
  }
}
