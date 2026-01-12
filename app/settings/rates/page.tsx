"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DollarSign,
  Zap,
  Droplet,
  Home,
  Car,
  AlertTriangle,
  Loader2,
  Save,
  Shield,
} from "lucide-react"
import { toast } from "sonner"
import { useSession } from "@/lib/auth-client"

interface RatesData {
  electricRate: string
  electricMinCharge: string
  associationDuesRate: string
  parkingRate: string
  penaltyRate: string
  spAssessmentRate: string
  // Residential water tiers
  waterResTier1Max: string
  waterResTier1Rate: string
  waterResTier2Max: string
  waterResTier2Rate: string
  waterResTier3Max: string
  waterResTier3Rate: string
  waterResTier4Max: string
  waterResTier4Rate: string
  waterResTier5Max: string
  waterResTier5Rate: string
  waterResTier6Max: string
  waterResTier6Rate: string
  waterResTier7Rate: string
  // Commercial water tiers
  waterComTier1Max: string
  waterComTier1Rate: string
  waterComTier2Max: string
  waterComTier2Rate: string
  waterComTier3Max: string
  waterComTier3Rate: string
  waterComTier4Max: string
  waterComTier4Rate: string
  waterComTier5Max: string
  waterComTier5Rate: string
  waterComTier6Max: string
  waterComTier6Rate: string
  waterComTier7Rate: string
}

export default function RatesPage() {
  const [rates, setRates] = useState<RatesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { data: session } = useSession()
  const userRole = (session?.user as any)?.role

  const canEditWaterTiers = userRole === "SUPER_ADMIN"

  useEffect(() => {
    fetchRates()
  }, [])

  const fetchRates = async () => {
    try {
      const res = await fetch("/api/settings/rates")
      if (res.ok) {
        const data = await res.json()
        setRates(data)
      } else {
        toast.error("Failed to load rates")
      }
    } catch (error) {
      console.error("Error fetching rates:", error)
      toast.error("Failed to load rates")
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!rates) return

    setSaving(true)
    try {
      const res = await fetch("/api/settings/rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rates),
      })

      if (res.ok) {
        toast.success("Rates saved successfully")
      } else {
        const error = await res.json()
        toast.error(error.error || "Failed to save rates")
      }
    } catch (error) {
      toast.error("Failed to save rates")
    } finally {
      setSaving(false)
    }
  }

  const updateRate = (field: keyof RatesData, value: string) => {
    if (!rates) return
    setRates({ ...rates, [field]: value })
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </DashboardLayout>
    )
  }

  if (!rates) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900">Failed to load settings</h2>
          <p className="text-gray-600">Please try refreshing the page</p>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <DollarSign className="h-7 w-7 text-blue-600" />
              Rates & Charges
            </h1>
            <p className="text-gray-600">Configure billing rates and charges</p>
          </div>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>

        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 max-w-lg">
            <TabsTrigger value="basic">Basic Rates</TabsTrigger>
            <TabsTrigger value="water-res">Water (Residential)</TabsTrigger>
            <TabsTrigger value="water-com">Water (Commercial)</TabsTrigger>
          </TabsList>

          <TabsContent value="basic">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Electric */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-500" />
                    Electric Rate
                  </CardTitle>
                  <CardDescription>
                    Rate per kWh for electric consumption
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="electricRate">Rate per kWh (PHP)</Label>
                    <Input
                      id="electricRate"
                      type="number"
                      step="0.01"
                      value={rates.electricRate}
                      onChange={(e) => updateRate("electricRate", e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="electricMinCharge">Minimum Charge (PHP)</Label>
                    <Input
                      id="electricMinCharge"
                      type="number"
                      step="0.01"
                      value={rates.electricMinCharge}
                      onChange={(e) => updateRate("electricMinCharge", e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      If consumption × rate is less than this amount, charge this minimum
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Association Dues */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-blue-500" />
                    Association Dues
                  </CardTitle>
                  <CardDescription>
                    Monthly dues based on unit area
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor="associationDuesRate">Rate per sqm (PHP)</Label>
                    <Input
                      id="associationDuesRate"
                      type="number"
                      step="0.01"
                      value={rates.associationDuesRate}
                      onChange={(e) => updateRate("associationDuesRate", e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Formula: Unit Area (sqm) × Rate
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Parking */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-green-500" />
                    Parking Rate
                  </CardTitle>
                  <CardDescription>
                    Monthly parking fee based on area
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label htmlFor="parkingRate">Rate per sqm (PHP)</Label>
                    <Input
                      id="parkingRate"
                      type="number"
                      step="0.01"
                      value={rates.parkingRate}
                      onChange={(e) => updateRate("parkingRate", e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Formula: Parking Area (sqm) × Rate
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Penalty */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-red-500" />
                    Penalty Rate
                  </CardTitle>
                  <CardDescription>
                    Monthly penalty for overdue bills
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label htmlFor="penaltyRate">Rate (decimal)</Label>
                    <Input
                      id="penaltyRate"
                      type="number"
                      step="0.01"
                      value={rates.penaltyRate}
                      onChange={(e) => updateRate("penaltyRate", e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      0.10 = 10% monthly penalty (compounding)
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* SP Assessment (Insurance) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-indigo-500" />
                    SP Assessment (Insurance)
                  </CardTitle>
                  <CardDescription>
                    Flat rate for units enrolled in SP Assessment
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <Label htmlFor="spAssessmentRate">Rate (PHP)</Label>
                    <Input
                      id="spAssessmentRate"
                      type="number"
                      step="0.01"
                      value={rates.spAssessmentRate}
                      onChange={(e) => updateRate("spAssessmentRate", e.target.value)}
                      className="mt-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Applied to units with SP Assessment enabled (Data → Units → Enable SP Assessment)
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="water-res">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplet className="h-5 w-5 text-blue-500" />
                  Residential Water Tiers
                </CardTitle>
                <CardDescription>
                  Water billing uses a tiered pricing system.
                  {!canEditWaterTiers && (
                    <span className="text-amber-600 ml-2">
                      Only SUPER_ADMIN can edit water tiers.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Tier</th>
                        <th className="text-left py-2 px-3">Consumption Range</th>
                        <th className="text-left py-2 px-3">Max (cu.m)</th>
                        <th className="text-left py-2 px-3">Rate (PHP)</th>
                        <th className="text-left py-2 px-3">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5, 6, 7].map((tier) => {
                        const maxField = `waterResTier${tier}Max` as keyof RatesData
                        const rateField = `waterResTier${tier}Rate` as keyof RatesData
                        const isFixed = tier <= 3
                        const ranges = [
                          "0 - 1",
                          "1 - 5",
                          "5 - 10",
                          "10 - 20",
                          "20 - 30",
                          "30 - 40",
                          "40+",
                        ]

                        return (
                          <tr key={tier} className="border-b">
                            <td className="py-2 px-3 font-medium">Tier {tier}</td>
                            <td className="py-2 px-3 text-gray-600">{ranges[tier - 1]} cu.m</td>
                            <td className="py-2 px-3">
                              {tier < 7 ? (
                                <Input
                                  type="number"
                                  step="1"
                                  value={rates[maxField]}
                                  onChange={(e) => updateRate(maxField, e.target.value)}
                                  disabled={!canEditWaterTiers}
                                  className="w-20 h-8"
                                />
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                type="number"
                                step="0.01"
                                value={rates[rateField]}
                                onChange={(e) => updateRate(rateField, e.target.value)}
                                disabled={!canEditWaterTiers}
                                className="w-24 h-8"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-1 rounded ${isFixed ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                                {isFixed ? "Fixed" : "Per cu.m"}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Tiers 1-3 are fixed amounts. Tiers 4-7 charge per cubic meter above the previous tier base.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="water-com">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Droplet className="h-5 w-5 text-purple-500" />
                  Commercial Water Tiers
                </CardTitle>
                <CardDescription>
                  Higher rates for commercial units.
                  {!canEditWaterTiers && (
                    <span className="text-amber-600 ml-2">
                      Only SUPER_ADMIN can edit water tiers.
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Tier</th>
                        <th className="text-left py-2 px-3">Consumption Range</th>
                        <th className="text-left py-2 px-3">Max (cu.m)</th>
                        <th className="text-left py-2 px-3">Rate (PHP)</th>
                        <th className="text-left py-2 px-3">Type</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[1, 2, 3, 4, 5, 6, 7].map((tier) => {
                        const maxField = `waterComTier${tier}Max` as keyof RatesData
                        const rateField = `waterComTier${tier}Rate` as keyof RatesData
                        const isFixed = tier <= 3
                        const ranges = [
                          "0 - 1",
                          "1 - 5",
                          "5 - 10",
                          "10 - 20",
                          "20 - 30",
                          "30 - 40",
                          "40+",
                        ]

                        return (
                          <tr key={tier} className="border-b">
                            <td className="py-2 px-3 font-medium">Tier {tier}</td>
                            <td className="py-2 px-3 text-gray-600">{ranges[tier - 1]} cu.m</td>
                            <td className="py-2 px-3">
                              {tier < 7 ? (
                                <Input
                                  type="number"
                                  step="1"
                                  value={rates[maxField]}
                                  onChange={(e) => updateRate(maxField, e.target.value)}
                                  disabled={!canEditWaterTiers}
                                  className="w-20 h-8"
                                />
                              ) : (
                                <span className="text-gray-500">-</span>
                              )}
                            </td>
                            <td className="py-2 px-3">
                              <Input
                                type="number"
                                step="0.01"
                                value={rates[rateField]}
                                onChange={(e) => updateRate(rateField, e.target.value)}
                                disabled={!canEditWaterTiers}
                                className="w-24 h-8"
                              />
                            </td>
                            <td className="py-2 px-3">
                              <span className={`text-xs px-2 py-1 rounded ${isFixed ? "bg-purple-100 text-purple-700" : "bg-green-100 text-green-700"}`}>
                                {isFixed ? "Fixed" : "Per cu.m"}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 mt-4">
                  Commercial rates are higher than residential rates.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  )
}
