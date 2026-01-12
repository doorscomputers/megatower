"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  CheckCircle,
  Circle,
  Zap,
  Droplets,
  CreditCard,
  Settings,
  FileText,
  Download,
  Save,
  RefreshCw,
  Info,
  AlertCircle,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"

interface AutoDetect {
  meterReadings: {
    electricCount: number
    waterCount: number
    totalUnits: number
    complete: boolean
  }
  payments: {
    count: number
    hasPayments: boolean
  }
  adjustments: {
    count: number
  }
  bills: {
    count: number
    generated: boolean
  }
}

interface Checklist {
  tenantId: string
  billingMonth: string
  meterReadingsComplete: boolean
  paymentsRecorded: boolean
  adjustmentsEntered: boolean
  billsGenerated: boolean
  soaExported: boolean
  notes: string | null
  completedBy?: string
  completedAt?: string
}

interface ChecklistItem {
  key: keyof Omit<Checklist, "tenantId" | "billingMonth" | "notes" | "completedBy" | "completedAt">
  label: string
  description: string
  icon: React.ReactNode
  link?: string
  autoDetectable?: boolean
}

export default function BillingChecklistPage() {
  const [billingMonth, setBillingMonth] = useState("")
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [checklist, setChecklist] = useState<Checklist | null>(null)
  const [autoDetect, setAutoDetect] = useState<AutoDetect | null>(null)
  const [notes, setNotes] = useState("")

  // Initialize with current month
  useEffect(() => {
    const now = new Date()
    setBillingMonth(format(now, "yyyy-MM"))
  }, [])

  // Fetch checklist when month changes
  useEffect(() => {
    if (billingMonth) {
      fetchChecklist()
    }
  }, [billingMonth])

  const fetchChecklist = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/billing/checklist?billingMonth=${billingMonth}`)
      if (!res.ok) {
        throw new Error("Failed to fetch checklist")
      }
      const data = await res.json()
      setChecklist(data.checklist)
      setAutoDetect(data.autoDetect)
      setNotes(data.checklist.notes || "")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleCheckChange = (key: keyof Checklist, value: boolean) => {
    if (!checklist) return
    setChecklist({
      ...checklist,
      [key]: value,
    })
  }

  const handleSave = async () => {
    if (!checklist || !billingMonth) return

    try {
      setSaving(true)
      const res = await fetch("/api/billing/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          billingMonth,
          meterReadingsComplete: checklist.meterReadingsComplete,
          paymentsRecorded: checklist.paymentsRecorded,
          adjustmentsEntered: checklist.adjustmentsEntered,
          billsGenerated: checklist.billsGenerated,
          soaExported: checklist.soaExported,
          notes,
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to save checklist")
      }

      toast.success("Checklist saved successfully")
      fetchChecklist() // Refresh to get updated data
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  const checklistItems: ChecklistItem[] = [
    {
      key: "meterReadingsComplete",
      label: "Meter Readings Entered",
      description: "Electric and water readings for all units",
      icon: <Zap className="h-5 w-5" />,
      link: "/billing/readings",
      autoDetectable: true,
    },
    {
      key: "paymentsRecorded",
      label: "Payments Recorded",
      description: "All payments from previous month recorded",
      icon: <CreditCard className="h-5 w-5" />,
      link: "/payments",
      autoDetectable: true,
    },
    {
      key: "adjustmentsEntered",
      label: "Adjustments Entered",
      description: "SP Assessment, discounts, and other adjustments",
      icon: <Settings className="h-5 w-5" />,
      link: "/billing/adjustments",
    },
    {
      key: "billsGenerated",
      label: "Bills Generated",
      description: "Monthly bills created for all units",
      icon: <FileText className="h-5 w-5" />,
      link: "/billing/generate",
      autoDetectable: true,
    },
    {
      key: "soaExported",
      label: "SOA Exported/Printed",
      description: "Statement of Account distributed to owners",
      icon: <Download className="h-5 w-5" />,
      link: "/billing/soa/monthly",
    },
  ]

  const completedCount = checklist
    ? checklistItems.filter((item) => checklist[item.key] === true).length
    : 0

  const getAutoDetectInfo = (key: string): string | null => {
    if (!autoDetect) return null

    switch (key) {
      case "meterReadingsComplete":
        return `Electric: ${autoDetect.meterReadings.electricCount}/${autoDetect.meterReadings.totalUnits}, Water: ${autoDetect.meterReadings.waterCount}/${autoDetect.meterReadings.totalUnits}`
      case "paymentsRecorded":
        return `${autoDetect.payments.count} payment(s) recorded`
      case "billsGenerated":
        return `${autoDetect.bills.count} bill(s) generated`
      default:
        return null
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Billing Checklist</h1>
          <p className="text-gray-500">
            Track your monthly billing progress and ensure no steps are missed
          </p>
        </div>

        {/* Month Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Select Billing Month</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <Label htmlFor="billingMonth">Billing Month</Label>
                <Input
                  id="billingMonth"
                  type="month"
                  value={billingMonth}
                  onChange={(e) => setBillingMonth(e.target.value)}
                  className="mt-1"
                />
              </div>
              <Button
                variant="outline"
                onClick={fetchChecklist}
                disabled={loading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Progress Summary */}
        {checklist && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">
                    {billingMonth && format(new Date(billingMonth + "-01"), "MMMM yyyy")} Progress
                  </h3>
                  <p className="text-sm text-gray-500">
                    {completedCount} of {checklistItems.length} steps completed
                  </p>
                </div>
                <div className="text-4xl font-bold text-blue-600">
                  {Math.round((completedCount / checklistItems.length) * 100)}%
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    completedCount === checklistItems.length
                      ? "bg-green-500"
                      : completedCount > 0
                      ? "bg-blue-500"
                      : "bg-gray-300"
                  }`}
                  style={{ width: `${(completedCount / checklistItems.length) * 100}%` }}
                />
              </div>

              {completedCount === checklistItems.length && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-800 font-medium">
                    All billing tasks completed for this month!
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Checklist Items */}
        {checklist && (
          <Card>
            <CardHeader>
              <CardTitle>Billing Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {checklistItems.map((item, index) => {
                const isChecked = checklist[item.key] === true
                const autoInfo = getAutoDetectInfo(item.key)

                return (
                  <div
                    key={item.key}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      isChecked
                        ? "border-green-300 bg-green-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex items-center pt-0.5">
                        <Checkbox
                          id={item.key}
                          checked={isChecked}
                          onCheckedChange={(checked) =>
                            handleCheckChange(item.key, checked as boolean)
                          }
                          className="h-6 w-6"
                        />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div
                            className={`p-2 rounded-lg ${
                              isChecked ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            {item.icon}
                          </div>
                          <div>
                            <label
                              htmlFor={item.key}
                              className={`font-medium cursor-pointer ${
                                isChecked ? "text-green-800" : "text-gray-900"
                              }`}
                            >
                              Step {index + 1}: {item.label}
                            </label>
                            <p className="text-sm text-gray-500">{item.description}</p>
                          </div>
                        </div>

                        {/* Auto-detect info */}
                        {autoInfo && (
                          <div className="mt-2 ml-12 flex items-center gap-2 text-sm text-blue-600">
                            <Info className="h-4 w-4" />
                            <span>{autoInfo}</span>
                          </div>
                        )}
                      </div>

                      {item.link && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => (window.location.href = item.link!)}
                        >
                          Go to Page
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* Notes */}
        {checklist && (
          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Add any notes or reminders for this billing period..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>
        )}

        {/* Save Button */}
        {checklist && (
          <div className="flex justify-end gap-3">
            <Button
              onClick={handleSave}
              disabled={saving}
              size="lg"
              className="min-w-[150px]"
            >
              {saving ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Checklist
                </>
              )}
            </Button>
          </div>
        )}

        {/* Workflow Reference */}
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-blue-800">
              <Info className="h-5 w-5" />
              Correct Billing Workflow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-blue-900 space-y-2">
              <p className="font-medium">Follow these steps in order:</p>
              <ol className="list-decimal list-inside space-y-1 ml-2">
                <li>
                  <strong>Enter Meter Readings</strong> - Electric and water readings for all units
                </li>
                <li>
                  <strong>Record Payments</strong> - All payments received for previous month&apos;s bills
                </li>
                <li>
                  <strong>Enter Adjustments</strong> - SP Assessment, discounts (if any)
                </li>
                <li>
                  <strong>Preview & Generate Bills</strong> - Review calculations before generating
                </li>
                <li>
                  <strong>Export/Print SOA</strong> - Distribute statements to unit owners
                </li>
              </ol>
              <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-yellow-700 mt-0.5 flex-shrink-0" />
                  <p className="text-yellow-800">
                    <strong>Important:</strong> Always record payments BEFORE generating bills to ensure
                    previous balances and penalties are calculated correctly.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
