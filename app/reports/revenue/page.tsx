"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  TrendingUp,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  DollarSign,
  BarChart3,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface MonthData {
  month: number
  monthName: string
  billed: {
    electric: number
    water: number
    dues: number
    penalty: number
    spAssessment: number
    parking: number
    other: number
    total: number
  }
  collected: {
    electric: number
    water: number
    dues: number
    penalty: number
    spAssessment: number
    total: number
  }
  collectionRate: number
}

interface ReportData {
  year: number
  monthlyData: MonthData[]
  ytd: {
    billed: {
      electric: number
      water: number
      dues: number
      penalty: number
      spAssessment: number
      parking: number
      other: number
      total: number
    }
    collected: {
      electric: number
      water: number
      dues: number
      penalty: number
      spAssessment: number
      total: number
    }
    collectionRate: number
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

const formatNumber = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export default function RevenueReportPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [year, setYear] = useState(new Date().getFullYear().toString())

  const availableYears = Array.from({ length: 5 }, (_, i) =>
    (new Date().getFullYear() - i).toString()
  )

  const fetchReport = async () => {
    try {
      setLoading(true)
      const url = `/api/reports/revenue?year=${year}`
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
  }, [year])

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push([`Revenue Report - ${report.year}`])
    wsData.push([])
    wsData.push([
      "Month",
      "Electric",
      "Water",
      "Dues",
      "Penalty",
      "SP Assessment",
      "Total Billed",
      "Total Collected",
      "Collection %",
    ])

    report.monthlyData.forEach((m) => {
      wsData.push([
        m.monthName,
        m.billed.electric,
        m.billed.water,
        m.billed.dues,
        m.billed.penalty,
        m.billed.spAssessment,
        m.billed.total,
        m.collected.total,
        `${m.collectionRate}%`,
      ])
    })

    wsData.push([])
    wsData.push([
      "YTD TOTAL",
      report.ytd.billed.electric,
      report.ytd.billed.water,
      report.ytd.billed.dues,
      report.ytd.billed.penalty,
      report.ytd.billed.spAssessment,
      report.ytd.billed.total,
      report.ytd.collected.total,
      `${report.ytd.collectionRate}%`,
    ])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
      { wch: 12 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Revenue")

    XLSX.writeFile(wb, `Revenue_Report_${report.year}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(16)
    doc.text(`Revenue Report - ${report.year}`, 14, 15)

    const tableData = report.monthlyData.map((m) => [
      m.monthName,
      formatNumber(m.billed.electric),
      formatNumber(m.billed.water),
      formatNumber(m.billed.dues),
      formatNumber(m.billed.penalty),
      formatNumber(m.billed.total),
      formatNumber(m.collected.total),
      `${m.collectionRate}%`,
    ])

    tableData.push([
      { content: "YTD TOTAL", styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.ytd.billed.electric), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.ytd.billed.water), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.ytd.billed.dues), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.ytd.billed.penalty), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.ytd.billed.total), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.ytd.collected.total), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: `${report.ytd.collectionRate}%`, styles: { fontStyle: "bold", fillColor: [220, 220, 220] } },
    ])

    autoTable(doc, {
      head: [["Month", "Electric", "Water", "Dues", "Penalty", "Billed", "Collected", "%"]],
      body: tableData,
      startY: 22,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [147, 51, 234] },
    })

    doc.save(`Revenue_Report_${report.year}.pdf`)
    toast.success("PDF file downloaded")
  }

  const handlePrint = () => {
    window.print()
  }

  // Get max for chart scaling
  const maxBilled = report ? Math.max(...report.monthlyData.map((m) => m.billed.total), 1) : 1

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Revenue Report</h1>
            <p className="text-gray-500">
              Monthly revenue breakdown and year-to-date trends
            </p>
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
              <div className="w-32">
                <Label htmlFor="year">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={fetchReport} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* YTD Summary */}
        {report && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">YTD Billed</CardTitle>
                <DollarSign className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-700">
                  {formatCurrency(report.ytd.billed.total)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">YTD Collected</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700">
                  {formatCurrency(report.ytd.collected.total)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
                <BarChart3 className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-purple-600">
                  {report.ytd.collectionRate}%
                </div>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Uncollected</CardTitle>
                <DollarSign className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700">
                  {formatCurrency(report.ytd.billed.total - report.ytd.collected.total)}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monthly Bar Chart */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Revenue ({report.year})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end gap-2">
                {report.monthlyData.map((m) => (
                  <div
                    key={m.month}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${m.monthName}: Billed ${formatCurrency(m.billed.total)}, Collected ${formatCurrency(m.collected.total)}`}
                  >
                    <div className="w-full flex gap-1" style={{ height: "200px" }}>
                      <div
                        className="flex-1 bg-blue-400 rounded-t"
                        style={{
                          height: `${(m.billed.total / maxBilled) * 100}%`,
                          marginTop: "auto",
                        }}
                      />
                      <div
                        className="flex-1 bg-green-400 rounded-t"
                        style={{
                          height: `${(m.collected.total / maxBilled) * 100}%`,
                          marginTop: "auto",
                        }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {m.monthName.substring(0, 3)}
                    </span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-blue-400 rounded"></span> Billed
                </span>
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 bg-green-400 rounded"></span> Collected
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Component Breakdown */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>YTD Revenue by Component</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Electric</p>
                  <p className="font-semibold text-yellow-700">
                    {formatCurrency(report.ytd.billed.electric)}
                  </p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Water</p>
                  <p className="font-semibold text-blue-700">
                    {formatCurrency(report.ytd.billed.water)}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Assoc. Dues</p>
                  <p className="font-semibold text-green-700">
                    {formatCurrency(report.ytd.billed.dues)}
                  </p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Penalty</p>
                  <p className="font-semibold text-red-700">
                    {formatCurrency(report.ytd.billed.penalty)}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">SP Assessment</p>
                  <p className="font-semibold text-purple-700">
                    {formatCurrency(report.ytd.billed.spAssessment)}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-100 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Parking/Other</p>
                  <p className="font-semibold text-gray-700">
                    {formatCurrency(report.ytd.billed.parking + report.ytd.billed.other)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Monthly Details Table */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-3 font-medium">Month</th>
                      <th className="text-right py-3 px-3 font-medium">Electric</th>
                      <th className="text-right py-3 px-3 font-medium">Water</th>
                      <th className="text-right py-3 px-3 font-medium">Dues</th>
                      <th className="text-right py-3 px-3 font-medium">Penalty</th>
                      <th className="text-right py-3 px-3 font-medium">Total Billed</th>
                      <th className="text-right py-3 px-3 font-medium">Collected</th>
                      <th className="text-right py-3 px-3 font-medium">Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.monthlyData.map((m) => (
                      <tr key={m.month} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{m.monthName}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(m.billed.electric)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(m.billed.water)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(m.billed.dues)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(m.billed.penalty)}</td>
                        <td className="py-2 px-3 text-right font-medium text-blue-600">
                          {formatNumber(m.billed.total)}
                        </td>
                        <td className="py-2 px-3 text-right font-medium text-green-600">
                          {formatNumber(m.collected.total)}
                        </td>
                        <td className={`py-2 px-3 text-right font-medium ${
                          m.collectionRate >= 80 ? "text-green-600" :
                          m.collectionRate >= 50 ? "text-yellow-600" : "text-red-600"
                        }`}>
                          {m.collectionRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-100 font-bold">
                      <td className="py-3 px-3">YTD TOTAL</td>
                      <td className="py-3 px-3 text-right">{formatNumber(report.ytd.billed.electric)}</td>
                      <td className="py-3 px-3 text-right">{formatNumber(report.ytd.billed.water)}</td>
                      <td className="py-3 px-3 text-right">{formatNumber(report.ytd.billed.dues)}</td>
                      <td className="py-3 px-3 text-right">{formatNumber(report.ytd.billed.penalty)}</td>
                      <td className="py-3 px-3 text-right text-blue-600">
                        {formatNumber(report.ytd.billed.total)}
                      </td>
                      <td className="py-3 px-3 text-right text-green-600">
                        {formatNumber(report.ytd.collected.total)}
                      </td>
                      <td className="py-3 px-3 text-right text-purple-600">
                        {report.ytd.collectionRate}%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Generated timestamp */}
        {report && (
          <p className="text-xs text-gray-400 text-center">
            Report generated: {new Date(report.generatedAt).toLocaleString()}
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
