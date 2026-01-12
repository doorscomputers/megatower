"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  AlertCircle,
  CheckCircle,
  Calculator,
  Download,
  Eye,
  Trash2,
  RefreshCw,
  Info,
  Wallet,
  Building,
  Building2,
  Shield,
  ShieldOff,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface BillPreview {
  unitId: string
  unitNumber: string
  ownerName: string
  ownerEmail: string | null
  floorLevel: string
  area: number
  unitType: string
  electricReading: {
    previous: number
    present: number
    consumption: number
  } | null
  waterReading: {
    previous: number
    present: number
    consumption: number
  } | null
  calculations: {
    electricBill: number
    waterBill: number
    waterTierBreakdown?: any[]
    associationDues: number
    parkingFee: number
    spAssessment: number
    discounts: number
    advanceDuesApplied: number
    advanceUtilApplied: number
    previousBalance: number
    penalties: number
    subtotal: number
    total: number
  }
  warnings: string[]
}

interface ValidationWarnings {
  noPaymentsRecorded: boolean
  previousMonthLabel: string
  previousMonthPaymentsCount: number
  previousMonthUnpaidCount: number
  noAdjustments: boolean
  adjustmentsCount: number
}

interface PreviewResponse {
  success: boolean
  preview: boolean
  billingPeriod: {
    month: string
    periodFrom: string
    periodTo: string
    statementDate: string
    dueDate: string
  }
  summary: {
    totalUnits: number
    unitsWithElectricReadings: number
    unitsWithWaterReadings: number
    unitsWithWarnings: number
    totalAmount: number
  }
  validationWarnings?: ValidationWarnings
  bills: BillPreview[]
}

interface BillingPeriodInfo {
  hasHistory: boolean
  lastBillingPeriod: string | null
  lastBillingPeriodDisplay: string | null
  nextBillingPeriod: string | null
  nextBillingPeriodDisplay: string | null
  message: string
}

interface AdvanceBalanceSummary {
  totalUnitsWithAdvance: number
  totalAdvanceDues: number
  totalAdvanceUtilities: number
  units: {
    unitId: string
    unitNumber: string
    advanceDues: number
    advanceUtilities: number
  }[]
}

type BuildingFilter = "ALL" | "M1" | "M2"

// Helper to get building from unit number
const getUnitBuilding = (unitNumber: string): string => {
  if (unitNumber.startsWith("M1-")) return "M1"
  if (unitNumber.startsWith("M2-")) return "M2"
  return "Other"
}

export default function BillGenerationPage() {
  const [billingMonth, setBillingMonth] = useState("")
  const [loading, setLoading] = useState(false)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [selectedBill, setSelectedBill] = useState<BillPreview | null>(null)
  const [showDetailDialog, setShowDetailDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [billingPeriodInfo, setBillingPeriodInfo] = useState<BillingPeriodInfo | null>(null)
  const [advanceBalances, setAdvanceBalances] = useState<AdvanceBalanceSummary | null>(null)
  const [buildingFilter, setBuildingFilter] = useState<BuildingFilter>("ALL")
  const [applyingSP, setApplyingSP] = useState(false)
  const [clearingSP, setClearingSP] = useState(false)
  const [spAssessmentRate, setSpAssessmentRate] = useState<number>(0)

  useEffect(() => {
    fetchBillingPeriodInfo()
    fetchAdvanceBalances()
    fetchSPAssessmentRate()
  }, [])

  const fetchSPAssessmentRate = async () => {
    try {
      const res = await fetch("/api/settings/rates")
      if (res.ok) {
        const data = await res.json()
        setSpAssessmentRate(parseFloat(data.spAssessmentRate) || 0)
      }
    } catch (error) {
      console.error("Failed to fetch SP Assessment rate:", error)
    }
  }

  const fetchBillingPeriodInfo = async () => {
    try {
      const res = await fetch("/api/billing/next-period")
      if (res.ok) {
        const data = await res.json()
        setBillingPeriodInfo(data)
        // Auto-set to next billing period if history exists
        if (data.hasHistory && data.nextBillingPeriod) {
          setBillingMonth(data.nextBillingPeriod)
        } else {
          const now = new Date()
          setBillingMonth(format(now, "yyyy-MM"))
        }
      }
    } catch (error) {
      // Fallback to current month
      const now = new Date()
      setBillingMonth(format(now, "yyyy-MM"))
    }
  }

  const fetchAdvanceBalances = async () => {
    try {
      const res = await fetch("/api/billing/advance-balances")
      if (res.ok) {
        const data = await res.json()
        setAdvanceBalances(data)
      }
    } catch (error) {
      console.error("Failed to fetch advance balances:", error)
    }
  }

  const handleApplySPAssessment = async () => {
    if (!billingMonth) {
      toast.error("Please select a billing month first")
      return
    }

    try {
      setApplyingSP(true)
      const res = await fetch("/api/billing/apply-sp-assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingMonth }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to apply SP Assessment")
      }

      toast.success(data.message)
      // Re-preview to show updated values
      if (preview) {
        handlePreview()
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setApplyingSP(false)
    }
  }

  const handleClearSPAssessment = async () => {
    if (!billingMonth) {
      toast.error("Please select a billing month first")
      return
    }

    try {
      setClearingSP(true)
      const res = await fetch(`/api/billing/apply-sp-assessment?billingMonth=${billingMonth}`, {
        method: "DELETE",
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to clear SP Assessment")
      }

      toast.success(data.message)
      // Re-preview to show updated values
      if (preview) {
        handlePreview()
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setClearingSP(false)
    }
  }

  const handlePreview = async () => {
    if (!billingMonth) {
      toast.error("Please select a billing month")
      return
    }

    try {
      setLoading(true)
      const res = await fetch("/api/billing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingMonth,
          preview: true,
        }),
      })

      if (!res.ok) {
        const error = await res.json()

        // Check if bills already exist
        if (error.error && error.error.includes("already exist")) {
          toast.error(error.error, {
            duration: 5000,
            action: {
              label: "Delete & Regenerate",
              onClick: () => setShowDeleteDialog(true),
            },
          })
          setLoading(false)
          return
        }

        throw new Error(error.error || "Failed to preview bills")
      }

      const data = await res.json()
      setPreview(data)
      toast.success(`Preview generated for ${data.summary.totalUnits} units`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!billingMonth) {
      toast.error("Please select a billing month")
      return
    }

    try {
      setDeleting(true)
      const res = await fetch("/api/billing/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingMonth }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Failed to delete bills")
      }

      toast.success(data.message)
      setShowDeleteDialog(false)
      setPreview(null)

      // Automatically preview after successful deletion
      setTimeout(() => {
        handlePreview()
      }, 500)
    } catch (error: any) {
      toast.error(error.message, { duration: 6000 })
    } finally {
      setDeleting(false)
    }
  }

  const handleGenerate = async () => {
    if (!billingMonth) {
      toast.error("Please select a billing month")
      return
    }

    try {
      setLoading(true)
      const res = await fetch("/api/billing/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingMonth,
          preview: false,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to generate bills")
      }

      const data = await res.json()
      toast.success(data.message)
      setShowConfirmDialog(false)
      setPreview(null)
      setBillingMonth("")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const showBillDetails = (bill: BillPreview) => {
    setSelectedBill(bill)
    setShowDetailDialog(true)
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  // Filter bills by building
  const filterBillsByBuilding = (bills: BillPreview[]) => {
    if (buildingFilter === "ALL") return bills
    return bills.filter(bill => getUnitBuilding(bill.unitNumber) === buildingFilter)
  }

  // Get building counts
  const getBuildingCounts = (bills: BillPreview[]) => {
    const m1 = bills.filter(b => b.unitNumber.startsWith("M1-")).length
    const m2 = bills.filter(b => b.unitNumber.startsWith("M2-")).length
    return { m1, m2, all: bills.length }
  }

  // Sort units by building prefix (M1, M2), floor level, and unit number
  const sortBillsByUnit = (bills: BillPreview[]) => {
    return [...bills].sort((a, b) => {
      const parseUnitNumber = (unitNumber: string) => {
        // Format: M1-2F-1 or M2-GF-10
        const parts = unitNumber.split("-")
        const building = parts[0] || ""  // M1, M2
        const floor = parts[1] || ""     // GF, 1F, 2F, etc.
        const unit = parseInt(parts[2], 10) || 0  // 1, 2, 3, etc.

        // Convert floor to sortable number (GF=0, 1F=1, 2F=2, etc.)
        let floorNum = 0
        if (floor === "GF") {
          floorNum = 0
        } else {
          floorNum = parseInt(floor.replace("F", ""), 10) || 0
        }

        return { building, floorNum, unit }
      }

      const aParsed = parseUnitNumber(a.unitNumber)
      const bParsed = parseUnitNumber(b.unitNumber)

      // Sort by building first (M1 before M2)
      if (aParsed.building !== bParsed.building) {
        return aParsed.building.localeCompare(bParsed.building)
      }

      // Then by floor level
      if (aParsed.floorNum !== bParsed.floorNum) {
        return aParsed.floorNum - bParsed.floorNum
      }

      // Then by unit number
      return aParsed.unit - bParsed.unit
    })
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Generate Monthly Bills
          </h1>
          <p className="text-gray-500">
            Generate billing statements for all units based on meter readings
          </p>
        </div>

        {/* Generation Form */}
        <Card>
          <CardHeader>
            <CardTitle>Billing Period Selection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="billingMonth">Billing Month *</Label>
                <Input
                  id="billingMonth"
                  type="month"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                  disabled={loading}
                />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={handlePreview}
                  disabled={!billingMonth || loading}
                  className="flex-1"
                  variant="outline"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  {loading ? "Loading..." : "Preview Bills"}
                </Button>
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={!billingMonth || loading}
                  className="flex-1 bg-orange-500 hover:bg-orange-600"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate Bills
                </Button>
              </div>
            </div>

            {/* SP Assessment Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              <Button
                onClick={handleApplySPAssessment}
                disabled={!billingMonth || applyingSP || loading}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Shield className="h-4 w-4 mr-2" />
                {applyingSP ? "Applying..." : "Apply SP Assessment to All"}
              </Button>
              <Button
                onClick={handleClearSPAssessment}
                disabled={!billingMonth || clearingSP || loading}
                variant="outline"
                className="border-red-300 text-red-600 hover:bg-red-50"
              >
                <ShieldOff className="h-4 w-4 mr-2" />
                {clearingSP ? "Clearing..." : "Clear SP Assessment"}
              </Button>
              <p className="text-sm text-gray-500 flex items-center">
                <Info className="h-4 w-4 mr-1" />
                {spAssessmentRate > 0
                  ? `Applies ₱${spAssessmentRate.toFixed(2)} (from Settings) to all units`
                  : "SP Assessment rate not set. Configure in Settings → Rates & Charges"}
              </p>
            </div>

            {/* Billing Period Info/Warning */}
            {billingPeriodInfo && (
              <div className={`flex items-start gap-3 p-3 rounded-lg ${
                billingPeriodInfo.hasHistory
                  ? billingMonth === billingPeriodInfo.nextBillingPeriod
                    ? "bg-green-50 border border-green-200"
                    : "bg-yellow-50 border border-yellow-200"
                  : "bg-blue-50 border border-blue-200"
              }`}>
                {billingPeriodInfo.hasHistory ? (
                  billingMonth === billingPeriodInfo.nextBillingPeriod ? (
                    <Info className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  )
                ) : (
                  <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    billingPeriodInfo.hasHistory
                      ? billingMonth === billingPeriodInfo.nextBillingPeriod
                        ? "text-green-800"
                        : "text-yellow-800"
                      : "text-blue-800"
                  }`}>
                    {billingPeriodInfo.hasHistory
                      ? billingMonth === billingPeriodInfo.nextBillingPeriod
                        ? `Correct! Next billing period is ${billingPeriodInfo.nextBillingPeriodDisplay}`
                        : `Warning: Expected billing month is ${billingPeriodInfo.nextBillingPeriodDisplay}`
                      : "No billing history found. You can select any billing month to start."}
                  </p>
                  {billingPeriodInfo.hasHistory && billingMonth !== billingPeriodInfo.nextBillingPeriod && (
                    <p className="text-sm text-yellow-700 mt-1">
                      Last billing was {billingPeriodInfo.lastBillingPeriodDisplay}.
                      Are you sure you want to generate bills for a different month?
                    </p>
                  )}
                  {billingMonth && (
                    <div className="mt-2 text-xs text-gray-600">
                      <p>• Reading Period: Previous month 27th to Current month 26th</p>
                      <p>• Statement Date: Current month 27th</p>
                      <p>• Due Date: Next month 6th</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Results */}
        {preview && (
          <>
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>
                  Preview Summary -{" "}
                  {format(new Date(preview.billingPeriod.month + "-01"), "MMMM yyyy")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-600 font-medium">Total Units</p>
                    <p className="text-2xl font-bold text-blue-900">
                      {preview.summary.totalUnits}
                    </p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600 font-medium">
                      With Electric Readings
                    </p>
                    <p className="text-2xl font-bold text-green-900">
                      {preview.summary.unitsWithElectricReadings}
                    </p>
                  </div>
                  <div className="bg-cyan-50 p-4 rounded-lg">
                    <p className="text-sm text-cyan-600 font-medium">
                      With Water Readings
                    </p>
                    <p className="text-2xl font-bold text-cyan-900">
                      {preview.summary.unitsWithWaterReadings}
                    </p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-purple-600 font-medium">
                      Total Amount
                    </p>
                    <p className="text-2xl font-bold text-purple-900">
                      {formatCurrency(preview.summary.totalAmount)}
                    </p>
                  </div>
                </div>

                {/* Validation Warnings Section */}
                {preview.validationWarnings && (
                  <div className="space-y-3 mb-4">
                    {/* No Payments Recorded Warning */}
                    {preview.validationWarnings.noPaymentsRecorded && (
                      <div className="bg-orange-50 border border-orange-300 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-orange-900 font-medium">
                              No Payments Recorded for {preview.validationWarnings.previousMonthLabel}
                            </p>
                            <p className="text-sm text-orange-800 mt-1">
                              Generating bills without recording payments may result in incorrect balances.
                              Did you record all payments for the previous billing period?
                            </p>
                            <p className="text-xs text-orange-700 mt-2">
                              Go to <strong>Payments → Record Payment</strong> to enter payments before generating bills.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Many Unpaid Bills Warning */}
                    {preview.validationWarnings.previousMonthUnpaidCount > 10 && (
                      <div className="bg-red-50 border border-red-300 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-red-900 font-medium">
                              {preview.validationWarnings.previousMonthUnpaidCount} Unpaid Bills from Previous Month
                            </p>
                            <p className="text-sm text-red-800 mt-1">
                              Many bills from last month still have outstanding balances.
                              Consider verifying if all payments have been recorded.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* No Adjustments Info */}
                    {preview.validationWarnings.noAdjustments && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-blue-900 font-medium">
                              No Adjustments Entered for This Period
                            </p>
                            <p className="text-sm text-blue-800 mt-1">
                              No SP Assessments or Discounts have been entered.
                              If any units require adjustments, enter them in <strong>Billing → Adjustments</strong> first.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Adjustments Applied Info */}
                    {preview.validationWarnings.adjustmentsCount > 0 && (
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-green-900 font-medium">
                              {preview.validationWarnings.adjustmentsCount} Adjustment(s) Will Be Applied
                            </p>
                            <p className="text-sm text-green-800 mt-1">
                              SP Assessments and/or Discounts have been entered and will be included in the bills.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {preview.summary.unitsWithWarnings > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      <p className="text-yellow-900 font-medium">
                        {preview.summary.unitsWithWarnings} unit(s) have missing
                        readings
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    <p>
                      Period: {format(new Date(preview.billingPeriod.periodFrom), "MMM dd, yyyy")}{" "}
                      to {format(new Date(preview.billingPeriod.periodTo), "MMM dd, yyyy")}
                    </p>
                    <p>
                      Statement Date:{" "}
                      {format(new Date(preview.billingPeriod.statementDate), "MMM dd, yyyy")}
                    </p>
                    <p>
                      Due Date:{" "}
                      {format(new Date(preview.billingPeriod.dueDate), "MMM dd, yyyy")}
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowConfirmDialog(true)}
                    disabled={loading}
                    size="lg"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Generate All Bills
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Advance Balance Summary */}
            {advanceBalances && advanceBalances.totalUnitsWithAdvance > 0 && (
              <Card className="border-emerald-200">
                <CardHeader className="bg-emerald-50">
                  <CardTitle className="flex items-center gap-2 text-emerald-800">
                    <Wallet className="h-5 w-5" />
                    Advance Balances Available
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-emerald-50 p-4 rounded-lg">
                      <p className="text-sm text-emerald-600 font-medium">Units with Advance</p>
                      <p className="text-2xl font-bold text-emerald-900">
                        {advanceBalances.totalUnitsWithAdvance}
                      </p>
                    </div>
                    <div className="bg-teal-50 p-4 rounded-lg">
                      <p className="text-sm text-teal-600 font-medium">Total Advance Dues</p>
                      <p className="text-2xl font-bold text-teal-900">
                        {formatCurrency(advanceBalances.totalAdvanceDues)}
                      </p>
                    </div>
                    <div className="bg-cyan-50 p-4 rounded-lg">
                      <p className="text-sm text-cyan-600 font-medium">Total Advance Utilities</p>
                      <p className="text-2xl font-bold text-cyan-900">
                        {formatCurrency(advanceBalances.totalAdvanceUtilities)}
                      </p>
                    </div>
                  </div>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                    <p className="text-sm text-emerald-800">
                      <Info className="h-4 w-4 inline mr-1" />
                      These advance payments will be automatically deducted when generating bills.
                    </p>
                  </div>
                  {advanceBalances.units.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Units with Advance:</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                        {advanceBalances.units.map((unit) => (
                          <div key={unit.unitId} className="bg-gray-50 p-2 rounded">
                            <p className="font-medium">{unit.unitNumber}</p>
                            {unit.advanceDues > 0 && (
                              <p className="text-xs text-emerald-600">
                                Dues: {formatCurrency(unit.advanceDues)}
                              </p>
                            )}
                            {unit.advanceUtilities > 0 && (
                              <p className="text-xs text-teal-600">
                                Util: {formatCurrency(unit.advanceUtilities)}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Bills Table */}
            <Card>
              <CardHeader>
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <CardTitle>Bill Details ({filterBillsByBuilding(preview.bills).length} units)</CardTitle>

                  {/* Building Filter Buttons */}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={buildingFilter === "ALL" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBuildingFilter("ALL")}
                      className={buildingFilter === "ALL" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
                    >
                      All ({getBuildingCounts(preview.bills).all})
                    </Button>
                    <Button
                      variant={buildingFilter === "M1" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBuildingFilter("M1")}
                      className={buildingFilter === "M1" ? "bg-blue-600 hover:bg-blue-700" : ""}
                    >
                      <Building className="w-4 h-4 mr-1" />
                      M1 ({getBuildingCounts(preview.bills).m1})
                    </Button>
                    <Button
                      variant={buildingFilter === "M2" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setBuildingFilter("M2")}
                      className={buildingFilter === "M2" ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      <Building2 className="w-4 h-4 mr-1" />
                      M2 ({getBuildingCounts(preview.bills).m2})
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-auto max-h-[calc(100vh-450px)] min-h-[300px]">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 z-10 shadow-sm">
                      <tr className="border-b bg-gray-100">
                        <th className="text-left p-3 font-medium bg-gray-100">Unit</th>
                        <th className="text-left p-3 font-medium bg-gray-100">Owner</th>
                        <th className="text-right p-3 font-medium bg-gray-100">Electric</th>
                        <th className="text-right p-3 font-medium bg-gray-100">Water</th>
                        <th className="text-right p-3 font-medium bg-gray-100">Dues</th>
                        <th className="text-right p-3 font-medium bg-gray-100">SP Assess</th>
                        <th className="text-right p-3 font-medium bg-gray-100">Prev Bal</th>
                        <th className="text-right p-3 font-medium bg-gray-100">Penalty</th>
                        <th className="text-right p-3 font-medium bg-gray-100">Total</th>
                        <th className="text-center p-3 font-medium bg-gray-100">Status</th>
                        <th className="text-center p-3 font-medium bg-gray-100">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortBillsByUnit(filterBillsByBuilding(preview.bills)).map((bill) => (
                        <tr
                          key={bill.unitId}
                          className={`border-b hover:bg-gray-50 ${
                            bill.warnings.length > 0 ? "bg-yellow-50" : ""
                          }`}
                        >
                          <td className="p-3 font-medium">{bill.unitNumber}</td>
                          <td className="p-3">
                            <div>
                              <p className="font-medium">{bill.ownerName}</p>
                              {bill.ownerEmail && (
                                <p className="text-xs text-gray-500">
                                  {bill.ownerEmail}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-right font-mono">
                            {formatCurrency(bill.calculations.electricBill)}
                            {bill.electricReading && (
                              <p className="text-xs text-gray-500">
                                {bill.electricReading.consumption} kWh
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono">
                            {formatCurrency(bill.calculations.waterBill)}
                            {bill.waterReading && (
                              <p className="text-xs text-gray-500">
                                {bill.waterReading.consumption.toFixed(2)} cu.m
                              </p>
                            )}
                          </td>
                          <td className="p-3 text-right font-mono">
                            {formatCurrency(bill.calculations.associationDues)}
                          </td>
                          <td className="p-3 text-right font-mono text-indigo-600">
                            {bill.calculations.spAssessment > 0
                              ? formatCurrency(bill.calculations.spAssessment)
                              : "-"}
                          </td>
                          <td className="p-3 text-right font-mono">
                            {bill.calculations.previousBalance > 0
                              ? formatCurrency(bill.calculations.previousBalance)
                              : "-"}
                          </td>
                          <td className="p-3 text-right font-mono text-red-600">
                            {bill.calculations.penalties > 0
                              ? formatCurrency(bill.calculations.penalties)
                              : "-"}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-blue-600">
                            {formatCurrency(bill.calculations.total)}
                          </td>
                          <td className="p-3 text-center">
                            {bill.warnings.length > 0 ? (
                              <Badge variant="warning" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                Warning
                              </Badge>
                            ) : (
                              <Badge variant="success" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Ready
                              </Badge>
                            )}
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => showBillDetails(bill)}
                            >
                              <Calculator className="h-3 w-3 mr-1" />
                              Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Empty State */}
        {!preview && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                Select a billing month and click "Preview Bills" to see the
                calculation breakdown before generating
              </p>
            </CardContent>
          </Card>
        )}

        {/* Confirm Generation Dialog */}
        <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Bill Generation</DialogTitle>
              <DialogDescription>
                You are about to generate {preview?.summary.totalUnits} bill(s) for{" "}
                {preview?.billingPeriod.month}.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {preview && preview.summary.unitsWithWarnings > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-yellow-900">
                        Warning: Missing Readings
                      </p>
                      <p className="text-sm text-yellow-800">
                        {preview.summary.unitsWithWarnings} unit(s) are missing
                        meter readings. Bills will be generated with zero
                        consumption for missing readings.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>Total Amount:</strong>{" "}
                  {preview && formatCurrency(preview.summary.totalAmount)}
                </p>
              </div>
              <p className="text-sm text-gray-600">
                This action cannot be undone. Bills will be created and sent to unit
                owners.
              </p>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={loading}>
                {loading ? "Generating..." : "Confirm & Generate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Bill Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                Bill Breakdown - {selectedBill?.unitNumber}
              </DialogTitle>
              <DialogDescription>
                {selectedBill?.ownerName} | {selectedBill?.unitType} | {selectedBill?.area} sqm
              </DialogDescription>
            </DialogHeader>
            {selectedBill && (
              <div className="space-y-4 py-4">
                {selectedBill.warnings.length > 0 && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="font-medium text-yellow-900 mb-1">Warnings:</p>
                    <ul className="list-disc list-inside text-sm text-yellow-800">
                      {selectedBill.warnings.map((warning, idx) => (
                        <li key={idx}>{warning}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="border rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-600 mb-2">
                      Electric Meter
                    </p>
                    {selectedBill.electricReading ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>Previous:</span>
                          <span className="font-mono">
                            {selectedBill.electricReading.previous.toFixed(0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Present:</span>
                          <span className="font-mono">
                            {selectedBill.electricReading.present.toFixed(0)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-bold border-t mt-2 pt-2">
                          <span>Consumption:</span>
                          <span className="font-mono">
                            {selectedBill.electricReading.consumption} kWh
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-red-600">No reading</p>
                    )}
                  </div>

                  <div className="border rounded-lg p-3">
                    <p className="text-sm font-medium text-gray-600 mb-2">
                      Water Meter
                    </p>
                    {selectedBill.waterReading ? (
                      <>
                        <div className="flex justify-between text-sm">
                          <span>Previous:</span>
                          <span className="font-mono">
                            {selectedBill.waterReading.previous.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Present:</span>
                          <span className="font-mono">
                            {selectedBill.waterReading.present.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-sm font-bold border-t mt-2 pt-2">
                          <span>Consumption:</span>
                          <span className="font-mono">
                            {selectedBill.waterReading.consumption.toFixed(2)} cu.m
                          </span>
                        </div>
                      </>
                    ) : (
                      <p className="text-sm text-red-600">No reading</p>
                    )}
                  </div>
                </div>

                <div className="border rounded-lg p-4 bg-gray-50">
                  <p className="font-semibold mb-3">Billing Computation:</p>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Electric Bill:</span>
                      <span className="font-mono">
                        {formatCurrency(selectedBill.calculations.electricBill)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Water Bill:</span>
                      <span className="font-mono">
                        {formatCurrency(selectedBill.calculations.waterBill)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Association Dues:</span>
                      <span className="font-mono">
                        {formatCurrency(selectedBill.calculations.associationDues)}
                      </span>
                    </div>
                    {selectedBill.calculations.spAssessment > 0 && (
                      <div className="flex justify-between text-indigo-600">
                        <span>SP Assessment (Insurance):</span>
                        <span className="font-mono">
                          {formatCurrency(selectedBill.calculations.spAssessment)}
                        </span>
                      </div>
                    )}
                    {selectedBill.calculations.previousBalance > 0 && (
                      <>
                        <div className="border-t pt-2"></div>
                        <div className="flex justify-between text-orange-600">
                          <span>Previous Balance:</span>
                          <span className="font-mono">
                            {formatCurrency(
                              selectedBill.calculations.previousBalance
                            )}
                          </span>
                        </div>
                      </>
                    )}
                    {selectedBill.calculations.penalties > 0 && (
                      <div className="flex justify-between text-red-600">
                        <span>Penalties (10%):</span>
                        <span className="font-mono">
                          {formatCurrency(selectedBill.calculations.penalties)}
                        </span>
                      </div>
                    )}
                    <div className="border-t pt-2"></div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total Amount:</span>
                      <span className="font-mono text-blue-600">
                        {formatCurrency(selectedBill.calculations.total)}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedBill.calculations.waterTierBreakdown &&
                  selectedBill.calculations.waterTierBreakdown.length > 0 && (
                    <div className="border rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-600 mb-2">
                        Water Tier Breakdown:
                      </p>
                      <div className="space-y-1 text-xs">
                        {selectedBill.calculations.waterTierBreakdown.map(
                          (tier: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex justify-between font-mono"
                            >
                              <span>
                                Tier {tier.tier}: {tier.consumption.toFixed(2)} cu.m
                              </span>
                              <span>{formatCurrency(tier.amount)}</span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDetailDialog(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Bills Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <Trash2 className="h-5 w-5" />
                Delete Bills & Regenerate
              </DialogTitle>
              <DialogDescription>
                This will delete all existing bills for{" "}
                {billingMonth && format(new Date(billingMonth + "-01"), "MMMM yyyy")}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-medium text-red-900">Warning: Destructive Action</p>
                    <p className="text-sm text-red-800 mt-1">
                      This will permanently delete all bills for this billing period.
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium mb-2">
                  Safety Checks:
                </p>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✓ Only bills with zero payments can be deleted</li>
                  <li>✓ Bills with recorded payments are protected</li>
                  <li>✓ You can regenerate immediately after deletion</li>
                </ul>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-900 font-medium mb-1">
                  Why Delete & Regenerate?
                </p>
                <p className="text-sm text-yellow-800">
                  Use this if you need to correct meter readings or fix calculation
                  errors before any payments have been made.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                disabled={deleting}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDelete}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700"
              >
                {deleting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete & Regenerate
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  )
}
