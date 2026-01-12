import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

// GET - List all bills
export async function GET(request: NextRequest) {
  try {
    const { tenantId } = await requireAuth(await headers())

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const billingMonth = searchParams.get("billingMonth")
    const unitId = searchParams.get("unitId")

    const where: any = {
      tenantId,
    }

    if (status) {
      where.status = status
    }

    if (billingMonth) {
      const billingPeriod = new Date(billingMonth + "-01")
      where.billingPeriod = billingPeriod
    }

    if (unitId) {
      where.unitId = unitId
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        unit: {
          include: {
            owner: true,
          },
        },
      },
      orderBy: [{ billingMonth: "desc" }, { billNumber: "desc" }],
    })

    // Transform owner data to include computed name field
    const transformedBills = bills.map((bill) => ({
      ...bill,
      unit: {
        ...bill.unit,
        owner: bill.unit.owner ? {
          ...bill.unit.owner,
          name: `${bill.unit.owner.lastName}, ${bill.unit.owner.firstName}${bill.unit.owner.middleName ? ` ${bill.unit.owner.middleName.charAt(0)}.` : ''}`,
        } : null,
      },
    }))

    return NextResponse.json(transformedBills)
  } catch (error: any) {
    console.error("Error fetching bills:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch bills" },
      { status: 500 }
    )
  }
}
