import { NextRequest, NextResponse } from "next/server"
import { headers } from "next/headers"
import { requireAuth } from "@/lib/auth"
import prisma from "@/lib/prisma"

/**
 * GET /api/billing/next-period
 * Returns the last billing period and the next available billing month
 *
 * Logic:
 * - If no billing exists, returns null for lastBillingPeriod and allows any month
 * - If billing exists, returns the next month after the last billing period
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

    // Check for the most recent billing period from multiple sources:
    // 1. Generated bills (excluding OPENING_BALANCE)
    // 2. Electric readings
    // 3. Water readings

    const [lastBill, lastElectricReading, lastWaterReading] = await Promise.all([
      prisma.bill.findFirst({
        where: {
          tenantId,
          billType: { not: "OPENING_BALANCE" },
        },
        orderBy: { billingMonth: "desc" },
        select: { billingMonth: true },
      }),
      prisma.electricReading.findFirst({
        where: {
          unit: { tenantId },
        },
        orderBy: { billingPeriod: "desc" },
        select: { billingPeriod: true },
      }),
      prisma.waterReading.findFirst({
        where: {
          unit: { tenantId },
        },
        orderBy: { billingPeriod: "desc" },
        select: { billingPeriod: true },
      }),
    ])

    // Find the most recent date among all sources
    const dates = [
      lastBill?.billingMonth,
      lastElectricReading?.billingPeriod,
      lastWaterReading?.billingPeriod,
    ].filter(Boolean) as Date[]

    if (dates.length === 0) {
      // No billing history - allow any month
      return NextResponse.json({
        hasHistory: false,
        lastBillingPeriod: null,
        nextBillingPeriod: null,
        message: "No billing history found. You can select any billing month.",
      })
    }

    // Get the most recent date
    const lastBillingPeriod = new Date(Math.max(...dates.map(d => d.getTime())))

    // Calculate next billing period (next month)
    const nextBillingPeriod = new Date(lastBillingPeriod)
    nextBillingPeriod.setMonth(nextBillingPeriod.getMonth() + 1)

    // Format for display
    const formatMonth = (date: Date) => {
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    }

    return NextResponse.json({
      hasHistory: true,
      lastBillingPeriod: formatMonth(lastBillingPeriod),
      lastBillingPeriodDisplay: lastBillingPeriod.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      nextBillingPeriod: formatMonth(nextBillingPeriod),
      nextBillingPeriodDisplay: nextBillingPeriod.toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
      }),
      message: `Last billing was ${lastBillingPeriod.toLocaleDateString("en-US", { month: "long", year: "numeric" })}. Next billing should be ${nextBillingPeriod.toLocaleDateString("en-US", { month: "long", year: "numeric" })}.`,
    })
  } catch (error: any) {
    console.error("Error getting next billing period:", error)
    return NextResponse.json(
      { error: error.message || "Failed to get billing period info" },
      { status: 500 }
    )
  }
}
