import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Get a single SOA document with full data (for viewing/printing)
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

    const document = await prisma.sOADocument.findFirst({
      where: {
        id,
        batch: {
          tenantId
        }
      },
      include: {
        batch: {
          select: {
            batchNumber: true,
            asOfDate: true,
            status: true,
            distributedAt: true
          }
        }
      }
    })

    if (!document) {
      return NextResponse.json(
        { error: "SOA document not found" },
        { status: 404 }
      )
    }

    // Parse the stored SOA data
    const soaData = JSON.parse(document.soaData)

    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        batchNumber: document.batch.batchNumber,
        asOfDate: document.batch.asOfDate,
        batchStatus: document.batch.status,
        distributedAt: document.batch.distributedAt,
        unitNumber: document.unitNumber,
        ownerName: document.ownerName,
        floorLevel: document.floorLevel,
        summary: {
          totalBilled: Number(document.totalBilled),
          totalPaid: Number(document.totalPaid),
          currentBalance: Number(document.currentBalance)
        },
        aging: {
          current: Number(document.current),
          days31to60: Number(document.days31to60),
          days61to90: Number(document.days61to90),
          over90days: Number(document.over90days)
        },
        // Full SOA data for detailed view/print
        soaData,
        createdAt: document.createdAt
      }
    })
  } catch (error: any) {
    console.error("Error getting SOA document:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get SOA document" },
      { status: 500 }
    )
  }
}
