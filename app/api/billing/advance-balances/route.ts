import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - Fetch all advance balances summary
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const advanceBalances = await prisma.unitAdvanceBalance.findMany({
      where: {
        tenantId,
        OR: [
          { advanceDues: { gt: 0 } },
          { advanceUtilities: { gt: 0 } },
        ],
      },
      include: {
        unit: {
          select: {
            id: true,
            unitNumber: true,
          },
        },
      },
      orderBy: {
        unit: {
          unitNumber: "asc",
        },
      },
    })

    // Calculate totals
    let totalAdvanceDues = 0
    let totalAdvanceUtilities = 0

    const units = advanceBalances.map((balance) => {
      const dues = Number(balance.advanceDues)
      const utilities = Number(balance.advanceUtilities)

      totalAdvanceDues += dues
      totalAdvanceUtilities += utilities

      return {
        unitId: balance.unit.id,
        unitNumber: balance.unit.unitNumber,
        advanceDues: dues,
        advanceUtilities: utilities,
      }
    })

    return NextResponse.json({
      totalUnitsWithAdvance: advanceBalances.length,
      totalAdvanceDues,
      totalAdvanceUtilities,
      units,
    })
  } catch (error: any) {
    console.error("Error fetching advance balances:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch advance balances" },
      { status: 500 }
    )
  }
}
