import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Consumption Report
 * Electric and water usage analysis
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
    const type = searchParams.get("type") || "electric" // electric or water
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString())
    const floorFilter = searchParams.get("floor") || ""

    const startOfYear = new Date(Date.UTC(year, 0, 1))
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

    // Build unit filter
    const unitFilter: any = { tenantId, isActive: true }
    if (floorFilter) unitFilter.floorLevel = floorFilter

    // Get readings based on type
    const readings = type === "electric"
      ? await prisma.electricReading.findMany({
          where: {
            unit: unitFilter,
            billingPeriod: { gte: startOfYear, lte: endOfYear }
          },
          include: {
            unit: {
              select: { unitNumber: true, floorLevel: true, unitType: true }
            }
          },
          orderBy: { billingPeriod: 'asc' }
        })
      : await prisma.waterReading.findMany({
          where: {
            unit: unitFilter,
            billingPeriod: { gte: startOfYear, lte: endOfYear }
          },
          include: {
            unit: {
              select: { unitNumber: true, floorLevel: true, unitType: true }
            }
          },
          orderBy: { billingPeriod: 'asc' }
        })

    // Group by month
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ]

    const monthlyData: Array<{
      month: number
      monthName: string
      totalConsumption: number
      avgConsumption: number
      readingsCount: number
      maxConsumption: number
      minConsumption: number
    }> = []

    for (let month = 0; month < 12; month++) {
      const monthReadings = readings.filter(r => {
        const readingMonth = new Date(r.billingPeriod)
        return readingMonth.getUTCMonth() === month
      })

      const consumptions = monthReadings.map(r => Number(r.consumption))
      const totalConsumption = consumptions.reduce((sum, c) => sum + c, 0)

      monthlyData.push({
        month: month + 1,
        monthName: monthNames[month],
        totalConsumption,
        avgConsumption: monthReadings.length > 0 ? totalConsumption / monthReadings.length : 0,
        readingsCount: monthReadings.length,
        maxConsumption: consumptions.length > 0 ? Math.max(...consumptions) : 0,
        minConsumption: consumptions.length > 0 ? Math.min(...consumptions) : 0
      })
    }

    // Get per-unit consumption summary
    const unitConsumption: Record<string, {
      unitNumber: string
      floorLevel: string
      unitType: string
      totalConsumption: number
      avgConsumption: number
      readingsCount: number
      trend: number // % change from first to last reading
    }> = {}

    for (const reading of readings) {
      const unitId = reading.unitId
      if (!unitConsumption[unitId]) {
        unitConsumption[unitId] = {
          unitNumber: reading.unit.unitNumber,
          floorLevel: reading.unit.floorLevel,
          unitType: reading.unit.unitType,
          totalConsumption: 0,
          avgConsumption: 0,
          readingsCount: 0,
          trend: 0
        }
      }
      unitConsumption[unitId].totalConsumption += Number(reading.consumption)
      unitConsumption[unitId].readingsCount++
    }

    // Calculate averages and trends
    for (const unitId in unitConsumption) {
      const uc = unitConsumption[unitId]
      uc.avgConsumption = uc.readingsCount > 0 ? uc.totalConsumption / uc.readingsCount : 0

      // Calculate trend
      const unitReadings = readings
        .filter(r => r.unitId === unitId)
        .sort((a, b) => new Date(a.billingPeriod).getTime() - new Date(b.billingPeriod).getTime())

      if (unitReadings.length >= 2) {
        const firstConsumption = Number(unitReadings[0].consumption)
        const lastConsumption = Number(unitReadings[unitReadings.length - 1].consumption)
        if (firstConsumption > 0) {
          uc.trend = Math.round(((lastConsumption - firstConsumption) / firstConsumption) * 100)
        }
      }
    }

    // Convert to array and sort
    const unitData = Object.values(unitConsumption).sort((a, b) => {
      const aMatch = a.unitNumber.match(/(\d+F?)-(\d+)/)
      const bMatch = b.unitNumber.match(/(\d+F?)-(\d+)/)
      if (aMatch && bMatch) {
        if (aMatch[1] !== bMatch[1]) {
          return aMatch[1].localeCompare(bMatch[1], undefined, { numeric: true })
        }
        return parseInt(aMatch[2]) - parseInt(bMatch[2])
      }
      return a.unitNumber.localeCompare(b.unitNumber)
    })

    // Top consumers
    const topConsumers = [...unitData]
      .sort((a, b) => b.avgConsumption - a.avgConsumption)
      .slice(0, 10)

    // Anomalies (unusually high consumption)
    const avgOverall = unitData.length > 0
      ? unitData.reduce((sum, u) => sum + u.avgConsumption, 0) / unitData.length
      : 0
    const stdDev = unitData.length > 0
      ? Math.sqrt(unitData.reduce((sum, u) => sum + Math.pow(u.avgConsumption - avgOverall, 2), 0) / unitData.length)
      : 0

    const anomalies = unitData.filter(u => u.avgConsumption > avgOverall + (2 * stdDev))

    // Summary
    const summary = {
      totalConsumption: monthlyData.reduce((sum, m) => sum + m.totalConsumption, 0),
      avgMonthlyConsumption: monthlyData.reduce((sum, m) => sum + m.totalConsumption, 0) / 12,
      avgPerUnit: avgOverall,
      totalReadings: readings.length,
      unitsCount: unitData.length,
      highestMonth: monthlyData.reduce((max, m) => m.totalConsumption > max.totalConsumption ? m : max, monthlyData[0]),
      lowestMonth: monthlyData.reduce((min, m) => m.totalConsumption < min.totalConsumption ? m : min, monthlyData[0])
    }

    return NextResponse.json({
      success: true,
      type,
      year,
      monthlyData,
      unitData,
      topConsumers,
      anomalies,
      summary,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating consumption report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
