import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - AR Aging Report
 * Shows receivables by age buckets: Current (0-30), 31-60, 61-90, 90+ days
 */
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
    const floorFilter = searchParams.get("floor") || ""

    const now = new Date()

    // Get all units with their outstanding bills
    const units = await prisma.unit.findMany({
      where: {
        tenantId,
        isActive: true,
        ...(floorFilter ? { floorLevel: floorFilter } : {})
      },
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true
          }
        },
        bills: {
          where: {
            balance: { gt: 0 },
            status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
          },
          select: {
            id: true,
            billNumber: true,
            billingMonth: true,
            dueDate: true,
            balance: true,
            status: true
          },
          orderBy: {
            dueDate: 'asc'
          }
        }
      },
      orderBy: {
        unitNumber: 'asc'
      }
    })

    // Process units and calculate aging buckets
    const agingData = units
      .filter(unit => unit.bills.length > 0)
      .map(unit => {
        const ownerName = unit.owner
          ? `${unit.owner.lastName}, ${unit.owner.firstName}${unit.owner.middleName ? ' ' + unit.owner.middleName.charAt(0) + '.' : ''}`
          : 'No Owner'

        // Calculate aging buckets
        let current = 0    // 0-30 days
        let days31_60 = 0  // 31-60 days
        let days61_90 = 0  // 61-90 days
        let over90 = 0     // 90+ days

        for (const bill of unit.bills) {
          const dueDate = new Date(bill.dueDate)
          const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          const balance = Number(bill.balance)

          if (daysOverdue <= 30) {
            current += balance
          } else if (daysOverdue <= 60) {
            days31_60 += balance
          } else if (daysOverdue <= 90) {
            days61_90 += balance
          } else {
            over90 += balance
          }
        }

        const totalBalance = current + days31_60 + days61_90 + over90

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          floorLevel: unit.floorLevel,
          ownerName,
          current,
          days31_60,
          days61_90,
          over90,
          totalBalance,
          billsCount: unit.bills.length,
          oldestBill: unit.bills[0]?.billingMonth
        }
      })
      .filter(unit => unit.totalBalance > 0)

    // Sort by unit number (natural sort for format: M1-1F-1, M2-LG-1, M2-2F-1, etc.)
    const floorOrder: Record<string, number> = {
      'LG': 0, 'GF': 1, '1F': 2, '2F': 3, '3F': 4, '4F': 5, '5F': 6, '6F': 7, '7F': 8, '8F': 9, '9F': 10
    }

    agingData.sort((a, b) => {
      // Parse unit number format: Building-Floor-UnitNum (e.g., M1-1F-1, M2-LG-1)
      const aMatch = a.unitNumber.match(/^([A-Z]+\d*)-([A-Z0-9]+)-(\d+)$/i)
      const bMatch = b.unitNumber.match(/^([A-Z]+\d*)-([A-Z0-9]+)-(\d+)$/i)

      if (aMatch && bMatch) {
        // Compare building (M1, M2, etc.)
        const aBldg = aMatch[1].toUpperCase()
        const bBldg = bMatch[1].toUpperCase()
        if (aBldg !== bBldg) {
          return aBldg.localeCompare(bBldg, undefined, { numeric: true })
        }

        // Compare floor (LG, GF, 1F, 2F, etc.)
        const aFloor = aMatch[2].toUpperCase()
        const bFloor = bMatch[2].toUpperCase()
        if (aFloor !== bFloor) {
          const aFloorOrder = floorOrder[aFloor] ?? 999
          const bFloorOrder = floorOrder[bFloor] ?? 999
          if (aFloorOrder !== bFloorOrder) {
            return aFloorOrder - bFloorOrder
          }
          // Fallback to string comparison if not in floorOrder
          return aFloor.localeCompare(bFloor, undefined, { numeric: true })
        }

        // Compare unit number within the floor
        return parseInt(aMatch[3]) - parseInt(bMatch[3])
      }

      // Fallback to natural string sort
      return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true })
    })

    // Group by floor for subtotals
    const byFloor: Record<string, {
      units: typeof agingData,
      subtotals: {
        current: number,
        days31_60: number,
        days61_90: number,
        over90: number,
        totalBalance: number,
        unitsCount: number
      }
    }> = {}

    const floors = ['GF', '2F', '3F', '4F', '5F', '6F']
    for (const floor of floors) {
      const floorUnits = agingData.filter(u => u.floorLevel === floor)
      if (floorUnits.length > 0) {
        byFloor[floor] = {
          units: floorUnits,
          subtotals: {
            current: floorUnits.reduce((sum, u) => sum + u.current, 0),
            days31_60: floorUnits.reduce((sum, u) => sum + u.days31_60, 0),
            days61_90: floorUnits.reduce((sum, u) => sum + u.days61_90, 0),
            over90: floorUnits.reduce((sum, u) => sum + u.over90, 0),
            totalBalance: floorUnits.reduce((sum, u) => sum + u.totalBalance, 0),
            unitsCount: floorUnits.length
          }
        }
      }
    }

    // Grand totals
    const grandTotals = {
      current: agingData.reduce((sum, u) => sum + u.current, 0),
      days31_60: agingData.reduce((sum, u) => sum + u.days31_60, 0),
      days61_90: agingData.reduce((sum, u) => sum + u.days61_90, 0),
      over90: agingData.reduce((sum, u) => sum + u.over90, 0),
      totalBalance: agingData.reduce((sum, u) => sum + u.totalBalance, 0),
      unitsCount: agingData.length
    }

    // Calculate percentages
    const percentages = {
      current: grandTotals.totalBalance > 0 ? (grandTotals.current / grandTotals.totalBalance) * 100 : 0,
      days31_60: grandTotals.totalBalance > 0 ? (grandTotals.days31_60 / grandTotals.totalBalance) * 100 : 0,
      days61_90: grandTotals.totalBalance > 0 ? (grandTotals.days61_90 / grandTotals.totalBalance) * 100 : 0,
      over90: grandTotals.totalBalance > 0 ? (grandTotals.over90 / grandTotals.totalBalance) * 100 : 0
    }

    return NextResponse.json({
      success: true,
      data: agingData,
      byFloor,
      grandTotals,
      percentages,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating aging report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
