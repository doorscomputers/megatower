import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Collection Efficiency Trend Report
 * Shows monthly collection efficiency over time
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
    const year = parseInt(searchParams.get("year") || new Date().getFullYear().toString())
    const compareYear = searchParams.get("compareYear") ? parseInt(searchParams.get("compareYear")!) : null

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ]

    // Helper function to get monthly data for a year
    const getYearData = async (targetYear: number) => {
      const monthlyData: Array<{
        month: number
        monthName: string
        totalBilled: number
        totalCollected: number
        efficiency: number
        billCount: number
        paidBillCount: number
        partialBillCount: number
        unpaidBillCount: number
      }> = []

      for (let month = 0; month < 12; month++) {
        const startOfMonth = new Date(Date.UTC(targetYear, month, 1))
        const endOfMonth = new Date(Date.UTC(targetYear, month + 1, 0, 23, 59, 59, 999))

        // Get bills for this month
        const bills = await prisma.bill.findMany({
          where: {
            tenantId,
            billingMonth: { gte: startOfMonth, lte: endOfMonth }
          },
          select: {
            id: true,
            totalAmount: true,
            balance: true,
            status: true
          }
        })

        // Get payments for this month
        const payments = await prisma.payment.findMany({
          where: {
            tenantId,
            status: 'CONFIRMED',
            paymentDate: { gte: startOfMonth, lte: endOfMonth }
          },
          select: {
            totalAmount: true
          }
        })

        const totalBilled = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0)
        const totalCollected = payments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
        const efficiency = totalBilled > 0 ? Math.round((totalCollected / totalBilled) * 100) : 0

        const paidBillCount = bills.filter(b => b.status === 'PAID').length
        const partialBillCount = bills.filter(b => b.status === 'PARTIAL').length
        const unpaidBillCount = bills.filter(b => ['UNPAID', 'PENDING', 'OVERDUE'].includes(b.status)).length

        monthlyData.push({
          month: month + 1,
          monthName: monthNames[month],
          totalBilled,
          totalCollected,
          efficiency,
          billCount: bills.length,
          paidBillCount,
          partialBillCount,
          unpaidBillCount
        })
      }

      return monthlyData
    }

    // Get current year data
    const currentYearData = await getYearData(year)

    // Get comparison year data if requested
    let compareYearData = null
    if (compareYear) {
      compareYearData = await getYearData(compareYear)
    }

    // Calculate yearly totals
    const yearlyTotals = {
      totalBilled: currentYearData.reduce((sum, m) => sum + m.totalBilled, 0),
      totalCollected: currentYearData.reduce((sum, m) => sum + m.totalCollected, 0),
      avgEfficiency: Math.round(
        currentYearData.filter(m => m.totalBilled > 0).reduce((sum, m) => sum + m.efficiency, 0) /
        Math.max(currentYearData.filter(m => m.totalBilled > 0).length, 1)
      ),
      totalBills: currentYearData.reduce((sum, m) => sum + m.billCount, 0),
      totalPaid: currentYearData.reduce((sum, m) => sum + m.paidBillCount, 0),
      totalPartial: currentYearData.reduce((sum, m) => sum + m.partialBillCount, 0),
      totalUnpaid: currentYearData.reduce((sum, m) => sum + m.unpaidBillCount, 0)
    }

    // Find best and worst months
    const monthsWithData = currentYearData.filter(m => m.totalBilled > 0)
    const bestMonth = monthsWithData.length > 0
      ? monthsWithData.reduce((best, m) => m.efficiency > best.efficiency ? m : best, monthsWithData[0])
      : null
    const worstMonth = monthsWithData.length > 0
      ? monthsWithData.reduce((worst, m) => m.efficiency < worst.efficiency ? m : worst, monthsWithData[0])
      : null

    // Calculate trend (comparing first half vs second half)
    const firstHalf = currentYearData.slice(0, 6).filter(m => m.totalBilled > 0)
    const secondHalf = currentYearData.slice(6, 12).filter(m => m.totalBilled > 0)
    const firstHalfAvg = firstHalf.length > 0
      ? firstHalf.reduce((sum, m) => sum + m.efficiency, 0) / firstHalf.length
      : 0
    const secondHalfAvg = secondHalf.length > 0
      ? secondHalf.reduce((sum, m) => sum + m.efficiency, 0) / secondHalf.length
      : 0
    const trend = secondHalfAvg - firstHalfAvg

    return NextResponse.json({
      success: true,
      year,
      monthlyData: currentYearData,
      compareYear: compareYear ? {
        year: compareYear,
        monthlyData: compareYearData
      } : null,
      summary: {
        ...yearlyTotals,
        overallEfficiency: yearlyTotals.totalBilled > 0
          ? Math.round((yearlyTotals.totalCollected / yearlyTotals.totalBilled) * 100)
          : 0,
        bestMonth,
        worstMonth,
        trend: Math.round(trend),
        trendDirection: trend > 0 ? 'improving' : trend < 0 ? 'declining' : 'stable'
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating efficiency trend report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
