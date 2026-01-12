import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * DELETE - Delete all bills for a billing period
 * SAFETY: Only allows deletion if NO payments have been recorded
 */
export async function POST(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const body = await request.json()
    const { billingMonth } = body

    if (!billingMonth) {
      return NextResponse.json(
        { error: "Billing month is required" },
        { status: 400 }
      )
    }

    // Parse billing period - use UTC to match database dates
    const [year, month] = billingMonth.split("-").map(Number)
    const billingPeriod = new Date(Date.UTC(year, month - 1, 1))
    if (isNaN(billingPeriod.getTime())) {
      return NextResponse.json(
        { error: "Invalid billing month format" },
        { status: 400 }
      )
    }

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    // Find all bills for this period
    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        billingMonth: billingPeriod,
      },
      include: {
        payments: true,
      },
    })

    if (bills.length === 0) {
      return NextResponse.json(
        { error: `No bills found for ${billingMonth}` },
        { status: 404 }
      )
    }

    // SAFETY CHECK: Prevent deletion if ANY bills are locked (distributed via SOA)
    const lockedBills = bills.filter((bill) => bill.isLocked)

    if (lockedBills.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete bills for ${billingMonth}. ${lockedBills.length} bill(s) are locked because they have been distributed to unit owners. Contact an administrator to unlock them first.`,
          lockedBills: lockedBills.map((b) => ({
            billNumber: b.billNumber,
            lockedAt: b.lockedAt,
          })),
        },
        { status: 403 }
      )
    }

    // SAFETY CHECK: Prevent deletion if ANY payments exist
    const billsWithPayments = bills.filter((bill) => bill.payments.length > 0)

    if (billsWithPayments.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete bills for ${billingMonth}. ${billsWithPayments.length} bill(s) have recorded payments. Please void/delete payments first.`,
          billsWithPayments: billsWithPayments.map((b) => ({
            billNumber: b.billNumber,
            unitId: b.unitId,
            paymentsCount: b.payments.length,
            paidAmount: b.paidAmount,
          })),
        },
        { status: 400 }
      )
    }

    // SAFETY CHECK: Double-check paidAmount is zero
    const billsWithPaidAmount = bills.filter((bill) => Number(bill.paidAmount) > 0)

    if (billsWithPaidAmount.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete bills for ${billingMonth}. ${billsWithPaidAmount.length} bill(s) have paid amounts recorded.`,
          billsWithPaidAmount: billsWithPaidAmount.map((b) => ({
            billNumber: b.billNumber,
            unitId: b.unitId,
            paidAmount: b.paidAmount,
          })),
        },
        { status: 400 }
      )
    }

    // Safe to delete - no payments recorded
    const deleteResult = await prisma.bill.deleteMany({
      where: {
        tenantId,
        billingMonth: billingPeriod,
      },
    })

    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${deleteResult.count} bill(s) for ${billingMonth}`,
      deletedCount: deleteResult.count,
      billingMonth,
    })
  } catch (error: any) {
    console.error("Error deleting bills:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete bills" },
      { status: 500 }
    )
  }
}
