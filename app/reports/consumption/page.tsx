"use client"

import { useState, useEffect, useMemo } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Zap,
  Droplets,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface MonthData {
  month: number
  monthName: string
  totalConsumption: number
  avgConsumption: number
  readingsCount: number
  maxConsumption: number
  minConsumption: number
}

interface UnitData {
  unitNumber: string
  floorLevel: string
  unitType: string
  totalConsumption: number
  avgConsumption: number
  readingsCount: number
  trend: number
}

interface ReportData {
  type: string
  year: number
  monthlyData: MonthData[]
  unitData: UnitData[]
  topConsumers: UnitData[]
  anomalies: UnitData[]
  summary: {
    totalConsumption: number
    avgMonthlyConsumption: number
    avgPerUnit: number
    totalReadings: number
    unitsCount: number
    highestMonth: MonthData
    lowestMonth: MonthData
  }
  generatedAt: string
}

const formatNumber = (num: number, decimals = 2) => {
  return new Intl.NumberFormat("en-PH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

type SortField = "unitNumber" | "floorLevel" | "unitType" | "totalConsumption" | "avgConsumption" | "readingsCount" | "trend"
type SortOrder = "asc" | "desc"

export default function ConsumptionReportPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [floors, setFloors] = useState<string[]>([])
  const [type, setType] = useState("electric")
  const [year, setYear] = useState(new Date().getFullYear().toString())
  const [floorFilter, setFloorFilter] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc")

  useEffect(() => {
    fetchFloors()
  }, [])

  const fetchFloors = async () => {
    try {
      const res = await fetch("/api/floors")
      if (res.ok) {
        const data = await res.json()
        setFloors(["", ...data])
      }
    } catch (error) {
      console.error("Error fetching floors:", error)
    }
  }

  const availableYears = Array.from({ length: 5 }, (_, i) =>
    (new Date().getFullYear() - i).toString()
  )

  // Filter and sort unit data
  const filteredUnitData = useMemo(() => {
    if (!report) return []

    let filtered = report.unitData

    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((u) =>
        u.unitNumber.toLowerCase().includes(term) ||
        u.floorLevel.toLowerCase().includes(term) ||
        u.unitType.toLowerCase().includes(term)
      )
    }

    if (sortField) {
      filtered = [...filtered].sort((a, b) => {
        const aVal = a[sortField]
        const bVal = b[sortField]
        if (typeof aVal === "string") {
          return sortOrder === "asc" ? aVal.localeCompare(bVal as string) : (bVal as string).localeCompare(aVal)
        }
        return sortOrder === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
      })
    }

    return filtered
  }, [report, searchTerm, sortField, sortOrder])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortOrder("asc")
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-50" />
    return sortOrder === "asc" ? <ArrowUp className="h-3 w-3 ml-1" /> : <ArrowDown className="h-3 w-3 ml-1" />
  }

  const fetchReport = async () => {
    try {
      setLoading(true)
      let url = `/api/reports/consumption?type=${type}&year=${year}`
      if (floorFilter) url += `&floor=${floorFilter}`

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
  }, [type, year, floorFilter])

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []
    const unit = report.type === "electric" ? "kWh" : "cu.m"

    wsData.push([`${report.type === "electric" ? "Electric" : "Water"} Consumption Report - ${report.year}`])
    wsData.push([])
    wsData.push(["Monthly Summary"])
    wsData.push(["Month", `Total (${unit})`, `Average (${unit})`, "Readings", `Max (${unit})`, `Min (${unit})`])

    report.monthlyData.forEach((m) => {
      wsData.push([
        m.monthName,
        m.totalConsumption,
        m.avgConsumption.toFixed(2),
        m.readingsCount,
        m.maxConsumption,
        m.minConsumption
      ])
    })

    wsData.push([])
    wsData.push(["Per Unit Summary"])
    wsData.push(["Unit", "Floor", "Type", `Total (${unit})`, `Average (${unit})`, "Readings", "Trend %"])

    report.unitData.forEach((u) => {
      wsData.push([
        u.unitNumber,
        u.floorLevel,
        u.unitType,
        u.totalConsumption.toFixed(2),
        u.avgConsumption.toFixed(2),
        u.readingsCount,
        `${u.trend}%`
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [{ wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Consumption")

    XLSX.writeFile(wb, `${report.type}_Consumption_${report.year}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF()
    const unit = report.type === "electric" ? "kWh" : "cu.m"

    doc.setFontSize(16)
    doc.text(`${report.type === "electric" ? "Electric" : "Water"} Consumption Report - ${report.year}`, 14, 15)

    const tableData = report.monthlyData.map((m) => [
      m.monthName,
      formatNumber(m.totalConsumption, 0),
      formatNumber(m.avgConsumption),
      m.readingsCount.toString(),
    ])

    autoTable(doc, {
      head: [["Month", `Total (${unit})`, `Avg (${unit})`, "Readings"]],
      body: tableData,
      startY: 22,
      styles: { fontSize: 9 },
      headStyles: { fillColor: report.type === "electric" ? [234, 179, 8] : [59, 130, 246] },
    })

    doc.save(`${report.type}_Consumption_${report.year}.pdf`)
    toast.success("PDF file downloaded")
  }

  const handlePrint = () => {
    window.print()
  }

  const maxConsumption = report ? Math.max(...report.monthlyData.map(m => m.totalConsumption), 1) : 1
  const unit = report?.type === "electric" ? "kWh" : "cu.m"

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Consumption Report</h1>
            <p className="text-gray-500">
              Electric and water usage analysis
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
              <div className="w-40">
                <Label>Utility Type</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="electric">Electric</SelectItem>
                    <SelectItem value="water">Water</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="w-32">
                <Label>Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="w-32">
                <Label>Floor</Label>
                <Select value={floorFilter || "all"} onValueChange={(v) => setFloorFilter(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Floors</SelectItem>
                    {floors.filter(f => f !== "").map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={fetchReport} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>

            {/* Search Input */}
            <div className="mt-4 relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search unit, floor, type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary Cards */}
        {report && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className={type === "electric" ? "bg-yellow-50 border-yellow-200" : "bg-blue-50 border-blue-200"}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Consumption</CardTitle>
                {type === "electric" ? <Zap className="h-4 w-4 text-yellow-600" /> : <Droplets className="h-4 w-4 text-blue-600" />}
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${type === "electric" ? "text-yellow-700" : "text-blue-700"}`}>
                  {formatNumber(report.summary.totalConsumption, 0)} {unit}
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.totalReadings} readings
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg per Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(report.summary.avgMonthlyConsumption, 0)} {unit}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Avg per Unit</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatNumber(report.summary.avgPerUnit)} {unit}
                </div>
                <p className="text-xs text-muted-foreground">
                  {report.summary.unitsCount} units
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Peak Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {report.summary.highestMonth?.monthName?.substring(0, 3) || "-"}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(report.summary.highestMonth?.totalConsumption || 0, 0)} {unit}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Monthly Chart */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Monthly Consumption ({report.year})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-48 flex items-end gap-2">
                {report.monthlyData.map((m) => (
                  <div
                    key={m.month}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${m.monthName}: ${formatNumber(m.totalConsumption, 0)} ${unit}`}
                  >
                    <div
                      className={`w-full rounded-t ${type === "electric" ? "bg-yellow-400" : "bg-blue-400"}`}
                      style={{
                        height: `${(m.totalConsumption / maxConsumption) * 180}px`,
                        minHeight: m.totalConsumption > 0 ? "4px" : "0"
                      }}
                    />
                    <span className="text-xs text-gray-500">
                      {m.monthName.substring(0, 3)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top Consumers & Anomalies */}
        {report && (
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Consumers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {report.topConsumers.map((u, i) => (
                    <div key={u.unitNumber} className="flex items-center gap-3">
                      <span className="w-6 text-sm font-medium text-gray-500">{i + 1}</span>
                      <span className="font-medium w-20">{u.unitNumber}</span>
                      <div className="flex-1 h-4 bg-gray-200 rounded overflow-hidden">
                        <div
                          className={`h-full ${type === "electric" ? "bg-yellow-500" : "bg-blue-500"}`}
                          style={{ width: `${(u.avgConsumption / report.topConsumers[0].avgConsumption) * 100}%` }}
                        />
                      </div>
                      <span className="w-24 text-right text-sm">
                        {formatNumber(u.avgConsumption)} {unit}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className={report.anomalies.length > 0 ? "border-orange-300" : ""}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-500" />
                  Consumption Anomalies
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.anomalies.length > 0 ? (
                  <div className="space-y-2">
                    {report.anomalies.map((u) => (
                      <div key={u.unitNumber} className="flex items-center justify-between p-2 bg-orange-50 rounded">
                        <div>
                          <span className="font-medium">{u.unitNumber}</span>
                          <span className="text-sm text-gray-500 ml-2">({u.floorLevel})</span>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-orange-600">
                            {formatNumber(u.avgConsumption)} {unit}
                          </p>
                          <p className="text-xs text-gray-500">
                            {((u.avgConsumption / report.summary.avgPerUnit) * 100 - 100).toFixed(0)}% above avg
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">No anomalies detected</p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Unit Table */}
        {report && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Per Unit Details</CardTitle>
                {searchTerm && (
                  <p className="text-sm text-gray-500">
                    Showing {filteredUnitData.length} of {report.unitData.length} units
                  </p>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50">
                      <th className="text-left py-3 px-3 font-medium">
                        <button type="button" onClick={() => handleSort("unitNumber")} className="flex items-center hover:text-blue-600">
                          Unit <SortIcon field="unitNumber" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-3 font-medium">
                        <button type="button" onClick={() => handleSort("floorLevel")} className="flex items-center hover:text-blue-600">
                          Floor <SortIcon field="floorLevel" />
                        </button>
                      </th>
                      <th className="text-left py-3 px-3 font-medium">
                        <button type="button" onClick={() => handleSort("unitType")} className="flex items-center hover:text-blue-600">
                          Type <SortIcon field="unitType" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-3 font-medium">
                        <button type="button" onClick={() => handleSort("totalConsumption")} className="flex items-center justify-end w-full hover:text-blue-600">
                          Total ({unit}) <SortIcon field="totalConsumption" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-3 font-medium">
                        <button type="button" onClick={() => handleSort("avgConsumption")} className="flex items-center justify-end w-full hover:text-blue-600">
                          Average ({unit}) <SortIcon field="avgConsumption" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-3 font-medium">
                        <button type="button" onClick={() => handleSort("readingsCount")} className="flex items-center justify-end w-full hover:text-blue-600">
                          Readings <SortIcon field="readingsCount" />
                        </button>
                      </th>
                      <th className="text-right py-3 px-3 font-medium">
                        <button type="button" onClick={() => handleSort("trend")} className="flex items-center justify-end w-full hover:text-blue-600">
                          Trend <SortIcon field="trend" />
                        </button>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUnitData.slice(0, 50).map((u) => (
                      <tr key={u.unitNumber} className="border-b hover:bg-gray-50">
                        <td className="py-2 px-3 font-medium">{u.unitNumber}</td>
                        <td className="py-2 px-3">{u.floorLevel}</td>
                        <td className="py-2 px-3">{u.unitType}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(u.totalConsumption, 0)}</td>
                        <td className="py-2 px-3 text-right">{formatNumber(u.avgConsumption)}</td>
                        <td className="py-2 px-3 text-right">{u.readingsCount}</td>
                        <td className="py-2 px-3 text-right">
                          {u.trend !== 0 && (
                            <span className={`flex items-center justify-end gap-1 ${
                              u.trend > 0 ? "text-red-600" : "text-green-600"
                            }`}>
                              {u.trend > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {Math.abs(u.trend)}%
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
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
