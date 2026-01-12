"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Building2,
  Plus,
  Loader2,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"

const DEFAULT_FLOORS = ["GF", "2F", "3F", "4F", "5F", "6F"]

export default function FloorManagementPage() {
  const [floors, setFloors] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [newFloor, setNewFloor] = useState("")
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    fetchFloors()
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
      toast.error("Failed to load floors")
    } finally {
      setLoading(false)
    }
  }

  const handleAddFloor = async () => {
    if (!newFloor.trim()) {
      toast.error("Please enter a floor name")
      return
    }

    setAdding(true)
    try {
      const res = await fetch("/api/floors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floorName: newFloor }),
      })

      if (res.ok) {
        toast.success(`Floor "${newFloor.toUpperCase()}" added successfully`)
        setNewFloor("")
        fetchFloors()
      } else {
        const error = await res.json()
        toast.error(error.error || "Failed to add floor")
      }
    } catch (error) {
      toast.error("Failed to add floor")
    } finally {
      setAdding(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="h-7 w-7 text-blue-600" />
            Floor Management
          </h1>
          <p className="text-gray-600">Manage floor levels for units in your building</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Add New Floor */}
          <Card>
            <CardHeader>
              <CardTitle>Add New Floor</CardTitle>
              <CardDescription>
                Add additional floor levels beyond the defaults (GF, 2F-6F)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="floorName">Floor Name</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="floorName"
                      placeholder="e.g., 7F, B1, ROOF, MEZZ"
                      value={newFloor}
                      onChange={(e) => setNewFloor(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddFloor()}
                      disabled={adding}
                    />
                    <Button onClick={handleAddFloor} disabled={adding || !newFloor.trim()}>
                      {adding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Floor names will be converted to uppercase automatically
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex gap-2 text-blue-700">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium">Tips for floor naming:</p>
                      <ul className="mt-1 space-y-1 list-disc list-inside text-blue-600">
                        <li><strong>7F, 8F, 9F</strong> - Additional upper floors</li>
                        <li><strong>B1, B2</strong> - Basement levels</li>
                        <li><strong>ROOF, PH</strong> - Rooftop/Penthouse</li>
                        <li><strong>MEZZ, LG</strong> - Mezzanine/Lower Ground</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Floors */}
          <Card>
            <CardHeader>
              <CardTitle>Current Floors</CardTitle>
              <CardDescription>
                All available floor levels in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-2">Default Floors</p>
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_FLOORS.map((floor) => (
                        <Badge key={floor} variant="outline" className="bg-gray-100">
                          {floor}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {floors.filter(f => !DEFAULT_FLOORS.includes(f)).length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-gray-600 mb-2">Custom Floors</p>
                      <div className="flex flex-wrap gap-2">
                        {floors.filter(f => !DEFAULT_FLOORS.includes(f)).map((floor) => (
                          <Badge key={floor} className="bg-blue-100 text-blue-700 border-blue-200">
                            {floor}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-4 border-t">
                    <p className="text-sm text-gray-500">
                      Total: <strong>{floors.length}</strong> floor level(s)
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
