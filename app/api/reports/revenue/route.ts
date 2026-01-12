import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Revenue Report
 * Monthly revenue breakdown and trends
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

    // Get all bills for the year
    const startOfYear = new Date(Date.UTC(year, 0, 1))
    const endOfYear = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))

    const bills = await prisma.bill.findMany({
      where: {
        tenantId,
        billingMonth: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      select: {
        billingMonth: true,
        electricAmount: true,
        waterAmount: true,
        associationDues: true,
        penaltyAmount: true,
        spAssessment: true,
        parkingFee: true,
        otherCharges: true,
        totalAmount: true,
        paidAmount: true
      }
    })

    // Get payments for the year
    const payments = await prisma.payment.findMany({
      where: {
        tenantId,
        status: 'CONFIRMED',
        paymentDate: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      select: {
        paymentDate: true,
        electricAmount: true,
        waterAmount: true,
        duesAmount: true,
        pastDuesAmount: true,
        spAssessmentAmount: true,
        totalAmount: true
      }
    })

    // Group by month
    const monthlyData: Array<{
      month: number
      monthName: string
      billed: {
        electric: number
        water: number
        dues: number
        penalty: number
        spAssessment: number
        parking: number
        other: number
        total: number
      }
      collected: {
        electric: number
        water: number
        dues: number
        penalty: number
        spAssessment: number
        total: number
      }
      collectionRate: number
    }> = []

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ]

    for (let month = 0; month < 12; month++) {
      // Bills for this month
      const monthBills = bills.filter(b => {
        const billMonth = new Date(b.billingMonth)
        return billMonth.getUTCMonth() === month
      })

      const billed = {
        electric: monthBills.reduce((sum, b) => sum + Number(b.electricAmount), 0),
        water: monthBills.reduce((sum, b) => sum + Number(b.waterAmount), 0),
        dues: monthBills.reduce((sum, b) => sum + Number(b.associationDues), 0),
        penalty: monthBills.reduce((sum, b) => sum + Number(b.penaltyAmount), 0),
        spAssessment: monthBills.reduce((sum, b) => sum + Number(b.spAssessment), 0),
        parking: monthBills.reduce((sum, b) => sum + Number(b.parkingFee), 0),
        other: monthBills.reduce((sum, b) => sum + Number(b.otherCharges), 0),
        total: monthBills.reduce((sum, b) => sum + Number(b.totalAmount), 0)
      }

      // Payments for this month
      const monthPayments = payments.filter(p => {
        const payDate = new Date(p.paymentDate)
        return payDate.getMonth() === month
      })

      const collected = {
        electric: monthPayments.reduce((sum, p) => sum + Number(p.electricAmount), 0),
        water: monthPayments.reduce((sum, p) => sum + Number(p.waterAmount), 0),
        dues: monthPayments.reduce((sum, p) => sum + Number(p.duesAmount), 0),
        penalty: monthPayments.reduce((sum, p) => sum + Number(p.pastDuesAmount), 0),
        spAssessment: monthPayments.reduce((sum, p) => sum + Number(p.spAssessmentAmount), 0),
        total: monthPayments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
      }

      const collectionRate = billed.total > 0
        ? Math.round((collected.total / billed.total) * 100)
        : 0

      monthlyData.push({
        month: month + 1,
        monthName: monthNames[month],
        billed,
        collected,
        collectionRate
      })
    }

    // Year-to-date totals
    const ytdBilled = {
      electric: monthlyData.reduce((sum, m) => sum + m.billed.electric, 0),
      water: monthlyData.reduce((sum, m) => sum + m.billed.water, 0),
      dues: monthlyData.reduce((sum, m) => sum + m.billed.dues, 0),
      penalty: monthlyData.reduce((sum, m) => sum + m.billed.penalty, 0),
      spAssessment: monthlyData.reduce((sum, m) => sum + m.billed.spAssessment, 0),
      parking: monthlyData.reduce((sum, m) => sum + m.billed.parking, 0),
      other: monthlyData.reduce((sum, m) => sum + m.billed.other, 0),
      total: monthlyData.reduce((sum, m) => sum + m.billed.total, 0)
    }

    const ytdCollected = {
      electric: monthlyData.reduce((sum, m) => sum + m.collected.electric, 0),
      water: monthlyData.reduce((sum, m) => sum + m.collected.water, 0),
      dues: monthlyData.reduce((sum, m) => sum + m.collected.dues, 0),
      penalty: monthlyData.reduce((sum, m) => sum + m.collected.penalty, 0),
      spAssessment: monthlyData.reduce((sum, m) => sum + m.collected.spAssessment, 0),
      total: monthlyData.reduce((sum, m) => sum + m.collected.total, 0)
    }

    const ytdCollectionRate = ytdBilled.total > 0
      ? Math.round((ytdCollected.total / ytdBilled.total) * 100)
      : 0

    return NextResponse.json({
      success: true,
      year,
      monthlyData,
      ytd: {
        billed: ytdBilled,
        collected: ytdCollected,
        collectionRate: ytdCollectionRate
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating revenue report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
