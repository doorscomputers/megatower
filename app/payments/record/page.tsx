"use client"

import { useEffect, useState } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Receipt, Zap, Droplet, Building2, Clock, Shield, CreditCard, Wallet } from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface Unit {
  id: string
  unitNumber: string
  floorLevel: string
  owner: {
    name: string
  }
}

interface OutstandingBalance {
  electric: number
  water: number
  dues: number
  pastDues: number
  spAssessment: number
  total: number
}

interface ComponentAmounts {
  electricAmount: string
  waterAmount: string
  duesAmount: string
  pastDuesAmount: string
  spAssessmentAmount: string
  advanceDuesAmount: string
  advanceUtilAmount: string
  otherAdvanceAmount: string
}

const PAYMENT_METHODS = [
  { value: "CASH", label: "Cash" },
  { value: "CHECK", label: "Check" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "GCASH", label: "GCash" },
  { value: "PAYMAYA", label: "PayMaya" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD", label: "Debit Card" },
]

export default function RecordPaymentPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [selectedUnitId, setSelectedUnitId] = useState("")
  const [outstanding, setOutstanding] = useState<OutstandingBalance | null>(null)

  // Payment form fields
  const [orNumber, setOrNumber] = useState("")
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [paymentMethod, setPaymentMethod] = useState("")
  const [referenceNumber, setReferenceNumber] = useState("")
  const [checkNumber, setCheckNumber] = useState("")
  const [checkDate, setCheckDate] = useState("")
  const [bankName, setBankName] = useState("")
  const [remarks, setRemarks] = useState("")

  // Component amounts
  const [amounts, setAmounts] = useState<ComponentAmounts>({
    electricAmount: "",
    waterAmount: "",
    duesAmount: "",
    pastDuesAmount: "",
    spAssessmentAmount: "",
    advanceDuesAmount: "",
    advanceUtilAmount: "",
    otherAdvanceAmount: "",
  })

  const [loading, setLoading] = useState(false)
  const [loadingOutstanding, setLoadingOutstanding] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchUnits()
  }, [])

  useEffect(() => {
    if (selectedUnitId) {
      fetchOutstanding(selectedUnitId)
    } else {
      setOutstanding(null)
      resetAmounts()
    }
  }, [selectedUnitId])

  const resetAmounts = () => {
    setAmounts({
      electricAmount: "",
      waterAmount: "",
      duesAmount: "",
      pastDuesAmount: "",
      spAssessmentAmount: "",
      advanceDuesAmount: "",
      advanceUtilAmount: "",
      otherAdvanceAmount: "",
    })
  }

  const fetchUnits = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/units")
      if (!res.ok) throw new Error("Failed to fetch units")
      const data = await res.json()
      setUnits(data.filter((u: any) => u.isActive !== false))
    } catch (error) {
      toast.error("Failed to load units")
    } finally {
      setLoading(false)
    }
  }

  const fetchOutstanding = async (unitId: string) => {
    try {
      setLoadingOutstanding(true)
      const res = await fetch(`/api/payments/outstanding?unitId=${unitId}`)
      if (!res.ok) throw new Error("Failed to fetch outstanding balance")
      const data = await res.json()
      setOutstanding(data)
    } catch (error) {
      toast.error("Failed to load outstanding balance")
      setOutstanding(null)
    } finally {
      setLoadingOutstanding(false)
    }
  }

  const handleAmountChange = (field: keyof ComponentAmounts, value: string) => {
    setAmounts((prev) => ({ ...prev, [field]: value }))
  }

  const calculateTotal = () => {
    return Object.values(amounts).reduce((sum, val) => {
      const num = parseFloat(val) || 0
      return sum + num
    }, 0)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedUnitId || !orNumber || !paymentDate || !paymentMethod) {
      toast.error("Please fill in all required fields")
      return
    }

    const total = calculateTotal()
    if (total <= 0) {
      toast.error("Please enter at least one payment amount")
      return
    }

    try {
      setSaving(true)
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: selectedUnitId,
          orNumber,
          paymentDate,
          paymentMethod,
          referenceNumber: referenceNumber || null,
          checkNumber: checkNumber || null,
          checkDate: checkDate || null,
          bankName: bankName || null,
          remarks: remarks || null,
          // Component amounts
          electricAmount: parseFloat(amounts.electricAmount) || 0,
          waterAmount: parseFloat(amounts.waterAmount) || 0,
          duesAmount: parseFloat(amounts.duesAmount) || 0,
          pastDuesAmount: parseFloat(amounts.pastDuesAmount) || 0,
          spAssessmentAmount: parseFloat(amounts.spAssessmentAmount) || 0,
          advanceDuesAmount: parseFloat(amounts.advanceDuesAmount) || 0,
          advanceUtilAmount: parseFloat(amounts.advanceUtilAmount) || 0,
          otherAdvanceAmount: parseFloat(amounts.otherAdvanceAmount) || 0,
        }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to record payment")
      }

      const result = await res.json()
      toast.success(result.message || "Payment recorded successfully")

      // Reset form
      setOrNumber("")
      setPaymentMethod("")
      setReferenceNumber("")
      setCheckNumber("")
      setCheckDate("")
      setBankName("")
      setRemarks("")
      setPaymentDate(format(new Date(), "yyyy-MM-dd"))
      resetAmounts()

      // Refresh outstanding
      if (selectedUnitId) {
        fetchOutstanding(selectedUnitId)
      }
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    }).format(amount)
  }

  const showCheckFields = paymentMethod === "CHECK"

  const componentRows = [
    {
      key: "electricAmount",
      label: "Electric",
      icon: Zap,
      outstanding: outstanding?.electric || 0,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      key: "waterAmount",
      label: "Water",
      icon: Droplet,
      outstanding: outstanding?.water || 0,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      key: "duesAmount",
      label: "Association Dues",
      icon: Building2,
      outstanding: outstanding?.dues || 0,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      key: "pastDuesAmount",
      label: "Past Dues / Penalty",
      icon: Clock,
      outstanding: outstanding?.pastDues || 0,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      key: "spAssessmentAmount",
      label: "SP Assessment",
      icon: Shield,
      outstanding: outstanding?.spAssessment || 0,
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
  ]

  const advanceRows = [
    {
      key: "advanceDuesAmount",
      label: "Advance (Dues)",
      icon: CreditCard,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      key: "advanceUtilAmount",
      label: "Advance (Utilities)",
      icon: CreditCard,
      color: "text-teal-600",
      bgColor: "bg-teal-50",
    },
    {
      key: "otherAdvanceAmount",
      label: "Other Advance",
      icon: Wallet,
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Record Payment</h1>
          <p className="text-gray-500">
            Enter payment amounts per component with OR# tracking
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Payment Form - Left Column */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Top Row - Unit, OR#, Date, Method */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Unit Selection */}
                    <div>
                      <Label htmlFor="unit">Select Unit *</Label>
                      <SearchableSelect
                        options={units.map((unit) => {
                          // Extract building prefix from unit number (e.g., "M1" from "M1-2F-5")
                          const buildingMatch = unit.unitNumber.match(/^([A-Z]+\d*)-/)
                          const building = buildingMatch ? buildingMatch[1] : ""
                          return {
                            value: unit.id,
                            label: `${unit.unitNumber} - ${unit.owner?.name || "No Owner"}`,
                            sublabel: building ? `Building: ${building} | Floor: ${unit.floorLevel}` : `Floor: ${unit.floorLevel}`,
                          }
                        })}
                        value={selectedUnitId}
                        onValueChange={setSelectedUnitId}
                        placeholder="Search unit or owner..."
                        searchPlaceholder="Type unit number or owner name..."
                        emptyMessage="No units found."
                      />
                    </div>

                    {/* OR Number */}
                    <div>
                      <Label htmlFor="orNumber">OR# (Official Receipt) *</Label>
                      <Input
                        id="orNumber"
                        value={orNumber}
                        onChange={(e) => setOrNumber(e.target.value)}
                        placeholder="e.g., 21325"
                        required
                      />
                    </div>

                    {/* Payment Date */}
                    <div>
                      <Label htmlFor="paymentDate">Payment Date *</Label>
                      <Input
                        id="paymentDate"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        required
                      />
                    </div>

                    {/* Payment Method */}
                    <div>
                      <Label htmlFor="paymentMethod">Payment Method *</Label>
                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          {PAYMENT_METHODS.map((method) => (
                            <SelectItem key={method.value} value={method.value}>
                              {method.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Check-specific fields */}
                  {showCheckFields && (
                    <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
                      <div>
                        <Label htmlFor="checkNumber">Check Number</Label>
                        <Input
                          id="checkNumber"
                          value={checkNumber}
                          onChange={(e) => setCheckNumber(e.target.value)}
                          placeholder="Check #"
                        />
                      </div>
                      <div>
                        <Label htmlFor="checkDate">Check Date</Label>
                        <Input
                          id="checkDate"
                          type="date"
                          value={checkDate}
                          onChange={(e) => setCheckDate(e.target.value)}
                        />
                      </div>
                      <div>
                        <Label htmlFor="bankName">Bank Name</Label>
                        <Input
                          id="bankName"
                          value={bankName}
                          onChange={(e) => setBankName(e.target.value)}
                          placeholder="e.g., Metrobank"
                        />
                      </div>
                    </div>
                  )}

                  {/* Reference Number for non-cash/check */}
                  {paymentMethod && paymentMethod !== "CASH" && paymentMethod !== "CHECK" && (
                    <div>
                      <Label htmlFor="referenceNumber">Reference Number</Label>
                      <Input
                        id="referenceNumber"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="Transaction reference"
                      />
                    </div>
                  )}

                  {/* Component Amounts Table */}
                  <div className="border rounded-lg overflow-hidden">
                    <div className="bg-gray-100 px-4 py-2 font-semibold text-sm grid grid-cols-3 gap-4">
                      <span>Component</span>
                      <span className="text-right">Outstanding</span>
                      <span className="text-right">Amount Paid</span>
                    </div>

                    {/* Regular components */}
                    {componentRows.map((row) => {
                      const Icon = row.icon
                      return (
                        <div
                          key={row.key}
                          className={`px-4 py-3 grid grid-cols-3 gap-4 items-center border-t ${row.bgColor}`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${row.color}`} />
                            <span className="font-medium text-sm">{row.label}</span>
                          </div>
                          <div className="text-right">
                            {loadingOutstanding ? (
                              <span className="text-gray-400">...</span>
                            ) : (
                              <span className={row.outstanding > 0 ? "text-red-600 font-medium" : "text-gray-400"}>
                                {formatCurrency(row.outstanding)}
                              </span>
                            )}
                          </div>
                          <div>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={amounts[row.key as keyof ComponentAmounts]}
                              onChange={(e) =>
                                handleAmountChange(row.key as keyof ComponentAmounts, e.target.value)
                              }
                              placeholder="0.00"
                              className="text-right"
                              onWheel={(e) => e.currentTarget.blur()}
                            />
                          </div>
                        </div>
                      )
                    })}

                    {/* Separator */}
                    <div className="bg-gray-200 px-4 py-2 text-xs text-gray-600 font-medium">
                      ADVANCE PAYMENTS (Credit for future bills)
                    </div>

                    {/* Advance components */}
                    {advanceRows.map((row) => {
                      const Icon = row.icon
                      return (
                        <div
                          key={row.key}
                          className={`px-4 py-3 grid grid-cols-3 gap-4 items-center border-t ${row.bgColor}`}
                        >
                          <div className="flex items-center gap-2">
                            <Icon className={`h-4 w-4 ${row.color}`} />
                            <span className="font-medium text-sm">{row.label}</span>
                          </div>
                          <div className="text-right text-gray-400 text-sm">Credit</div>
                          <div>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              value={amounts[row.key as keyof ComponentAmounts]}
                              onChange={(e) =>
                                handleAmountChange(row.key as keyof ComponentAmounts, e.target.value)
                              }
                              placeholder="0.00"
                              className="text-right"
                              onWheel={(e) => e.currentTarget.blur()}
                            />
                          </div>
                        </div>
                      )
                    })}

                    {/* Total */}
                    <div className="bg-blue-600 text-white px-4 py-3 grid grid-cols-3 gap-4 items-center">
                      <span className="font-bold">TOTAL THIS RECEIPT</span>
                      <span></span>
                      <span className="text-right font-bold text-lg">
                        {formatCurrency(calculateTotal())}
                      </span>
                    </div>
                  </div>

                  {/* Remarks */}
                  <div>
                    <Label htmlFor="remarks">Remarks (Optional)</Label>
                    <Textarea
                      id="remarks"
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Additional notes"
                      rows={2}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={saving || !selectedUnitId || !orNumber || calculateTotal() <= 0}
                  >
                    <Receipt className="h-4 w-4 mr-2" />
                    {saving ? "Recording..." : "Record Payment"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Summary and Help */}
          <div className="space-y-4">
            {/* Outstanding Summary */}
            {selectedUnitId && outstanding && (
              <Card className="border-red-200 bg-red-50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-red-800 text-lg">Total Outstanding</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold text-red-600">
                    {formatCurrency(outstanding.total)}
                  </p>
                  <p className="text-sm text-red-600 mt-1">
                    From all unpaid bills
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Payment Info Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-blue-900 mb-2">Payment Notes</h3>
                <ul className="text-sm text-blue-800 space-y-2">
                  <li>• Each OR# = One receipt (unique per payment)</li>
                  <li>• Enter amount for each component being paid</li>
                  <li>• Advance payments become credit for future bills</li>
                  <li>• Partial payments apply to oldest bills first (FIFO)</li>
                </ul>
              </CardContent>
            </Card>

            {/* Multiple Receipts Info */}
            <Card className="bg-amber-50 border-amber-200">
              <CardContent className="pt-6">
                <h3 className="font-semibold text-amber-900 mb-2">Multiple Receipts?</h3>
                <p className="text-sm text-amber-800">
                  If a unit pays with multiple receipts (e.g., OR# 21325 for Electric/Water and OR# 137 for Dues),
                  submit each receipt as a separate payment entry.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
