import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Owner Summary Report
 * Outstanding balances grouped by owner
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
    const showAll = searchParams.get("showAll") === "true"

    // Get all owners with their units and outstanding bills
    const owners = await prisma.owner.findMany({
      where: {
        tenantId,
        units: {
          some: {
            isActive: true
          }
        }
      },
      include: {
        units: {
          where: {
            isActive: true
          },
          include: {
            bills: {
              where: showAll ? {} : {
                balance: { gt: 0 },
                status: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] }
              },
              select: {
                balance: true,
                penaltyAmount: true,
                dueDate: true,
                status: true
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
          }
        }
      },
      orderBy: {
        lastName: 'asc'
      }
    })

    // Process owners
    const ownerSummaries = owners
      .map(owner => {
        const ownerName = `${owner.lastName}, ${owner.firstName}${owner.middleName ? ' ' + owner.middleName.charAt(0) + '.' : ''}`

        const units = owner.units.map(unit => {
          const totalBalance = unit.bills.reduce((sum, b) => sum + Number(b.balance), 0)
          const totalPenalty = unit.bills.reduce((sum, b) => sum + Number(b.penaltyAmount), 0)
          const overdueCount = unit.bills.filter(b => b.status === 'OVERDUE').length
          const lastPayment = unit.payments[0]

          return {
            unitId: unit.id,
            unitNumber: unit.unitNumber,
            floorLevel: unit.floorLevel,
            balance: totalBalance,
            penalty: totalPenalty,
            overdueCount,
            billsCount: unit.bills.length,
            lastPaymentDate: lastPayment?.paymentDate?.toISOString() || null,
            lastPaymentAmount: lastPayment ? Number(lastPayment.totalAmount) : null
          }
        })

        const totalBalance = units.reduce((sum, u) => sum + u.balance, 0)
        const totalPenalty = units.reduce((sum, u) => sum + u.penalty, 0)
        const totalOverdue = units.reduce((sum, u) => sum + u.overdueCount, 0)

        // Find last payment across all units
        const allPaymentDates = units
          .filter(u => u.lastPaymentDate)
          .map(u => new Date(u.lastPaymentDate!))
        const lastPaymentDate = allPaymentDates.length > 0
          ? new Date(Math.max(...allPaymentDates.map(d => d.getTime()))).toISOString()
          : null

        return {
          ownerId: owner.id,
          ownerName,
          phone: owner.phone,
          email: owner.email,
          address: owner.address,
          unitsCount: units.length,
          units: units.filter(u => showAll || u.balance > 0),
          totalBalance,
          totalPenalty,
          totalOverdue,
          lastPaymentDate
        }
      })
      .filter(owner => showAll || owner.totalBalance > 0)
      .sort((a, b) => b.totalBalance - a.totalBalance)

    // Summary statistics
    const summary = {
      totalOwners: ownerSummaries.length,
      totalOutstanding: ownerSummaries.reduce((sum, o) => sum + o.totalBalance, 0),
      totalPenalty: ownerSummaries.reduce((sum, o) => sum + o.totalPenalty, 0),
      totalUnitsWithBalance: ownerSummaries.reduce((sum, o) => sum + o.units.length, 0)
    }

    return NextResponse.json({
      success: true,
      data: ownerSummaries,
      summary,
      generatedAt: new Date().toISOString()
    })
  } catch (error: any) {
    console.error("Error generating owner summary report:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate report" },
      { status: 500 }
    )
  }
}
