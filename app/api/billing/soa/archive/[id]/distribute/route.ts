import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * POST - Distribute an SOA batch (marks as distributed and locks all related bills)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, user } = await requireAuth(await headers())
    const { id } = await params

    if (!tenantId) {
      return NextResponse.json(
        { error: "Tenant not found" },
        { status: 400 }
      )
    }

    const batch = await prisma.sOABatch.findFirst({
      where: {
        id,
        tenantId,
      },
      include: {
        documents: {
          include: {
            bills: {
              select: { id: true }
            }
          }
        }
      }
    })

    if (!batch) {
      return NextResponse.json(
        { error: "SOA batch not found" },
        { status: 404 }
      )
    }

    if (batch.status === "DISTRIBUTED") {
      return NextResponse.json(
        { error: "This SOA batch has already been distributed" },
        { status: 400 }
      )
    }

    if (batch.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Cannot distribute a cancelled SOA batch" },
        { status: 400 }
      )
    }

    // Collect all bill IDs from all documents
    const billIds: string[] = []
    for (const doc of batch.documents) {
      for (const bill of doc.bills) {
        if (!billIds.includes(bill.id)) {
          billIds.push(bill.id)
        }
      }
    }

    const now = new Date()

    // Transaction: update batch status and lock all bills
    await prisma.$transaction(async (tx) => {
      // Update batch status
      await tx.sOABatch.update({
        where: { id },
        data: {
          status: "DISTRIBUTED",
          distributedAt: now,
          distributedBy: user?.id || "system"
        }
      })

      // Lock all related bills
      if (billIds.length > 0) {
        await tx.bill.updateMany({
          where: {
            id: { in: billIds }
          },
          data: {
            isLocked: true,
            lockedAt: now,
            lockedBy: user?.id || "system"
          }
        })
      }

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          userId: user?.id,
          action: "DISTRIBUTE",
          entity: "SOABatch",
          entityId: id,
          newValues: JSON.stringify({
            batchNumber: batch.batchNumber,
            billsLocked: billIds.length,
            distributedAt: now.toISOString()
          })
        }
      })
    })

    return NextResponse.json({
      success: true,
      message: `SOA batch distributed successfully. ${billIds.length} bills have been locked.`,
      billsLocked: billIds.length,
      distributedAt: now.toISOString()
    })
  } catch (error: any) {
    console.error("Error distributing SOA batch:", error)
    return NextResponse.json(
      { error: error.message || "Failed to distribute SOA batch" },
      { status: 500 }
    )
  }
}
