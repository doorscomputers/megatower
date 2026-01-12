import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Floor Summary Report
 * Aggregated metrics by floor
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
    const billingMonth = searchParams.get("billingMonth") || ""

    // Get current month if not specified
    const now = new Date()
    let year = now.getFullYear()
    let month = now.getMonth() + 1

    if (billingMonth) {
      const parts = billingMonth.split("-")
      year = parseInt(parts[0])
      month = parseInt(parts[1])
    }

    const billingPeriod = new Date(Date.UTC(year, month - 1, 1))
    const billingMonthLabel = billingPeriod.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

    const floors = ['GF', '2F', '3F', '4F', '5F', '6F']
    const floorSummaries: Record<string, any> = {}

    for (const floor of floors) {
      // Total units on floor
      const totalUnits = await prisma.unit.count({
        where: { tenantId, isActive: true, floorLevel: floor }
      })

      // Bills for this floor this month
      const bills = await prisma.bill.findMany({
        where: {
          tenantId,
          billingMonth: billingPeriod,
          unit: { floorLevel: floor }
        },
        select: {
          totalAmount: true,
          paidAmount: true,
          balance: true,
          status: true,
          electricAmount: true,
          waterAmount: true,
          associationDues: true,
          penaltyAmount: true
        }
      })

      // Calculate totals
      const totalBilled = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0)
      const totalCollected = bills.reduce((sum, b) => sum + Number(b.paidAmount), 0)
      const totalOutstanding = bills.reduce((sum, b) => sum + Number(b.balance), 0)

      // Component breakdown
      const electricBilled = bills.reduce((sum, b) => sum + Number(b.electricAmount), 0)
      const waterBilled = bills.reduce((sum, b) => sum + Number(b.waterAmount), 0)
      const duesBilled = bills.reduce((sum, b) => sum + Number(b.associationDues), 0)
      const penaltyBilled = bills.reduce((sum, b) => sum + Number(b.penaltyAmount), 0)

      // Status counts
      const paidCount = bills.filter(b => b.status === 'PAID').length
      const partialCount = bills.filter(b => b.status === 'PARTIAL').length
      const unpaidCount = bills.filter(b => b.status === 'UNPAID').length
      const overdueCount = bills.filter(b => b.status === 'OVERDUE').length

      // Outstanding balances (across all months)
      const outstandingBills = await prisma.bill.findMany({
        where: {
          tenantId,
          unit: { floorLevel: floor },
          balance: { gt: 0 },
          status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
        },
        select: {
          balance: true
        }
      })

      const totalOutstandingAllMonths = outstandingBills.reduce(
        (sum, b) => sum + Number(b.balance),
        0
      )
      const unitsWithBalance = new Set(
        await prisma.bill.findMany({
          where: {
            tenantId,
            unit: { floorLevel: floor },
            balance: { gt: 0 },
            status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
          },
          select: { unitId: true },
          distinct: ['unitId']
        }).then(bills => bills.map(b => b.unitId))
      ).size

      floorSummaries[floor] = {
        floor,
        totalUnits,
        billsGenerated: bills.length,
        totalBilled,
        totalCollected,
        totalOutstanding,
        collectionEfficiency: totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0,
        components: {
          electric: electricBilled,
          water: waterBilled,
          dues: duesBilled,
          penalty: penaltyBilled
        },
        statusCounts: {
          paid: paidCount,
          partial: partialCount,
          unpaid: unpaidCount,
          overdue: overdueCount
        },
        allMonthsOutstanding: totalOutstandingAllMonths,
        unitsWithBalance
      }
    }

    // Grand totals
    const grandTotals = {
      totalUnits: Object.values(floorSummaries).reduce((sum: number, f: any) => sum + f.totalUnits, 0),
      billsGenerated: Object.values(floorSummaries).reduce((sum: number, f: any) => sum + f.billsGenerated, 0),
      totalBilled: Object.values(floorSummaries).reduce((sum: number, f: any) => sum + f.totalBilled, 0),
      totalCollected: Object.values(floorSummaries).reduce((sum: number, f: any) => sum + f.totalCollected, 0),
      totalOutstanding: Object.values(floorSummaries).reduce((sum: number, f: any) => sum + f.totalOutstanding, 0),
      allMonthsOutstanding: Object.values(floorSummaries).reduce((sum: number, f: any) => sum + f.allMonthsOutstanding, 0),
      unitsWithBalance: Object.values(floorSummaries).reduce((sum: number, f: any) => sum + f.unitsWithBalance, 0),
      collectionEfficiency: 0
    }

    grandTotals.collectionEfficiency = grandTotals.totalBilled > 0
      ? Math.round((grandTotals.totalCollected / grandTotals.totalBilled) * 100)
      : 0

    return NextResponse.json({
      success: true,
      billingMonth: billingMonthLabel,
      billingPeriod: billingPeriod.toISOString(),
      floors: floorSummaries,
      grandTotals,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating floor summary report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
