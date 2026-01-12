"use client"

import { useEffect, useState, useMemo } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Settings, Save, Calendar, AlertCircle, Info, Filter, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface UnitAdjustment {
  unitId: string
  unitNumber: string
  floorLevel: string
  ownerName: string
  area: number
  parkingArea: number
  spAssessment: number
  discounts: number
  remarks: string
}

interface BillingPeriodInfo {
  hasHistory: boolean
  lastBillingPeriod: string | null
  lastBillingPeriodDisplay: string | null
  nextBillingPeriod: string | null
  nextBillingPeriodDisplay: string | null
  message: string
}

export default function BillingAdjustmentsPage() {
  const [billingMonth, setBillingMonth] = useState("")
  const [adjustments, setAdjustments] = useState<UnitAdjustment[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const [billingPeriodInfo, setBillingPeriodInfo] = useState<BillingPeriodInfo | null>(null)
  const [buildingFilter, setBuildingFilter] = useState<string>("all")
  const [floorFilter, setFloorFilter] = useState<string>("all")

  useEffect(() => {
    fetchBillingPeriodInfo()
  }, [])

  useEffect(() => {
    if (billingMonth) {
      loadAdjustments()
    }
  }, [billingMonth])

  const fetchBillingPeriodInfo = async () => {
    try {
      const res = await fetch("/api/billing/next-period")
      if (res.ok) {
        const data = await res.json()
        setBillingPeriodInfo(data)
        if (data.hasHistory && data.nextBillingPeriod) {
          setBillingMonth(data.nextBillingPeriod)
        } else {
          const now = new Date()
          setBillingMonth(format(now, "yyyy-MM"))
        }
      }
    } catch (error) {
      const now = new Date()
      setBillingMonth(format(now, "yyyy-MM"))
    }
  }

  const loadAdjustments = async () => {
    if (!billingMonth) return

    try {
      setLoading(true)
      const res = await fetch(`/api/billing/adjustments?billingMonth=${billingMonth}`)
      if (!res.ok) throw new Error("Failed to load adjustments")

      const data = await res.json()
      setAdjustments(data)
    } catch (error) {
      toast.error("Failed to load adjustments")
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (unitId: string, field: keyof UnitAdjustment, value: string) => {
    setAdjustments((prev) =>
      prev.map((adj) =>
        adj.unitId === unitId
          ? { ...adj, [field]: field === "remarks" ? value : parseFloat(value) || 0 }
          : adj
      )
    )
  }

  const handleSaveAll = async () => {
    if (!billingMonth) {
      toast.error("Please select a billing month")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/billing/adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingMonth,
          adjustments: adjustments.map((adj) => ({
            unitId: adj.unitId,
            spAssessment: adj.spAssessment,
            discounts: adj.discounts,
            remarks: adj.remarks,
          })),
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to save")
      }

      const result = await res.json()
      toast.success(result.message)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const handleApplyToBills = async () => {
    if (!billingMonth) {
      toast.error("Please select a billing month")
      return
    }

    try {
      setApplying(true)
      const res = await fetch("/api/billing/update-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingMonth }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to apply adjustments")
      }

      const result = await res.json()
      toast.success(result.message)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setApplying(false)
    }
  }

  // Get unique buildings and floors for filters
  const { buildings, floors } = useMemo(() => {
    const buildingSet = new Set<string>()
    const floorSet = new Set<string>()

    adjustments.forEach((adj) => {
      // Extract building from unit number (e.g., "M1" from "M1-2F-1")
      const building = adj.unitNumber.split("-")[0]
      if (building) buildingSet.add(building)
      if (adj.floorLevel) floorSet.add(adj.floorLevel)
    })

    return {
      buildings: Array.from(buildingSet).sort(),
      floors: Array.from(floorSet).sort((a, b) => {
        // Sort floors: GF first, then numerically
        if (a === "GF") return -1
        if (b === "GF") return 1
        const aNum = parseInt(a.replace("F", ""), 10) || 0
        const bNum = parseInt(b.replace("F", ""), 10) || 0
        return aNum - bNum
      }),
    }
  }, [adjustments])

  // Filter and sort units
  const filteredAdjustments = useMemo(() => {
    return adjustments
      .filter((adj) => {
        // Building filter
        if (buildingFilter !== "all") {
          const building = adj.unitNumber.split("-")[0]
          if (building !== buildingFilter) return false
        }
        // Floor filter
        if (floorFilter !== "all") {
          if (adj.floorLevel !== floorFilter) return false
        }
        return true
      })
      .sort((a, b) => {
        const getNumericPart = (unitNumber: string) => {
          const parts = unitNumber.split("-")
          const lastPart = parts[parts.length - 1]
          return parseInt(lastPart, 10) || 0
        }
        // Sort by building first
        const buildingA = a.unitNumber.split("-")[0]
        const buildingB = b.unitNumber.split("-")[0]
        if (buildingA !== buildingB) {
          return buildingA.localeCompare(buildingB)
        }
        // Then by floor
        if (a.floorLevel !== b.floorLevel) {
          if (a.floorLevel === "GF") return -1
          if (b.floorLevel === "GF") return 1
          const floorA = parseInt(a.floorLevel.replace("F", ""), 10) || 0
          const floorB = parseInt(b.floorLevel.replace("F", ""), 10) || 0
          return floorA - floorB
        }
        // Then by unit number
        return getNumericPart(a.unitNumber) - getNumericPart(b.unitNumber)
      })
  }, [adjustments, buildingFilter, floorFilter])

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-lg">
              <Settings className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Billing Adjustments</h1>
              <p className="text-purple-100">
                Enter SP Assessment and Discounts before generating bills
              </p>
            </div>
          </div>
        </div>

        {/* Billing Month Selection */}
        <Card className="border-purple-200">
          <CardHeader className="bg-purple-50">
            <CardTitle className="text-purple-800">Select Billing Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="billingMonth">Billing Month *</Label>
                <Input
                  id="billingMonth"
                  type="month"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button
                  onClick={loadAdjustments}
                  disabled={!billingMonth || loading}
                  className="w-full"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Load Adjustments
                </Button>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleSaveAll}
                  disabled={saving || adjustments.length === 0}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Saving..." : "Save All"}
                </Button>
              </div>
              <div className="flex items-end">
                <Button
                  onClick={handleApplyToBills}
                  disabled={applying || adjustments.length === 0}
                  variant="outline"
                  className="w-full border-orange-500 text-orange-600 hover:bg-orange-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${applying ? 'animate-spin' : ''}`} />
                  {applying ? "Applying..." : "Apply to Bills"}
                </Button>
              </div>
            </div>

            {/* Billing Period Info */}
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
                      : "No billing history found. You can select any billing month."}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Adjustments Table */}
        {billingMonth && adjustments.length > 0 && (
          <Card className="border-purple-200">
            <CardHeader className="bg-purple-50">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="text-purple-800">
                    Adjustments for {format(new Date(billingMonth + "-01"), "MMMM yyyy")}
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    Showing {filteredAdjustments.length} of {adjustments.length} units
                  </p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium text-purple-800">Filters:</span>
                  </div>
                  <Select value={buildingFilter} onValueChange={setBuildingFilter}>
                    <SelectTrigger className="w-[120px] bg-white">
                      <SelectValue placeholder="Building" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Buildings</SelectItem>
                      {buildings.map((building) => (
                        <SelectItem key={building} value={building}>
                          {building}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={floorFilter} onValueChange={setFloorFilter}>
                    <SelectTrigger className="w-[120px] bg-white">
                      <SelectValue placeholder="Floor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Floors</SelectItem>
                      {floors.map((floor) => (
                        <SelectItem key={floor} value={floor}>
                          {floor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {(buildingFilter !== "all" || floorFilter !== "all") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setBuildingFilter("all")
                        setFloorFilter("all")
                      }}
                      className="text-purple-600 hover:text-purple-800"
                    >
                      Clear Filters
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[calc(100vh-350px)] min-h-[300px]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 shadow-sm">
                    <tr className="border-b bg-purple-100">
                      <th className="text-left p-3 font-medium text-purple-900 bg-purple-100">Unit</th>
                      <th className="text-left p-3 font-medium text-purple-900 bg-purple-100">Owner</th>
                      <th className="text-right p-3 font-medium text-purple-900 bg-purple-100">SP Assessment</th>
                      <th className="text-right p-3 font-medium text-purple-900 bg-purple-100">Discounts</th>
                      <th className="text-left p-3 font-medium text-purple-900 bg-purple-100">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAdjustments.map((adj) => (
                      <tr key={adj.unitId} className="border-b hover:bg-gray-50">
                        <td className="p-3 font-medium">{adj.unitNumber}</td>
                        <td className="p-3 text-sm">{adj.ownerName}</td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={adj.spAssessment || ""}
                            onChange={(e) => handleChange(adj.unitId, "spAssessment", e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="text-right font-mono w-28 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="number"
                            value={adj.discounts || ""}
                            onChange={(e) => handleChange(adj.unitId, "discounts", e.target.value)}
                            onWheel={(e) => e.currentTarget.blur()}
                            className="text-right font-mono w-28 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            placeholder="0"
                          />
                        </td>
                        <td className="p-3">
                          <Input
                            type="text"
                            value={adj.remarks || ""}
                            onChange={(e) => handleChange(adj.unitId, "remarks", e.target.value)}
                            className="w-40"
                            placeholder="Notes..."
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {!billingMonth && (
          <Card className="border-purple-200">
            <CardContent className="flex flex-col items-center justify-center py-12 bg-purple-50">
              <Settings className="h-12 w-12 text-purple-400 mb-4" />
              <p className="text-purple-700">
                Select a billing month to enter adjustments
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
