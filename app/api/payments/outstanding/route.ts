import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { headers } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    })

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const unitId = searchParams.get("unitId")

    if (!unitId) {
      return NextResponse.json(
        { error: "Unit ID is required" },
        { status: 400 }
      )
    }

    // Get all unpaid bills for this unit
    const unpaidBills = await prisma.bill.findMany({
      where: {
        unitId,
        status: { in: ["UNPAID", "PARTIAL", "OVERDUE"] },
      },
      select: {
        electricAmount: true,
        waterAmount: true,
        associationDues: true,
        penaltyAmount: true,
        spAssessment: true,
        totalAmount: true,
        paidAmount: true,
        payments: {
          select: {
            electricAmount: true,
            waterAmount: true,
            duesAmount: true,
            penaltyAmount: true,
            spAssessmentAmount: true,
          },
        },
      },
    })

    // Calculate outstanding per component
    let electric = 0
    let water = 0
    let dues = 0
    let pastDues = 0
    let spAssessment = 0

    for (const bill of unpaidBills) {
      // Sum up what's been paid for each component
      const paidElectric = bill.payments.reduce(
        (sum, p) => sum + Number(p.electricAmount),
        0
      )
      const paidWater = bill.payments.reduce(
        (sum, p) => sum + Number(p.waterAmount),
        0
      )
      const paidDues = bill.payments.reduce(
        (sum, p) => sum + Number(p.duesAmount),
        0
      )
      const paidPenalty = bill.payments.reduce(
        (sum, p) => sum + Number(p.penaltyAmount),
        0
      )
      const paidSP = bill.payments.reduce(
        (sum, p) => sum + Number(p.spAssessmentAmount),
        0
      )

      // Calculate remaining for each component
      electric += Math.max(0, Number(bill.electricAmount) - paidElectric)
      water += Math.max(0, Number(bill.waterAmount) - paidWater)
      dues += Math.max(0, Number(bill.associationDues) - paidDues)
      pastDues += Math.max(0, Number(bill.penaltyAmount) - paidPenalty)
      spAssessment += Math.max(0, Number(bill.spAssessment) - paidSP)
    }

    const total = electric + water + dues + pastDues + spAssessment

    return NextResponse.json({
      electric,
      water,
      dues,
      pastDues,
      spAssessment,
      total,
    })
  } catch (error) {
    console.error("Error fetching outstanding balance:", error)
    return NextResponse.json(
      { error: "Failed to fetch outstanding balance" },
      { status: 500 }
    )
  }
}
