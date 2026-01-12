import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Get a single SOA batch with its documents
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireAuth(await headers())
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
          orderBy: [
            { floorLevel: "asc" },
            { unitNumber: "asc" }
          ]
        }
      }
    })

    if (!batch) {
      return NextResponse.json(
        { error: "SOA batch not found" },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      batch: {
        id: batch.id,
        batchNumber: batch.batchNumber,
        asOfDate: batch.asOfDate,
        billingMonth: batch.billingMonth,
        filterType: batch.filterType,
        filterValue: batch.filterValue,
        status: batch.status,
        distributedAt: batch.distributedAt,
        distributedBy: batch.distributedBy,
        totalUnits: batch.totalUnits,
        totalAmount: Number(batch.totalAmount),
        totalBalance: Number(batch.totalBalance),
        generatedBy: batch.generatedBy,
        remarks: batch.remarks,
        createdAt: batch.createdAt,
        documents: batch.documents.map(doc => ({
          id: doc.id,
          unitId: doc.unitId,
          unitNumber: doc.unitNumber,
          ownerName: doc.ownerName,
          floorLevel: doc.floorLevel,
          totalBilled: Number(doc.totalBilled),
          totalPaid: Number(doc.totalPaid),
          currentBalance: Number(doc.currentBalance),
          aging: {
            current: Number(doc.current),
            days31to60: Number(doc.days31to60),
            days61to90: Number(doc.days61to90),
            over90days: Number(doc.over90days)
          },
          createdAt: doc.createdAt
        }))
      }
    })
  } catch (error: any) {
    console.error("Error getting SOA batch:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get SOA batch" },
      { status: 500 }
    )
  }
}

/**
 * DELETE - Cancel/delete an SOA batch (only if not distributed)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireAuth(await headers())
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
        { error: "Cannot delete a distributed SOA batch. Bills are already locked." },
        { status: 400 }
      )
    }

    // Delete the batch (cascade deletes documents)
    await prisma.sOABatch.delete({
      where: { id }
    })

    return NextResponse.json({
      success: true,
      message: "SOA batch deleted successfully"
    })
  } catch (error: any) {
    console.error("Error deleting SOA batch:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete SOA batch" },
      { status: 500 }
    )
  }
}
