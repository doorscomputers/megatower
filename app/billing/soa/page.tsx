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
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { FileText, Printer, Users, Building2, Archive, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
import Link from "next/link"

interface Unit {
  id: string
  unitNumber: string
  floorLevel: string
  isActive: boolean
  owner: {
    name: string
  }
}

interface PaymentBreakdown {
  component: string
  orNumber: string | null
  amount: number
}

interface SOAData {
  asOfDate: string
  unit: {
    id: string
    unitNumber: string
    floorLevel: string
    area: number
    unitType: string
  }
  owner: {
    id: string
    name: string
    email: string | null
    phone: string | null
    address: string | null
  }
  summary: {
    totalBilled: number
    totalPaid: number
    currentBalance: number
    billsCount: number
    paymentsCount: number
    unpaidBillsCount: number
  }
  aging: {
    current: number
    days31to60: number
    days61to90: number
    over90: number
  }
  paymentBreakdown?: PaymentBreakdown[]
  transactions: Array<{
    date: string
    type: "BILL" | "PAYMENT"
    description: string
    billNumber?: string
    reference?: string
    debit: number
    credit: number
    balance: number
    details?: any
  }>
}

interface BatchSOAData {
  asOfDate: string
  filter: string
  floor: string | null
  overallSummary: {
    totalUnits: number
    totalBilled: number
    totalPaid: number
    totalBalance: number
    unitsWithBalance: number
  }
  soaList: SOAData[]
}

export default function SOAGeneratorPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [floors, setFloors] = useState<string[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState("")
  const [asOfDate, setAsOfDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [loading, setLoading] = useState(false)
  const [soa, setSOA] = useState<SOAData | null>(null)

  // Batch mode state
  const [batchFilter, setBatchFilter] = useState("with_balance")
  const [batchFloor, setBatchFloor] = useState("")
  const [batchBuilding, setBatchBuilding] = useState("")
  const [batchData, setBatchData] = useState<BatchSOAData | null>(null)
  const [archiveBatch, setArchiveBatch] = useState<{ id: string; batchNumber: string } | null>(null)
  const [savingToArchive, setSavingToArchive] = useState(false)

  useEffect(() => {
    fetchUnits()
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
    }
  }

  const fetchUnits = async () => {
    try {
      const res = await fetch("/api/units")
      if (!res.ok) throw new Error("Failed to fetch units")
      const data = await res.json()
      setUnits(data.filter((u: Unit) => u.isActive))
    } catch (error) {
      toast.error("Failed to load units")
    }
  }

  const handleGenerate = async () => {
    if (!selectedUnitId) {
      toast.error("Please select a unit")
      return
    }

    try {
      setLoading(true)
      const res = await fetch(
        `/api/billing/soa?unitId=${selectedUnitId}&asOfDate=${asOfDate}`
      )

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to generate SOA")
      }

      const data = await res.json()
      setSOA(data)
      toast.success("SOA generated successfully")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleBatchGenerate = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({
        filter: batchFilter,
        asOfDate: asOfDate,
      })
      if (batchFilter === "floor" && batchFloor) {
        params.set("floor", batchFloor)
      }
      if (batchFilter === "building" && batchBuilding) {
        params.set("building", batchBuilding)
      }

      const res = await fetch(`/api/billing/soa/batch?${params}`)

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to generate batch SOA")
      }

      const data = await res.json()
      setBatchData(data)
      toast.success(`Generated SOA for ${data.soaList.length} unit(s)`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateAndArchive = async () => {
    try {
      setSavingToArchive(true)
      setArchiveBatch(null)

      // Determine filter type for archive API
      let filterType = "ALL"
      let filterValue = null

      if (batchFilter === "building" && batchBuilding) {
        filterType = "BUILDING"
        filterValue = batchBuilding
      } else if (batchFilter === "floor" && batchFloor) {
        filterType = "FLOOR"
        filterValue = batchFloor
      } else if (batchFilter === "with_balance") {
        filterType = "ALL" // API will include all, UI filters by balance
      }

      const res = await fetch("/api/billing/soa/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filterType,
          filterValue,
          asOfDate: asOfDate,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to generate and archive SOA")
      }

      const data = await res.json()
      setArchiveBatch(data.batch)

      // Also generate batch data for display
      await handleBatchGenerate()

      toast.success(`SOA batch ${data.batch.batchNumber} saved to archive!`)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSavingToArchive(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  const renderSingleSOA = (soaData: SOAData, showHeader = true) => (
    <div className="bg-white p-4 md:p-8 rounded-lg border border-gray-200 mb-6 break-inside-avoid">
      {showHeader && (
        <div className="text-center mb-6">
          <h2 className="text-xl md:text-2xl font-bold text-gray-900">
            MEGA TOWER RESIDENCES
          </h2>
          <p className="text-gray-600">Condominium Corporation</p>
          <p className="text-sm text-gray-500 mt-2">Statement of Account</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-6">
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Unit Information</h3>
          <div className="text-sm space-y-1">
            <p><span className="font-medium">Unit Number:</span> {soaData.unit.unitNumber}</p>
            <p><span className="font-medium">Floor:</span> {soaData.unit.floorLevel}</p>
            <p><span className="font-medium">Area:</span> {soaData.unit.area} sqm</p>
            <p><span className="font-medium">Type:</span> {soaData.unit.unitType}</p>
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 mb-2">Owner Information</h3>
          <div className="text-sm space-y-1">
            <p><span className="font-medium">Name:</span> {soaData.owner.name}</p>
            {soaData.owner.email && <p><span className="font-medium">Email:</span> {soaData.owner.email}</p>}
            {soaData.owner.phone && <p><span className="font-medium">Phone:</span> {soaData.owner.phone}</p>}
          </div>
        </div>
      </div>

      <div className="border-t pt-4 mb-6">
        <p className="text-sm text-gray-600">
          <span className="font-medium">As of Date:</span> {soaData.asOfDate ? format(new Date(soaData.asOfDate), "MMMM dd, yyyy") : format(new Date(), "MMMM dd, yyyy")}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-6">
        <div className="bg-blue-50 p-3 md:p-4 rounded-lg border border-blue-200">
          <p className="text-xs md:text-sm text-blue-600 font-medium">Total Billed</p>
          <p className="text-lg md:text-xl font-bold text-blue-900">{formatCurrency(soaData.summary.totalBilled)}</p>
        </div>
        <div className="bg-green-50 p-3 md:p-4 rounded-lg border border-green-200">
          <p className="text-xs md:text-sm text-green-600 font-medium">Total Paid</p>
          <p className="text-lg md:text-xl font-bold text-green-900">{formatCurrency(soaData.summary.totalPaid)}</p>
        </div>
        <div className={`p-3 md:p-4 rounded-lg border ${soaData.summary.currentBalance > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"}`}>
          <p className={`text-xs md:text-sm font-medium ${soaData.summary.currentBalance > 0 ? "text-red-600" : "text-gray-600"}`}>Balance</p>
          <p className={`text-lg md:text-xl font-bold ${soaData.summary.currentBalance > 0 ? "text-red-900" : "text-gray-900"}`}>
            {formatCurrency(soaData.summary.currentBalance)}
          </p>
        </div>
        <div className="bg-purple-50 p-3 md:p-4 rounded-lg border border-purple-200">
          <p className="text-xs md:text-sm text-purple-600 font-medium">Status</p>
          <div className="mt-1">
            {soaData.summary.currentBalance === 0 ? (
              <Badge className="bg-green-500 text-white">Paid</Badge>
            ) : soaData.summary.currentBalance > 0 ? (
              <Badge variant="danger">Outstanding</Badge>
            ) : (
              <Badge variant="secondary">Overpaid</Badge>
            )}
          </div>
        </div>
      </div>

      {/* Payment Breakdown Section */}
      {soaData.paymentBreakdown && soaData.paymentBreakdown.length > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Payment Breakdown</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-green-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-green-800">Component</th>
                  <th className="text-left p-3 font-medium text-green-800">OR #</th>
                  <th className="text-right p-3 font-medium text-green-800">Amount</th>
                </tr>
              </thead>
              <tbody>
                {soaData.paymentBreakdown.map((item, index) => (
                  <tr key={index} className="border-b last:border-b-0 hover:bg-gray-50">
                    <td className="p-3">{item.component}</td>
                    <td className="p-3 font-mono text-gray-600">
                      {item.orNumber ? `OR# ${item.orNumber}` : "-"}
                    </td>
                    <td className="p-3 text-right font-mono">
                      {item.amount > 0 ? formatCurrency(item.amount) : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-green-100 font-semibold">
                <tr>
                  <td colSpan={2} className="p-3 text-right">TOTAL PAYMENT</td>
                  <td className="p-3 text-right font-mono text-green-700">
                    {formatCurrency(soaData.paymentBreakdown.reduce((sum, item) => sum + item.amount, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {soaData.summary.currentBalance > 0 && (
        <div className="mb-6">
          <h3 className="font-semibold text-gray-900 mb-3">Aging Analysis</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <div className="border rounded-lg p-3">
              <p className="text-xs text-gray-600">Current (0-30 days)</p>
              <p className="text-base md:text-lg font-semibold text-gray-900">{formatCurrency(soaData.aging.current)}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-gray-600">31-60 days</p>
              <p className="text-base md:text-lg font-semibold text-yellow-700">{formatCurrency(soaData.aging.days31to60)}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-gray-600">61-90 days</p>
              <p className="text-base md:text-lg font-semibold text-orange-700">{formatCurrency(soaData.aging.days61to90)}</p>
            </div>
            <div className="border rounded-lg p-3">
              <p className="text-xs text-gray-600">Over 90 days</p>
              <p className="text-base md:text-lg font-semibold text-red-700">{formatCurrency(soaData.aging.over90)}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h3 className="font-semibold text-gray-900 mb-3">Transaction History</h3>
        <div className="overflow-x-auto -mx-4 md:mx-0">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Description</th>
                <th className="text-left p-3 font-medium">Reference</th>
                <th className="text-right p-3 font-medium">Debit</th>
                <th className="text-right p-3 font-medium">Credit</th>
                <th className="text-right p-3 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {soaData.transactions.map((transaction, index) => (
                <tr key={index} className={`border-b ${transaction.type === "BILL" ? "bg-red-50" : "bg-green-50"}`}>
                  <td className="p-3">{format(new Date(transaction.date), "MMM dd, yyyy")}</td>
                  <td className="p-3">{transaction.description}</td>
                  <td className="p-3 text-xs text-gray-600">{transaction.billNumber || transaction.reference || "-"}</td>
                  <td className="p-3 text-right font-mono text-red-600">{transaction.debit > 0 ? formatCurrency(transaction.debit) : "-"}</td>
                  <td className="p-3 text-right font-mono text-green-600">{transaction.credit > 0 ? formatCurrency(transaction.credit) : "-"}</td>
                  <td className="p-3 text-right font-mono font-semibold">{formatCurrency(transaction.balance)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-semibold">
              <tr>
                <td colSpan={3} className="p-3 text-right">Total:</td>
                <td className="p-3 text-right font-mono text-red-600">{formatCurrency(soaData.summary.totalBilled)}</td>
                <td className="p-3 text-right font-mono text-green-600">{formatCurrency(soaData.summary.totalPaid)}</td>
                <td className="p-3 text-right font-mono text-blue-600">{formatCurrency(soaData.summary.currentBalance)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="mt-8 pt-6 border-t text-center text-xs text-gray-500">
        <p>This is a computer-generated statement. No signature required.</p>
        <p className="mt-1">Generated on {format(new Date(), "MMMM dd, yyyy 'at' h:mm a")}</p>
      </div>
    </div>
  )

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="print:hidden">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Statement of Account</h1>
          <p className="text-gray-500">Generate detailed billing statements for unit owners</p>
        </div>

        {/* Mode Selection */}
        <Tabs defaultValue="single" className="print:hidden">
          <TabsList className="grid w-full grid-cols-2 max-w-md">
            <TabsTrigger value="single" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Single Unit
            </TabsTrigger>
            <TabsTrigger value="batch" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Batch Generate
            </TabsTrigger>
          </TabsList>

          {/* Single Unit Mode */}
          <TabsContent value="single">
            <Card>
              <CardHeader>
                <CardTitle>Generate SOA</CardTitle>
                <CardDescription>Generate statement for a single unit</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="unit">Select Unit *</Label>
                    <SearchableSelect
                      options={units.map((unit) => ({
                        value: unit.id,
                        label: `${unit.unitNumber} - ${unit.owner?.name || "No Owner"}`,
                        sublabel: `Floor: ${unit.floorLevel}`,
                      }))}
                      value={selectedUnitId}
                      onValueChange={setSelectedUnitId}
                      placeholder="Search unit or owner..."
                      searchPlaceholder="Type unit number or owner name..."
                      emptyMessage="No units found."
                    />
                  </div>
                  <div>
                    <Label htmlFor="asOfDate">As of Date *</Label>
                    <Input
                      id="asOfDate"
                      type="date"
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button onClick={handleGenerate} disabled={!selectedUnitId || loading} className="w-full">
                      <FileText className="h-4 w-4 mr-2" />
                      {loading ? "Generating..." : "Generate SOA"}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Batch Mode */}
          <TabsContent value="batch">
            <Card>
              <CardHeader>
                <CardTitle>Batch Generate SOA</CardTitle>
                <CardDescription>Generate statements for multiple units at once</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label>Filter</Label>
                    <Select value={batchFilter} onValueChange={(value) => {
                        setBatchFilter(value)
                        setBatchFloor("")
                        setBatchBuilding("")
                      }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Units</SelectItem>
                        <SelectItem value="with_balance">With Balance Only</SelectItem>
                        <SelectItem value="building">By Building</SelectItem>
                        <SelectItem value="floor">By Floor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {batchFilter === "building" && (
                    <div>
                      <Label>Building</Label>
                      <Select value={batchBuilding} onValueChange={setBatchBuilding}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select building" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M1">M1 - Mega Tower 1</SelectItem>
                          <SelectItem value="M2">M2 - Mega Tower 2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {batchFilter === "floor" && (
                    <div>
                      <Label>Floor Level</Label>
                      <Select value={batchFloor} onValueChange={setBatchFloor}>
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
                  )}
                  <div>
                    <Label htmlFor="batchAsOfDate">As of Date *</Label>
                    <Input
                      id="batchAsOfDate"
                      type="date"
                      value={asOfDate}
                      onChange={(e) => setAsOfDate(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      variant="outline"
                      onClick={handleBatchGenerate}
                      disabled={loading || savingToArchive || (batchFilter === "floor" && !batchFloor) || (batchFilter === "building" && !batchBuilding)}
                    >
                      <Users className="h-4 w-4 mr-2" />
                      {loading ? "Generating..." : "Preview"}
                    </Button>
                    <Button
                      onClick={handleGenerateAndArchive}
                      disabled={loading || savingToArchive || (batchFilter === "floor" && !batchFloor) || (batchFilter === "building" && !batchBuilding)}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      <Archive className="h-4 w-4 mr-2" />
                      {savingToArchive ? "Saving..." : "Generate & Archive"}
                    </Button>
                  </div>
                </div>

                {/* Archive Success Message */}
                {archiveBatch && (
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-green-700">
                        <Archive className="h-5 w-5" />
                        <span className="font-medium">
                          Batch {archiveBatch.batchNumber} saved to archive!
                        </span>
                      </div>
                      <Link href="/billing/soa/archive">
                        <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-100">
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View in Archive
                        </Button>
                      </Link>
                    </div>
                    <p className="text-sm text-green-600 mt-2">
                      Go to the archive to distribute this batch and lock the bills.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Print Button */}
        {(soa || batchData) && (
          <div className="flex justify-end print:hidden">
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print SOA{batchData ? "s" : ""}
            </Button>
          </div>
        )}

        {/* Single SOA Display */}
        {soa && !batchData && renderSingleSOA(soa)}

        {/* Batch SOA Display */}
        {batchData && (
          <>
            {/* Batch Summary */}
            <Card className="print:hidden">
              <CardHeader>
                <CardTitle>Batch Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-600">Total Units</p>
                    <p className="text-2xl font-bold text-blue-900">{batchData.overallSummary.totalUnits}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <p className="text-sm text-purple-600">With Balance</p>
                    <p className="text-2xl font-bold text-purple-900">{batchData.overallSummary.unitsWithBalance}</p>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-sm text-gray-600">Total Billed</p>
                    <p className="text-xl font-bold text-gray-900">{formatCurrency(batchData.overallSummary.totalBilled)}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-green-600">Total Paid</p>
                    <p className="text-xl font-bold text-green-900">{formatCurrency(batchData.overallSummary.totalPaid)}</p>
                  </div>
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-sm text-red-600">Total Balance</p>
                    <p className="text-xl font-bold text-red-900">{formatCurrency(batchData.overallSummary.totalBalance)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Individual SOAs */}
            {batchData.soaList.map((soaItem, index) => (
              <div key={soaItem.unit.id} className="print:break-before-page">
                {renderSingleSOA(soaItem, true)}
              </div>
            ))}
          </>
        )}

        {/* Empty State */}
        {!soa && !batchData && (
          <Card className="print:hidden">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                Select a unit or use batch mode to generate Statement of Account
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
