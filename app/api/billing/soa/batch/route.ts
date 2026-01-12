import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET - Generate batch SOA for multiple units
 * Query params:
 * - filter: "all" | "with_balance" | "floor" | "building"
 * - floor: floor level (if filter=floor)
 * - building: building code M1 or M2 (if filter=building)
 * - asOfDate: date string
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
    const filter = searchParams.get("filter") || "all"
    const floor = searchParams.get("floor")
    const building = searchParams.get("building")
    const asOfDate = searchParams.get("asOfDate")

    // Determine cutoff date
    const cutoffDate = asOfDate ? new Date(asOfDate) : new Date()

    // Build unit filter
    const unitWhere: any = {
      tenantId: tenantId,
      isActive: true,
    }

    if (filter === "floor" && floor) {
      unitWhere.floorLevel = floor
    }

    if (filter === "building" && building) {
      unitWhere.unitNumber = { startsWith: `${building}-` }
    }

    // Get all units matching filter
    const units = await prisma.unit.findMany({
      where: unitWhere,
      include: {
        owner: true,
      },
    })

    // Sort units properly: by building (M1, M2), then floor (GF, 2F, 3F), then unit number numerically
    units.sort((a, b) => {
      const parseUnit = (unitNumber: string) => {
        // Format: M1-2F-1 or M2-GF-10
        const parts = unitNumber.split("-")
        const building = parts[0] || ""  // M1, M2
        const floor = parts[1] || ""     // GF, 2F, 3F, etc.
        const unit = parseInt(parts[2], 10) || 0  // 1, 2, 3, etc.

        // Convert floor to sortable number (GF=0, 2F=2, 3F=3, etc.)
        let floorNum = 0
        if (floor === "GF") {
          floorNum = 0
        } else {
          floorNum = parseInt(floor.replace("F", ""), 10) || 0
        }

        return { building, floorNum, unit }
      }

      const aParsed = parseUnit(a.unitNumber)
      const bParsed = parseUnit(b.unitNumber)

      // Sort by building first (M1 before M2)
      if (aParsed.building !== bParsed.building) {
        return aParsed.building.localeCompare(bParsed.building)
      }

      // Then by floor level
      if (aParsed.floorNum !== bParsed.floorNum) {
        return aParsed.floorNum - bParsed.floorNum
      }

      // Then by unit number (numerically)
      return aParsed.unit - bParsed.unit
    })

    // Generate SOA for each unit
    const soaList = []

    for (const unit of units) {
      // Get all bills for this unit up to the cutoff date (by billing month, not statement date)
      // This ensures September bills show when As of Date is Sept 5
      const bills = await prisma.bill.findMany({
        where: {
          unitId: unit.id,
          tenantId: tenantId,
          billingMonth: { lte: cutoffDate },
        },
        orderBy: { billingMonth: "asc" },
      })

      // Get all payments for this unit up to the cutoff date
      const payments = await prisma.payment.findMany({
        where: {
          unitId: unit.id,
          tenantId: tenantId,
          paymentDate: { lte: cutoffDate },
        },
        orderBy: { paymentDate: "asc" },
      })

      // Calculate summary
      const totalBilled = bills.reduce((sum, b) => sum + Number(b.totalAmount), 0)
      const totalPaid = payments.reduce((sum, p) => sum + Number(p.totalAmount), 0)
      const currentBalance = totalBilled - totalPaid

      // If filter is "with_balance", skip units with zero balance
      if (filter === "with_balance" && currentBalance <= 0) {
        continue
      }

      // Get unpaid bills for aging analysis
      const unpaidBills = bills.filter((b) => b.status !== "PAID")
      const now = cutoffDate
      const aging = {
        current: 0,
        days31to60: 0,
        days61to90: 0,
        over90: 0,
      }

      for (const bill of unpaidBills) {
        const balance = Number(bill.totalAmount) - Number(bill.paidAmount)
        if (balance <= 0) continue

        const daysOverdue = Math.floor(
          (now.getTime() - bill.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        )

        if (daysOverdue <= 30) {
          aging.current += balance
        } else if (daysOverdue <= 60) {
          aging.days31to60 += balance
        } else if (daysOverdue <= 90) {
          aging.days61to90 += balance
        } else {
          aging.over90 += balance
        }
      }

      // Build transactions
      let runningBalance = 0
      const transactions: Array<{
        date: Date
        type: "BILL" | "PAYMENT"
        description: string
        billNumber?: string
        orNumber?: string
        debit: number
        credit: number
        balance: number
      }> = []

      const allTransactions = [
        ...bills.map((b) => ({ date: b.statementDate, type: "BILL" as const, data: b })),
        ...payments.map((p) => ({ date: p.paymentDate, type: "PAYMENT" as const, data: p })),
      ].sort((a, b) => a.date.getTime() - b.date.getTime())

      for (const transaction of allTransactions) {
        if (transaction.type === "BILL") {
          const bill = transaction.data as any
          runningBalance += Number(bill.totalAmount)
          transactions.push({
            date: bill.statementDate,
            type: "BILL",
            description: `Bill for ${new Date(bill.billingMonth).toLocaleDateString("en-US", { month: "short", year: "numeric" })}`,
            billNumber: bill.billNumber,
            debit: Number(bill.totalAmount),
            credit: 0,
            balance: runningBalance,
          })
        } else {
          const payment = transaction.data as any
          runningBalance -= Number(payment.totalAmount)
          transactions.push({
            date: payment.paymentDate,
            type: "PAYMENT",
            description: `Payment - ${payment.paymentMethod.replace("_", " ")}`,
            orNumber: payment.orNumber,
            debit: 0,
            credit: Number(payment.totalAmount),
            balance: runningBalance,
          })
        }
      }

      soaList.push({
        unit: {
          id: unit.id,
          unitNumber: unit.unitNumber,
          floorLevel: unit.floorLevel,
          area: Number(unit.area),
          unitType: unit.unitType,
        },
        owner: unit.owner ? {
          id: unit.owner.id,
          name: `${unit.owner.lastName}, ${unit.owner.firstName}${unit.owner.middleName ? ` ${unit.owner.middleName.charAt(0)}.` : ''}`,
          email: unit.owner.email,
          phone: unit.owner.phone,
        } : null,
        summary: {
          totalBilled,
          totalPaid,
          currentBalance,
          billsCount: bills.length,
          paymentsCount: payments.length,
          unpaidBillsCount: unpaidBills.length,
        },
        aging,
        transactions,
      })
    }

    // Calculate overall summary
    const overallSummary = {
      totalUnits: soaList.length,
      totalBilled: soaList.reduce((sum, s) => sum + s.summary.totalBilled, 0),
      totalPaid: soaList.reduce((sum, s) => sum + s.summary.totalPaid, 0),
      totalBalance: soaList.reduce((sum, s) => sum + s.summary.currentBalance, 0),
      unitsWithBalance: soaList.filter((s) => s.summary.currentBalance > 0).length,
    }

    return NextResponse.json({
      success: true,
      asOfDate: cutoffDate,
      filter,
      floor: filter === "floor" ? floor : null,
      building: filter === "building" ? building : null,
      overallSummary,
      soaList,
    })
  } catch (error: any) {
    console.error("Error generating batch SOA:", error)
    return NextResponse.json(
      { error: error.message || "Failed to generate batch SOA" },
      { status: 500 }
    )
  }
}
