"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Printer,
  ArrowRight,
  Calendar,
  DollarSign,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface PeriodData {
  year: number
  month?: number
  monthName?: string
  label: string
  billed: {
    total: number
    electric: number
    water: number
    dues: number
    penalty: number
  }
  collected: {
    total: number
    electric: number
    water: number
    dues: number
    penalty: number
  }
  billCount: number
  paymentCount: number
  paidBills: number
  outstanding: number
  monthlyTrends?: Array<{
    month: number
    monthName: string
    billed: number
    collected: number
  }>
}

interface ReportData {
  type: "mom" | "yoy"
  currentPeriod: PeriodData
  previousPeriod: PeriodData
  changes: {
    billed: {
      total: number
      electric: number
      water: number
      dues: number
      penalty: number
    }
    collected: {
      total: number
      electric: number
      water: number
      dues: number
      penalty: number
    }
    billCount: number
    paymentCount: number
    outstanding: number
  }
  generatedAt: string
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount)
}

const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
]

const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1
const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

const ChangeIndicator = ({ value, inverse = false }: { value: number; inverse?: boolean }) => {
  const isPositive = inverse ? value < 0 : value > 0
  const isNegative = inverse ? value > 0 : value < 0

  if (value === 0) {
    return (
      <span className="flex items-center gap-1 text-gray-500">
        <Minus className="h-4 w-4" />
        0%
      </span>
    )
  }

  return (
    <span className={`flex items-center gap-1 ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
      {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
      {value > 0 ? '+' : ''}{value}%
    </span>
  )
}

export default function ComparativeReportPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [type, setType] = useState<"mom" | "yoy">("mom")
  const [year, setYear] = useState(currentYear.toString())
  const [month, setMonth] = useState(currentMonth.toString())

  const fetchReport = async () => {
    try {
      setLoading(true)
      let url = `/api/reports/comparative?type=${type}&year=${year}`
      if (type === 'mom') url += `&month=${month}`

      const res = await fetch(url)
      if (!res.ok) throw new Error("Failed to fetch report")
      const data = await res.json()
      setReport(data)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchReport()
  }, [type, year, month])

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push(["Comparative Analysis Report"])
    wsData.push([`Type: ${report.type === 'mom' ? 'Month-over-Month' : 'Year-over-Year'}`])
    wsData.push([])
    wsData.push(["Metric", report.previousPeriod.label, report.currentPeriod.label, "Change"])

    wsData.push(["Total Billed", report.previousPeriod.billed.total, report.currentPeriod.billed.total, `${report.changes.billed.total}%`])
    wsData.push(["Total Collected", report.previousPeriod.collected.total, report.currentPeriod.collected.total, `${report.changes.collected.total}%`])
    wsData.push(["Electric Billed", report.previousPeriod.billed.electric, report.currentPeriod.billed.electric, `${report.changes.billed.electric}%`])
    wsData.push(["Water Billed", report.previousPeriod.billed.water, report.currentPeriod.billed.water, `${report.changes.billed.water}%`])
    wsData.push(["Dues Billed", report.previousPeriod.billed.dues, report.currentPeriod.billed.dues, `${report.changes.billed.dues}%`])
    wsData.push(["Bill Count", report.previousPeriod.billCount, report.currentPeriod.billCount, `${report.changes.billCount}%`])
    wsData.push(["Payment Count", report.previousPeriod.paymentCount, report.currentPeriod.paymentCount, `${report.changes.paymentCount}%`])
    wsData.push(["Outstanding", report.previousPeriod.outstanding, report.currentPeriod.outstanding, `${report.changes.outstanding}%`])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [{ wch: 20 }, { wch: 16 }, { wch: 16 }, { wch: 12 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Comparison")

    XLSX.writeFile(wb, `Comparative_${type.toUpperCase()}_${year}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF()

    doc.setFontSize(16)
    doc.text("Comparative Analysis Report", 14, 15)
    doc.setFontSize(10)
    doc.text(`${report.type === 'mom' ? 'Month-over-Month' : 'Year-over-Year'} Comparison`, 14, 22)

    const tableData = [
      ["Total Billed", formatCurrency(report.previousPeriod.billed.total), formatCurrency(report.currentPeriod.billed.total), `${report.changes.billed.total}%`],
      ["Total Collected", formatCurrency(report.previousPeriod.collected.total), formatCurrency(report.currentPeriod.collected.total), `${report.changes.collected.total}%`],
      ["Bill Count", report.previousPeriod.billCount.toString(), report.currentPeriod.billCount.toString(), `${report.changes.billCount}%`],
      ["Payment Count", report.previousPeriod.paymentCount.toString(), report.currentPeriod.paymentCount.toString(), `${report.changes.paymentCount}%`],
      ["Outstanding", formatCurrency(report.previousPeriod.outstanding), formatCurrency(report.currentPeriod.outstanding), `${report.changes.outstanding}%`]
    ]

    autoTable(doc, {
      head: [["Metric", report.previousPeriod.label, report.currentPeriod.label, "Change"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 9 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`Comparative_${type.toUpperCase()}_${year}.pdf`)
    toast.success("PDF file downloaded")
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Comparative Analysis</h1>
            <p className="text-gray-500">Month-over-Month and Year-over-Year comparisons</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handleExportExcel} disabled={!report}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" onClick={handleExportPDF} disabled={!report}>
              <FileText className="h-4 w-4 mr-2" />
              PDF
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={!report}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="w-44">
                <Label>Comparison Type</Label>
                <Select value={type} onValueChange={(v: "mom" | "yoy") => setType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mom">Month-over-Month</SelectItem>
                    <SelectItem value="yoy">Year-over-Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-28">
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {type === 'mom' && (
                <div className="w-36">
                  <Label>Month</Label>
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <Button onClick={fetchReport} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Period Comparison Header */}
        {report && (
          <div className="flex items-center justify-center gap-4 py-4">
            <Card className="flex-1 max-w-xs">
              <CardContent className="pt-6 text-center">
                <Calendar className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="text-lg font-bold">{report.previousPeriod.label}</p>
                <p className="text-sm text-gray-500">Previous Period</p>
              </CardContent>
            </Card>
            <ArrowRight className="h-8 w-8 text-gray-400" />
            <Card className="flex-1 max-w-xs bg-blue-50 border-blue-200">
              <CardContent className="pt-6 text-center">
                <Calendar className="h-8 w-8 mx-auto text-blue-600 mb-2" />
                <p className="text-lg font-bold text-blue-700">{report.currentPeriod.label}</p>
                <p className="text-sm text-blue-600">Current Period</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Key Metrics Comparison */}
        {report && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Billed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">{report.previousPeriod.label}</p>
                    <p className="text-lg font-medium">{formatCurrency(report.previousPeriod.billed.total)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{report.currentPeriod.label}</p>
                    <p className="text-lg font-bold">{formatCurrency(report.currentPeriod.billed.total)}</p>
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <ChangeIndicator value={report.changes.billed.total} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">{report.previousPeriod.label}</p>
                    <p className="text-lg font-medium">{formatCurrency(report.previousPeriod.collected.total)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{report.currentPeriod.label}</p>
                    <p className="text-lg font-bold text-green-600">{formatCurrency(report.currentPeriod.collected.total)}</p>
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <ChangeIndicator value={report.changes.collected.total} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Outstanding Balance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-sm text-gray-500">{report.previousPeriod.label}</p>
                    <p className="text-lg font-medium">{formatCurrency(report.previousPeriod.outstanding)}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                  <div className="text-right">
                    <p className="text-sm text-gray-500">{report.currentPeriod.label}</p>
                    <p className="text-lg font-bold text-red-600">{formatCurrency(report.currentPeriod.outstanding)}</p>
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <ChangeIndicator value={report.changes.outstanding} inverse />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Detailed Comparison Table */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Detailed Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-2 font-medium">Metric</th>
                      <th className="text-right py-3 px-2 font-medium">{report.previousPeriod.label}</th>
                      <th className="text-right py-3 px-2 font-medium">{report.currentPeriod.label}</th>
                      <th className="text-right py-3 px-2 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b bg-blue-50">
                      <td className="py-2 px-2 font-medium">Total Billed</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.previousPeriod.billed.total)}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatCurrency(report.currentPeriod.billed.total)}</td>
                      <td className="py-2 px-2 text-right"><ChangeIndicator value={report.changes.billed.total} /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-2 pl-6 text-gray-600">Electric</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.previousPeriod.billed.electric)}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.currentPeriod.billed.electric)}</td>
                      <td className="py-2 px-2 text-right"><ChangeIndicator value={report.changes.billed.electric} /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-2 pl-6 text-gray-600">Water</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.previousPeriod.billed.water)}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.currentPeriod.billed.water)}</td>
                      <td className="py-2 px-2 text-right"><ChangeIndicator value={report.changes.billed.water} /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-2 pl-6 text-gray-600">Association Dues</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.previousPeriod.billed.dues)}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.currentPeriod.billed.dues)}</td>
                      <td className="py-2 px-2 text-right"><ChangeIndicator value={report.changes.billed.dues} /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-2 pl-6 text-gray-600">Penalty</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.previousPeriod.billed.penalty)}</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.currentPeriod.billed.penalty)}</td>
                      <td className="py-2 px-2 text-right"><ChangeIndicator value={report.changes.billed.penalty} inverse /></td>
                    </tr>
                    <tr className="border-b bg-green-50">
                      <td className="py-2 px-2 font-medium">Total Collected</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.previousPeriod.collected.total)}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatCurrency(report.currentPeriod.collected.total)}</td>
                      <td className="py-2 px-2 text-right"><ChangeIndicator value={report.changes.collected.total} /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-2 font-medium">Bill Count</td>
                      <td className="py-2 px-2 text-right">{report.previousPeriod.billCount}</td>
                      <td className="py-2 px-2 text-right font-medium">{report.currentPeriod.billCount}</td>
                      <td className="py-2 px-2 text-right"><ChangeIndicator value={report.changes.billCount} /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-2 font-medium">Payment Count</td>
                      <td className="py-2 px-2 text-right">{report.previousPeriod.paymentCount}</td>
                      <td className="py-2 px-2 text-right font-medium">{report.currentPeriod.paymentCount}</td>
                      <td className="py-2 px-2 text-right"><ChangeIndicator value={report.changes.paymentCount} /></td>
                    </tr>
                    <tr className="border-b bg-red-50">
                      <td className="py-2 px-2 font-medium">Outstanding Balance</td>
                      <td className="py-2 px-2 text-right">{formatCurrency(report.previousPeriod.outstanding)}</td>
                      <td className="py-2 px-2 text-right font-medium">{formatCurrency(report.currentPeriod.outstanding)}</td>
                      <td className="py-2 px-2 text-right"><ChangeIndicator value={report.changes.outstanding} inverse /></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly Trends (YoY only) */}
        {report && report.type === 'yoy' && report.currentPeriod.monthlyTrends && (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Trends Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end gap-1">
                {report.currentPeriod.monthlyTrends.map((m, idx) => {
                  const prevData = report.previousPeriod.monthlyTrends?.[idx]
                  const maxVal = Math.max(
                    ...report.currentPeriod.monthlyTrends!.map(t => t.collected),
                    ...report.previousPeriod.monthlyTrends!.map(t => t.collected)
                  )
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                      <div className="w-full flex gap-0.5 justify-center">
                        {prevData && (
                          <div
                            className="w-3 bg-gray-300 rounded-t"
                            style={{ height: `${(prevData.collected / maxVal) * 180}px` }}
                            title={`${prevData.monthName} ${report.previousPeriod.year}: ${formatCurrency(prevData.collected)}`}
                          />
                        )}
                        <div
                          className="w-3 bg-blue-500 rounded-t"
                          style={{ height: `${(m.collected / maxVal) * 180}px` }}
                          title={`${m.monthName} ${report.currentPeriod.year}: ${formatCurrency(m.collected)}`}
                        />
                      </div>
                      <span className="text-xs text-gray-500">{m.monthName.slice(0, 1)}</span>
                    </div>
                  )
                })}
              </div>
              <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-gray-300 rounded" />
                  <span className="text-sm">{report.previousPeriod.year}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded" />
                  <span className="text-sm">{report.currentPeriod.year}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {report && (
          <p className="text-xs text-gray-400 text-center">
            Report generated: {new Date(report.generatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
