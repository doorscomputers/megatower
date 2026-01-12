"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Zap, Save, Calendar, AlertCircle, Info } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Unit {
  id: string
  unitNumber: string
  floorLevel: string
  isActive: boolean
  owner: {
    name: string
  }
}

interface ReadingData {
  unitId: string
  previousReading: number
  presentReading: string
  consumption: number
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

export default function ElectricReadingsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [floors, setFloors] = useState<string[]>([])
  const [selectedBuilding, setSelectedBuilding] = useState("ALL")
  const [selectedFloor, setSelectedFloor] = useState("")
  const [billingMonth, setBillingMonth] = useState("")
  const [readings, setReadings] = useState<Record<string, ReadingData>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [billingPeriodInfo, setBillingPeriodInfo] = useState<BillingPeriodInfo | null>(null)

  useEffect(() => {
    fetchUnits()
    fetchFloors()
    fetchBillingPeriodInfo()
  }, [])

  const fetchFloors = async () => {
    try {
      const res = await fetch("/api/floors")
      if (res.ok) {
        const data = await res.json()
        setFloors(data)
      }
    } catch (error) {
      console.error("Error fetching floors:", error)
    }
  }

  const fetchBillingPeriodInfo = async () => {
    try {
      const res = await fetch("/api/billing/next-period")
      if (res.ok) {
        const data = await res.json()
        setBillingPeriodInfo(data)
        // Auto-set to next billing period if history exists, otherwise current month
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

  useEffect(() => {
    if (selectedFloor && billingMonth) {
      loadExistingReadings()
    }
  }, [selectedBuilding, selectedFloor, billingMonth])

  const fetchUnits = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/units")
      if (!res.ok) throw new Error("Failed to fetch units")
      const data = await res.json()
      setUnits(data.filter((u: Unit) => u.isActive))
    } catch (error) {
      toast.error("Failed to load units")
    } finally {
      setLoading(false)
    }
  }

  const loadExistingReadings = async () => {
    if (!selectedFloor || !billingMonth) return

    try {
      setLoading(true)
      const billingPeriod = new Date(billingMonth + "-01")
      const res = await fetch(
        `/api/readings/electric?billingPeriod=${billingPeriod.toISOString()}`
      )
      if (!res.ok) throw new Error("Failed to load readings")

      const existingReadings = await res.json()

      // Initialize readings for selected floor units
      const floorUnits = units.filter((u) => u.floorLevel === selectedFloor)
      const newReadings: Record<string, ReadingData> = {}

      for (const unit of floorUnits) {
        const existing = existingReadings.find((r: any) => r.unitId === unit.id)

        if (existing) {
          newReadings[unit.id] = {
            unitId: unit.id,
            previousReading: parseFloat(existing.previousReading),
            presentReading: existing.presentReading.toString(),
            consumption: parseFloat(existing.consumption),
            remarks: existing.remarks || "",
          }
        } else {
          // Get last reading as previous
          const lastRes = await fetch(
            `/api/readings/electric?unitId=${unit.id}`
          )
          const lastReadings = await lastRes.json()
          const lastReading = lastReadings[0]

          newReadings[unit.id] = {
            unitId: unit.id,
            previousReading: lastReading?.presentReading || 0,
            presentReading: "",
            consumption: 0,
            remarks: "",
          }
        }
      }

      setReadings(newReadings)
    } catch (error) {
      toast.error("Failed to load existing readings")
    } finally {
      setLoading(false)
    }
  }

  const handlePresentReadingChange = (unitId: string, value: string) => {
    const reading = readings[unitId]
    if (!reading) return

    const presentReading = parseFloat(value) || 0
    const consumption = presentReading - reading.previousReading

    setReadings({
      ...readings,
      [unitId]: {
        ...reading,
        presentReading: value,
        consumption: Math.max(0, consumption),
      },
    })
  }

  const handleRemarksChange = (unitId: string, value: string) => {
    setReadings({
      ...readings,
      [unitId]: {
        ...readings[unitId],
        remarks: value,
      },
    })
  }

  const handleSaveAll = async () => {
    if (!billingMonth) {
      toast.error("Please select a billing month")
      return
    }

    // Validate all readings
    const unitsWithReadings = Object.values(readings).filter(
      (r) => r.presentReading !== ""
    )

    if (unitsWithReadings.length === 0) {
      toast.error("Please enter at least one reading")
      return
    }

    // Check for invalid readings
    const invalidReadings = unitsWithReadings.filter(
      (r) => r.consumption < 0
    )

    if (invalidReadings.length > 0) {
      toast.error("Some present readings are less than previous readings")
      return
    }

    try {
      setSaving(true)
      const billingPeriod = new Date(billingMonth + "-01")

      // Save all readings
      const promises = unitsWithReadings.map((reading) =>
        fetch("/api/readings/electric", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            unitId: reading.unitId,
            billingPeriod: billingPeriod.toISOString(),
            presentReading: reading.presentReading,
            remarks: reading.remarks,
          }),
        })
      )

      const results = await Promise.all(promises)
      const failed = results.filter((r) => !r.ok)

      if (failed.length > 0) {
        toast.error(`Failed to save ${failed.length} reading(s)`)
      } else {
        toast.success(`Successfully saved ${unitsWithReadings.length} reading(s)`)
      }

      // Reload readings
      loadExistingReadings()
    } catch (error) {
      toast.error("Failed to save readings")
    } finally {
      setSaving(false)
    }
  }

  // Helper function to extract building prefix from unit number
  // e.g., M1-2F-1 → "M1", M2-2F-1 → "M2"
  const getBuildingPrefix = (unitNumber: string) => {
    const parts = unitNumber.split("-")
    return parts[0] || ""
  }

  // Sort units numerically by extracting the unit number from the end
  // e.g., M2-2F-1 → 1, M2-2F-10 → 10
  const sortUnitsByNumber = (a: Unit, b: Unit) => {
    const getNumericPart = (unitNumber: string) => {
      const parts = unitNumber.split("-")
      const lastPart = parts[parts.length - 1]
      return parseInt(lastPart, 10) || 0
    }
    return getNumericPart(a.unitNumber) - getNumericPart(b.unitNumber)
  }

  const filteredUnits = selectedFloor
    ? units
        .filter((u) => {
          const matchesFloor = u.floorLevel === selectedFloor
          const matchesBuilding =
            selectedBuilding === "ALL" ||
            getBuildingPrefix(u.unitNumber) === selectedBuilding
          return matchesFloor && matchesBuilding
        })
        .sort(sortUnitsByNumber)
    : []

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with Electric theme (Yellow/Orange) */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 rounded-lg p-6 text-white">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 p-3 rounded-lg">
              <Zap className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">
                Electric Meter Readings
              </h1>
              <p className="text-amber-100">
                Enter monthly electric meter readings by floor
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-amber-200">
          <CardHeader className="bg-amber-50">
            <CardTitle className="text-amber-800">Select Building, Floor and Billing Month</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="building">Building / Tower *</Label>
                <Select value={selectedBuilding} onValueChange={setSelectedBuilding}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select building" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Buildings</SelectItem>
                    <SelectItem value="M1">M1 - Megatower 1</SelectItem>
                    <SelectItem value="M2">M2 - Megatower 2</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="floor">Floor Level *</Label>
                <Select value={selectedFloor} onValueChange={setSelectedFloor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select floor" />
                  </SelectTrigger>
                  <SelectContent>
                    {floors.map((floor) => (
                      <SelectItem key={floor} value={floor}>
                        {floor === "GF" ? "Ground Floor" : `${floor} Floor`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

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
                  onClick={loadExistingReadings}
                  disabled={!selectedFloor || !billingMonth || loading}
                  className="w-full"
                >
                  <Calendar className="h-4 w-4 mr-2" />
                  Load Readings
                </Button>
              </div>
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
                      Are you sure you want to enter readings for a different month?
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Readings Table */}
        {selectedFloor && billingMonth && filteredUnits.length > 0 && (
          <Card className="border-amber-200">
            <CardHeader className="flex flex-row items-center justify-between bg-amber-50">
              <div>
                <CardTitle className="text-amber-800">
                  {selectedBuilding === "ALL" ? "All Buildings" : selectedBuilding} - {selectedFloor} - {format(new Date(billingMonth + "-01"), "MMMM yyyy")}
                </CardTitle>
                <p className="text-sm text-gray-500 mt-1">
                  {filteredUnits.length} unit{filteredUnits.length !== 1 ? "s" : ""} {selectedBuilding === "ALL" ? "on this floor" : `in ${selectedBuilding} on this floor`}
                </p>
              </div>
              <Button onClick={handleSaveAll} disabled={saving} className="bg-amber-600 hover:bg-amber-700">
                <Save className="h-4 w-4 mr-2" />
                {saving ? "Saving..." : "Save All Readings"}
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-auto max-h-[calc(100vh-400px)] min-h-[300px]">
                <table className="w-full">
                  <thead className="sticky top-0 z-10 shadow-sm">
                    <tr className="border-b bg-amber-100">
                      <th className="text-left p-3 font-medium text-amber-900 bg-amber-100">Unit</th>
                      <th className="text-left p-3 font-medium text-amber-900 bg-amber-100">Owner</th>
                      <th className="text-right p-3 font-medium text-amber-900 bg-amber-100">Previous</th>
                      <th className="text-right p-3 font-medium text-amber-900 bg-amber-100">Present</th>
                      <th className="text-right p-3 font-medium text-amber-900 bg-amber-100">
                        Consumption (kWh)
                      </th>
                      <th className="text-left p-3 font-medium text-amber-900 bg-amber-100">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnits.map((unit) => {
                      const reading = readings[unit.id]
                      if (!reading) return null

                      return (
                        <tr key={unit.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-medium">{unit.unitNumber}</td>
                          <td className="p-3 text-sm">{unit.owner.name}</td>
                          <td className="p-3 text-right font-mono">
                            {Number(reading.previousReading || 0).toFixed(0)}
                          </td>
                          <td className="p-3">
                            <Input
                              type="number"
                              value={reading.presentReading}
                              onChange={(e) =>
                                handlePresentReadingChange(unit.id, e.target.value)
                              }
                              onWheel={(e) => e.currentTarget.blur()}
                              className="text-right font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              placeholder="0"
                            />
                          </td>
                          <td className="p-3">
                            <div
                              className={`text-right font-mono font-semibold ${
                                reading.consumption < 0
                                  ? "text-red-600"
                                  : "text-green-600"
                              }`}
                            >
                              {reading.consumption.toFixed(2)}
                            </div>
                          </td>
                          <td className="p-3">
                            <Input
                              value={reading.remarks}
                              onChange={(e) =>
                                handleRemarksChange(unit.id, e.target.value)
                              }
                              placeholder="Optional"
                              className="text-sm"
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="bg-amber-100 font-semibold">
                      <td colSpan={4} className="p-3 text-right text-amber-900">
                        Total Consumption:
                      </td>
                      <td className="p-3 text-right font-mono text-amber-700">
                        {Object.values(readings)
                          .reduce((sum, r) => sum + r.consumption, 0)
                          .toFixed(2)}{" "}
                        kWh
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty state */}
        {!selectedFloor || !billingMonth ? (
          <Card className="border-amber-200">
            <CardContent className="flex flex-col items-center justify-center py-12 bg-amber-50">
              <Zap className="h-12 w-12 text-amber-400 mb-4" />
              <p className="text-amber-700">
                Select a floor and billing month to start entering readings
              </p>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  )
}
