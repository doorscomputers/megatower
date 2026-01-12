import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Payment History Report
 * Detailed payment records with filtering
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
    const startDate = searchParams.get("startDate")
    const endDate = searchParams.get("endDate")
    const floorFilter = searchParams.get("floor") || ""
    const methodFilter = searchParams.get("method") || ""
    const page = parseInt(searchParams.get("page") || "1")
    const limit = parseInt(searchParams.get("limit") || "100")

    // Build date filter
    const now = new Date()
    const start = startDate
      ? new Date(startDate)
      : new Date(now.getFullYear(), now.getMonth(), 1)
    start.setHours(0, 0, 0, 0)

    const end = endDate
      ? new Date(endDate)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)

    // Build filter
    const where: any = {
      tenantId,
      status: 'CONFIRMED',
      paymentDate: { gte: start, lte: end }
    }

    if (floorFilter) {
      where.unit = { floorLevel: floorFilter }
    }

    if (methodFilter) {
      where.paymentMethod = methodFilter
    }

    // Get payments with pagination
    const [payments, totalCount] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          unit: {
            select: { unitNumber: true, floorLevel: true }
          },
          billPayments: {
            include: {
              bill: {
                select: { billNumber: true, billingMonth: true }
              }
            }
          }
        },
        orderBy: { paymentDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.payment.count({ where })
    ])

    // Process payments
    const paymentData = payments.map(p => ({
      id: p.id,
      orNumber: p.orNumber,
      arNumber: p.arNumber,
      paymentDate: p.paymentDate.toISOString(),
      unitNumber: p.unit?.unitNumber || 'N/A',
      floorLevel: p.unit?.floorLevel || 'N/A',
      paymentMethod: p.paymentMethod,
      checkNumber: p.checkNumber,
      bankName: p.bankName,
      referenceNumber: p.referenceNumber,
      electric: Number(p.electricAmount),
      water: Number(p.waterAmount),
      dues: Number(p.duesAmount),
      penalty: Number(p.pastDuesAmount),
      spAssessment: Number(p.spAssessmentAmount),
      advance: Number(p.advanceDuesAmount) + Number(p.advanceUtilAmount),
      totalAmount: Number(p.totalAmount),
      appliedTo: p.billPayments.map(bp => ({
        billNumber: bp.bill.billNumber,
        billingMonth: bp.bill.billingMonth
      })),
      remarks: p.remarks
    }))

    // Summary by method
    const allPayments = await prisma.payment.findMany({
      where: {
        tenantId,
        status: 'CONFIRMED',
        paymentDate: { gte: start, lte: end }
      },
      select: {
        paymentMethod: true,
        totalAmount: true,
        electricAmount: true,
        waterAmount: true,
        duesAmount: true,
        pastDuesAmount: true,
        spAssessmentAmount: true
      }
    })

    const byMethod: Record<string, { count: number, total: number }> = {}
    let totalElectric = 0, totalWater = 0, totalDues = 0, totalPenalty = 0, totalSP = 0

    for (const p of allPayments) {
      const method = p.paymentMethod || 'CASH'
      if (!byMethod[method]) {
        byMethod[method] = { count: 0, total: 0 }
      }
      byMethod[method].count++
      byMethod[method].total += Number(p.totalAmount)

      totalElectric += Number(p.electricAmount)
      totalWater += Number(p.waterAmount)
      totalDues += Number(p.duesAmount)
      totalPenalty += Number(p.pastDuesAmount)
      totalSP += Number(p.spAssessmentAmount)
    }

    const summary = {
      totalPayments: allPayments.length,
      totalAmount: allPayments.reduce((sum, p) => sum + Number(p.totalAmount), 0),
      byMethod,
      byComponent: {
        electric: totalElectric,
        water: totalWater,
        dues: totalDues,
        penalty: totalPenalty,
        spAssessment: totalSP
      },
      dateRange: {
        start: start.toISOString(),
        end: end.toISOString()
      }
    }

    return NextResponse.json({
      success: true,
      data: paymentData,
      summary,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit)
      },
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating payment history report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
