import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// DELETE - Void/Delete payment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const { id } = params

    // Get payment with bill allocations
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        billPayments: {
          include: {
            bill: true,
          },
        },
      },
    })

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    if (payment.tenantId !== tenantId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if already voided
    if (payment.status === "CANCELLED") {
      return NextResponse.json({ error: "Payment already voided" }, { status: 400 })
    }

    // Use transaction to ensure all operations succeed or fail together
    await prisma.$transaction(async (tx) => {
      // Update each bill's paid amount and balance
      for (const bp of payment.billPayments) {
        const bill = bp.bill
        const newPaidAmount = Math.max(0, Number(bill.paidAmount) - Number(bp.totalAmount))
        const newBalance = Math.max(0, Number(bill.totalAmount) - newPaidAmount)
        const newStatus =
          newBalance <= 0.01
            ? "PAID"
            : newPaidAmount > 0
            ? "PARTIAL"
            : "UNPAID"

        await tx.bill.update({
          where: { id: bill.id },
          data: {
            paidAmount: newPaidAmount,
            balance: newBalance,
            status: newStatus,
          },
        })
      }

      // Calculate total allocated to bills
      const totalAllocatedToBills = payment.billPayments.reduce(
        (sum, bp) => sum + Number(bp.totalAmount),
        0
      )

      // Calculate advance amounts that need to be reversed
      // Advance = explicit advance amounts + leftover from overpayment
      const explicitAdvanceDues = Number(payment.advanceDuesAmount || 0)
      const explicitAdvanceUtil = Number(payment.advanceUtilAmount || 0)

      // Leftover from overpayment = totalPayment - totalAllocatedToBills - explicitAdvances
      const totalPayment = Number(payment.totalAmount)
      const leftoverFromOverpayment = Math.max(
        0,
        totalPayment - totalAllocatedToBills - explicitAdvanceDues - explicitAdvanceUtil
      )

      // Total advance to reverse = explicit + leftover
      // We'll deduct from advanceDues (simplification since we don't track the split)
      const totalAdvanceToReverse = explicitAdvanceDues + explicitAdvanceUtil + leftoverFromOverpayment

      // Reverse advance balance if any was added
      if (totalAdvanceToReverse > 0) {
        const existingAdvance = await tx.unitAdvanceBalance.findUnique({
          where: {
            tenantId_unitId: {
              tenantId,
              unitId: payment.unitId,
            },
          },
        })

        if (existingAdvance) {
          // Deduct from advance balance, but don't go negative
          const newAdvanceDues = Math.max(
            0,
            Number(existingAdvance.advanceDues) - (explicitAdvanceDues + leftoverFromOverpayment)
          )
          const newAdvanceUtil = Math.max(
            0,
            Number(existingAdvance.advanceUtilities) - explicitAdvanceUtil
          )

          await tx.unitAdvanceBalance.update({
            where: {
              tenantId_unitId: {
                tenantId,
                unitId: payment.unitId,
              },
            },
            data: {
              advanceDues: newAdvanceDues,
              advanceUtilities: newAdvanceUtil,
            },
          })
        }
      }

      // Mark payment as CANCELLED (soft delete for audit trail)
      // Keep BillPayment records for audit purposes
      await tx.payment.update({
        where: { id },
        data: {
          status: "CANCELLED",
          remarks: payment.remarks
            ? `${payment.remarks} | VOIDED`
            : "VOIDED",
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: "Payment voided successfully",
    })
  } catch (error: any) {
    console.error("Error deleting payment:", error)
    return NextResponse.json(
      { error: error.message || "Failed to void payment" },
      { status: 500 }
    )
  }
}
