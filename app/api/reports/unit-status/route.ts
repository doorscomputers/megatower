import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Unit Status Report
 * Complete status of all units including occupancy, payments, balance
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

    // Get all units with comprehensive data
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
            phone: true,
            email: true
          }
        },
        bills: {
          where: {
            status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE', 'PAID'] }
          },
          orderBy: { billingMonth: 'desc' },
          take: 12,
          select: {
            id: true,
            billingMonth: true,
            totalAmount: true,
            paidAmount: true,
            balance: true,
            status: true,
            dueDate: true
          }
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 1,
          select: {
            paymentDate: true,
            totalAmount: true
          }
        },
        electricReadings: {
          orderBy: { billingPeriod: 'desc' },
          take: 1,
          select: {
            presentReading: true,
            previousReading: true,
            consumption: true,
            billingPeriod: true
          }
        },
        waterReadings: {
          orderBy: { billingPeriod: 'desc' },
          take: 1,
          select: {
            presentReading: true,
            previousReading: true,
            consumption: true,
            billingPeriod: true
          }
        },
        advanceBalance: {
          select: {
            advanceDues: true,
            advanceUtilities: true
          }
        }
      },
      orderBy: { unitNumber: 'asc' }
    })

    // Process units
    const unitStatuses = units.map(unit => {
      const ownerName = unit.owner
        ? `${unit.owner.lastName}, ${unit.owner.firstName}`
        : 'No Owner'

      // Calculate total outstanding
      const totalOutstanding = unit.bills
        .filter(b => Number(b.balance) > 0)
        .reduce((sum, b) => sum + Number(b.balance), 0)

      // Calculate total paid this year
      const currentYear = new Date().getFullYear()
      const paidThisYear = unit.bills
        .filter(b => new Date(b.billingMonth).getFullYear() === currentYear && b.status === 'PAID')
        .reduce((sum, b) => sum + Number(b.totalAmount), 0)

      // Get last 12 months payment status
      const paymentRecord = unit.bills.slice(0, 12).map(b => ({
        month: new Date(b.billingMonth).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        status: b.status,
        onTime: b.status === 'PAID' && Number(b.balance) === 0
      }))

      // Calculate payment reliability score (paid on time / total bills)
      const paidOnTime = unit.bills.filter(b => b.status === 'PAID').length
      const totalBills = unit.bills.length
      const reliabilityScore = totalBills > 0 ? Math.round((paidOnTime / totalBills) * 100) : 0

      // Overdue count
      const overdueCount = unit.bills.filter(b => b.status === 'OVERDUE').length

      // Last payment
      const lastPayment = unit.payments[0]

      // Latest readings
      const lastElectric = unit.electricReadings[0]
      const lastWater = unit.waterReadings[0]

      // Advance balance
      const advanceDues = unit.advanceBalance ? Number(unit.advanceBalance.advanceDues) : 0
      const advanceUtilities = unit.advanceBalance ? Number(unit.advanceBalance.advanceUtilities) : 0

      // Determine overall status
      let overallStatus: 'good' | 'warning' | 'critical' = 'good'
      if (overdueCount >= 3 || totalOutstanding > 50000) {
        overallStatus = 'critical'
      } else if (overdueCount > 0 || totalOutstanding > 10000) {
        overallStatus = 'warning'
      }

      return {
        unitId: unit.id,
        unitNumber: unit.unitNumber,
        floorLevel: unit.floorLevel,
        unitType: unit.unitType,
        area: Number(unit.area),
        occupancyStatus: unit.occupancyStatus,
        ownerName,
        ownerPhone: unit.owner?.phone || null,
        ownerEmail: unit.owner?.email || null,
        totalOutstanding,
        paidThisYear,
        reliabilityScore,
        overdueCount,
        lastPaymentDate: lastPayment?.paymentDate?.toISOString() || null,
        lastPaymentAmount: lastPayment ? Number(lastPayment.totalAmount) : null,
        lastElectricConsumption: lastElectric ? Number(lastElectric.consumption) : null,
        lastWaterConsumption: lastWater ? Number(lastWater.consumption) : null,
        advanceDues,
        advanceUtilities,
        paymentRecord,
        overallStatus
      }
    })

    // Floor order for sorting
    const floorOrder: Record<string, number> = {
      'LG': 0, 'GF': 1, '1F': 2, '2F': 3, '3F': 4, '4F': 5, '5F': 6, '6F': 7, '7F': 8, '8F': 9, '9F': 10
    }

    // Sort by unit number (natural sort for format: M1-1F-1, M2-LG-1, M2-2F-1, etc.)
    unitStatuses.sort((a, b) => {
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

    // Summary statistics
    const summary = {
      totalUnits: unitStatuses.length,
      occupancy: {
        occupied: unitStatuses.filter(u => u.occupancyStatus === 'OCCUPIED').length,
        vacant: unitStatuses.filter(u => u.occupancyStatus === 'VACANT').length,
        ownerOccupied: unitStatuses.filter(u => u.occupancyStatus === 'OWNER_OCCUPIED').length,
        rented: unitStatuses.filter(u => u.occupancyStatus === 'RENTED').length
      },
      unitType: {
        residential: unitStatuses.filter(u => u.unitType === 'RESIDENTIAL').length,
        commercial: unitStatuses.filter(u => u.unitType === 'COMMERCIAL').length
      },
      status: {
        good: unitStatuses.filter(u => u.overallStatus === 'good').length,
        warning: unitStatuses.filter(u => u.overallStatus === 'warning').length,
        critical: unitStatuses.filter(u => u.overallStatus === 'critical').length
      },
      totalOutstanding: unitStatuses.reduce((sum, u) => sum + u.totalOutstanding, 0),
      avgReliabilityScore: unitStatuses.length > 0
        ? Math.round(unitStatuses.reduce((sum, u) => sum + u.reliabilityScore, 0) / unitStatuses.length)
        : 0
    }

    return NextResponse.json({
      success: true,
      data: unitStatuses,
      summary,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating unit status report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
