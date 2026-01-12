import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Outstanding Balances Report
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
    const sortBy = searchParams.get("sortBy") || "unit" // unit, balance, oldest
    const showAll = searchParams.get("showAll") === "true"

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
          where: showAll
            ? {}
            : {
                balance: { gt: 0 },
                status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
              },
          select: {
            id: true,
            billNumber: true,
            billingMonth: true,
            dueDate: true,
            electricAmount: true,
            waterAmount: true,
            associationDues: true,
            penaltyAmount: true,
            spAssessment: true,
            parkingFee: true,
            otherCharges: true,
            discounts: true,
            totalAmount: true,
            paidAmount: true,
            balance: true,
            status: true
          },
          orderBy: {
            billingMonth: 'asc'
          }
        }
      },
      orderBy: {
        unitNumber: 'asc'
      }
    })

    // Process units and aggregate balances
    const unitBalances = units
      .map(unit => {
        const ownerName = unit.owner
          ? `${unit.owner.lastName}, ${unit.owner.firstName}${unit.owner.middleName ? ' ' + unit.owner.middleName.charAt(0) + '.' : ''}`
          : 'No Owner'

        // Aggregate outstanding amounts across all bills
        let totalElectric = 0
        let totalWater = 0
        let totalDues = 0
        let totalPenalty = 0
        let totalSpAssessment = 0
        let totalParking = 0
        let totalOther = 0
        let totalBalance = 0
        let oldestDueDate: Date | null = null

        for (const bill of unit.bills) {
          if (Number(bill.balance) > 0) {
            // Calculate proportional outstanding for each component
            const billTotal = Number(bill.electricAmount) + Number(bill.waterAmount) +
                              Number(bill.associationDues) + Number(bill.penaltyAmount) +
                              Number(bill.spAssessment) + Number(bill.parkingFee) +
                              Number(bill.otherCharges) - Number(bill.discounts)

            if (billTotal > 0) {
              const ratio = Number(bill.balance) / billTotal
              totalElectric += Number(bill.electricAmount) * ratio
              totalWater += Number(bill.waterAmount) * ratio
              totalDues += Number(bill.associationDues) * ratio
              totalPenalty += Number(bill.penaltyAmount) * ratio
              totalSpAssessment += Number(bill.spAssessment) * ratio
              totalParking += Number(bill.parkingFee) * ratio
              totalOther += Number(bill.otherCharges) * ratio
            }

            totalBalance += Number(bill.balance)

            // Track oldest due date
            if (!oldestDueDate || new Date(bill.dueDate) < oldestDueDate) {
              oldestDueDate = new Date(bill.dueDate)
            }
          }
        }

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          floorLevel: unit.floorLevel,
          ownerName,
          area: Number(unit.area),
          unitType: unit.unitType,
          electric: totalElectric,
          water: totalWater,
          dues: totalDues,
          penalty: totalPenalty,
          spAssessment: totalSpAssessment,
          parking: totalParking,
          other: totalOther,
          totalBalance,
          oldestDueDate: oldestDueDate?.toISOString() || null,
          billsCount: unit.bills.filter(b => Number(b.balance) > 0).length,
          bills: unit.bills.filter(b => Number(b.balance) > 0)
        }
      })
      .filter(unit => showAll || unit.totalBalance > 0)

    // Floor order for sorting
    const floorOrder: Record<string, number> = {
      'LG': 0, 'GF': 1, '1F': 2, '2F': 3, '3F': 4, '4F': 5, '5F': 6, '6F': 7, '7F': 8, '8F': 9, '9F': 10
    }

    // Sort based on sortBy parameter
    switch (sortBy) {
      case 'balance':
        unitBalances.sort((a, b) => b.totalBalance - a.totalBalance)
        break
      case 'oldest':
        unitBalances.sort((a, b) => {
          if (!a.oldestDueDate) return 1
          if (!b.oldestDueDate) return -1
          return new Date(a.oldestDueDate).getTime() - new Date(b.oldestDueDate).getTime()
        })
        break
      default: // 'unit'
        // Natural sort by unit number (format: M1-1F-1, M2-LG-1, M2-2F-1, etc.)
        unitBalances.sort((a, b) => {
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
              return aFloor.localeCompare(bFloor, undefined, { numeric: true })
            }

            // Compare unit number within the floor
            return parseInt(aMatch[3]) - parseInt(bMatch[3])
          }

          return a.unitNumber.localeCompare(b.unitNumber, undefined, { numeric: true })
        })
    }

    // Group by floor for subtotals
    const byFloor: Record<string, {
      units: typeof unitBalances,
      subtotals: {
        electric: number,
        water: number,
        dues: number,
        penalty: number,
        spAssessment: number,
        parking: number,
        other: number,
        totalBalance: number,
        unitsCount: number
      }
    }> = {}

    const floors = ['GF', '2F', '3F', '4F', '5F', '6F']
    for (const floor of floors) {
      const floorUnits = unitBalances.filter(u => u.floorLevel === floor)
      if (floorUnits.length > 0 || showAll) {
        byFloor[floor] = {
          units: floorUnits,
          subtotals: {
            electric: floorUnits.reduce((sum, u) => sum + u.electric, 0),
            water: floorUnits.reduce((sum, u) => sum + u.water, 0),
            dues: floorUnits.reduce((sum, u) => sum + u.dues, 0),
            penalty: floorUnits.reduce((sum, u) => sum + u.penalty, 0),
            spAssessment: floorUnits.reduce((sum, u) => sum + u.spAssessment, 0),
            parking: floorUnits.reduce((sum, u) => sum + u.parking, 0),
            other: floorUnits.reduce((sum, u) => sum + u.other, 0),
            totalBalance: floorUnits.reduce((sum, u) => sum + u.totalBalance, 0),
            unitsCount: floorUnits.length
          }
        }
      }
    }

    // Grand totals
    const grandTotals = {
      electric: unitBalances.reduce((sum, u) => sum + u.electric, 0),
      water: unitBalances.reduce((sum, u) => sum + u.water, 0),
      dues: unitBalances.reduce((sum, u) => sum + u.dues, 0),
      penalty: unitBalances.reduce((sum, u) => sum + u.penalty, 0),
      spAssessment: unitBalances.reduce((sum, u) => sum + u.spAssessment, 0),
      parking: unitBalances.reduce((sum, u) => sum + u.parking, 0),
      other: unitBalances.reduce((sum, u) => sum + u.other, 0),
      totalBalance: unitBalances.reduce((sum, u) => sum + u.totalBalance, 0),
      unitsCount: unitBalances.length
    }

    return NextResponse.json({
      success: true,
      data: unitBalances,
      byFloor,
      grandTotals,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating outstanding balances report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
