import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Delinquency Report
 * Identify units with chronic late payments
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
    const minMonthsOverdue = parseInt(searchParams.get("minMonths") || "2")

    const now = new Date()

    // Get all units with overdue bills
    const units = await prisma.unit.findMany({
      where: {
        tenantId,
        isActive: true,
        bills: {
          some: {
            status: 'OVERDUE',
            balance: { gt: 0 }
          }
        }
      },
      include: {
        owner: {
          select: {
            firstName: true,
            lastName: true,
            middleName: true,
            phone: true,
            email: true
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
            penaltyAmount: true,
            status: true
          },
          orderBy: {
            dueDate: 'asc'
          }
        },
        payments: {
          orderBy: {
            paymentDate: 'desc'
          },
          take: 1,
          select: {
            paymentDate: true,
            totalAmount: true
          }
        }
      },
      orderBy: {
        unitNumber: 'asc'
      }
    })

    // Process units and calculate delinquency metrics
    const delinquentUnits = units
      .map(unit => {
        const ownerName = unit.owner
          ? `${unit.owner.lastName}, ${unit.owner.firstName}${unit.owner.middleName ? ' ' + unit.owner.middleName.charAt(0) + '.' : ''}`
          : 'No Owner'

        // Find oldest overdue bill
        const overdueBills = unit.bills.filter(b => {
          const dueDate = new Date(b.dueDate)
          return dueDate < now && Number(b.balance) > 0
        })

        if (overdueBills.length === 0) return null

        const oldestDue = new Date(overdueBills[0].dueDate)
        const monthsOverdue = Math.floor(
          (now.getTime() - oldestDue.getTime()) / (1000 * 60 * 60 * 24 * 30)
        )

        // Calculate total outstanding and penalties
        const totalOutstanding = unit.bills.reduce((sum, b) => sum + Number(b.balance), 0)
        const totalPenalties = unit.bills.reduce((sum, b) => sum + Number(b.penaltyAmount), 0)

        // Last payment info
        const lastPayment = unit.payments[0]

        return {
          unitId: unit.id,
          unitNumber: unit.unitNumber,
          floorLevel: unit.floorLevel,
          ownerName,
          ownerPhone: unit.owner?.phone || null,
          ownerEmail: unit.owner?.email || null,
          monthsOverdue,
          overdueBillsCount: overdueBills.length,
          totalOutstanding,
          totalPenalties,
          oldestDueDate: oldestDue.toISOString(),
          lastPaymentDate: lastPayment?.paymentDate?.toISOString() || null,
          lastPaymentAmount: lastPayment ? Number(lastPayment.totalAmount) : null,
          severity: monthsOverdue >= 6 ? 'critical' :
                    monthsOverdue >= 3 ? 'high' :
                    monthsOverdue >= 2 ? 'medium' : 'low'
        }
      })
      .filter((unit): unit is NonNullable<typeof unit> => unit !== null)
      .filter(unit => unit.monthsOverdue >= minMonthsOverdue)
      .sort((a, b) => b.monthsOverdue - a.monthsOverdue)

    // Summary statistics
    const summary = {
      totalDelinquentUnits: delinquentUnits.length,
      totalOutstanding: delinquentUnits.reduce((sum, u) => sum + u.totalOutstanding, 0),
      totalPenalties: delinquentUnits.reduce((sum, u) => sum + u.totalPenalties, 0),
      bySeverity: {
        critical: delinquentUnits.filter(u => u.severity === 'critical').length,
        high: delinquentUnits.filter(u => u.severity === 'high').length,
        medium: delinquentUnits.filter(u => u.severity === 'medium').length,
        low: delinquentUnits.filter(u => u.severity === 'low').length
      },
      avgMonthsOverdue: delinquentUnits.length > 0
        ? Math.round(delinquentUnits.reduce((sum, u) => sum + u.monthsOverdue, 0) / delinquentUnits.length)
        : 0
    }

    return NextResponse.json({
      success: true,
      data: delinquentUnits,
      summary,
      minMonthsOverdue,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating delinquency report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
