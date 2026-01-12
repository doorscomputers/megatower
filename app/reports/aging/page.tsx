"use client"

import { useState, useEffect, useCallback } from "react"
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
  Clock,
  Download,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import DataGrid, {
  Column,
  Sorting,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Paging,
  Summary,
  TotalItem,
  Format,
} from "devextreme-react/data-grid"
import "devextreme/dist/css/dx.light.css"

interface AgingUnit {
  unitId: string
  unitNumber: string
  floorLevel: string
  ownerName: string
  current: number
  days31_60: number
  days61_90: number
  over90: number
  totalBalance: number
  billsCount: number
}

interface FloorData {
  units: AgingUnit[]
  subtotals: {
    current: number
    days31_60: number
    days61_90: number
    over90: number
    totalBalance: number
    unitsCount: number
  }
}

interface ReportData {
  data: AgingUnit[]
  byFloor: Record<string, FloorData>
  grandTotals: {
    current: number
    days31_60: number
    days61_90: number
    over90: number
    totalBalance: number
    unitsCount: number
  }
  percentages: {
    current: number
    days31_60: number
    days61_90: number
    over90: number
  }
  generatedAt: string
}

// Floor order for sorting
const floorOrder: Record<string, number> = {
  'LG': 0, 'GF': 1, '1F': 2, '2F': 3, '3F': 4, '4F': 5, '5F': 6, '6F': 7, '7F': 8, '8F': 9, '9F': 10
}

// Custom sort function for unit numbers (M1-1F-1, M2-LG-1, M2-2F-1, etc.)
const getUnitSortValue = (unitNumber: string): number => {
  const match = unitNumber.match(/^([A-Z]+)(\d*)-([A-Z0-9]+)-(\d+)$/i)
  if (match) {
    const bldgPrefix = match[1].toUpperCase() // M
    const bldgNum = parseInt(match[2]) || 0    // 1, 2, etc.
    const floor = match[3].toUpperCase()       // 1F, 2F, LG, etc.
    const unitNum = parseInt(match[4])         // 1, 2, 3, etc.

    const floorVal = floorOrder[floor] ?? 99

    // Create a numeric value: bldgNum * 1000000 + floorVal * 10000 + unitNum
    return bldgNum * 1000000 + floorVal * 10000 + unitNum
  }
  return 0
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

export default function AgingReportPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [floorFilter, setFloorFilter] = useState("")
  const [floors, setFloors] = useState<string[]>([])

  const fetchFloors = async () => {
    try {
      const res = await fetch("/api/floors")
      if (!res.ok) throw new Error("Failed to fetch floors")
      const data = await res.json()
      setFloors(["", ...data])
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  const fetchReport = async () => {
    try {
      setLoading(true)
      let url = `/api/reports/aging`
      if (floorFilter) url += `?floor=${floorFilter}`

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
    fetchFloors()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [floorFilter])

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push([
      "Unit",
      "Owner",
      "Floor",
      "Current (0-30)",
      "31-60 Days",
      "61-90 Days",
      "Over 90 Days",
      "Total Balance",
    ])

    for (const unit of report.data) {
      wsData.push([
        unit.unitNumber,
        unit.ownerName,
        unit.floorLevel,
        unit.current,
        unit.days31_60,
        unit.days61_90,
        unit.over90,
        unit.totalBalance,
      ])
    }

    wsData.push([])
    wsData.push([
      "GRAND TOTAL",
      "",
      `${report.grandTotals.unitsCount} units`,
      report.grandTotals.current,
      report.grandTotals.days31_60,
      report.grandTotals.days61_90,
      report.grandTotals.over90,
      report.grandTotals.totalBalance,
    ])

    wsData.push([])
    wsData.push([
      "PERCENTAGE",
      "",
      "",
      `${report.percentages.current.toFixed(1)}%`,
      `${report.percentages.days31_60.toFixed(1)}%`,
      `${report.percentages.days61_90.toFixed(1)}%`,
      `${report.percentages.over90.toFixed(1)}%`,
      "100%",
    ])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 8 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
      { wch: 15 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "AR Aging")

    const fileName = `AR_Aging_Report_${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(16)
    doc.text("AR Aging Report", 14, 15)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 14, 22)

    const tableData = report.data.map((unit) => [
      unit.unitNumber,
      unit.ownerName,
      unit.floorLevel,
      formatNumber(unit.current),
      formatNumber(unit.days31_60),
      formatNumber(unit.days61_90),
      formatNumber(unit.over90),
      formatNumber(unit.totalBalance),
    ])

    tableData.push([
      { content: "GRAND TOTAL", styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: "", styles: { fillColor: [220, 220, 220] } } as any,
      { content: `${report.grandTotals.unitsCount} units`, styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.current), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.days31_60), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.days61_90), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.over90), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.totalBalance), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
    ])

    autoTable(doc, {
      head: [["Unit", "Owner", "Floor", "Current (0-30)", "31-60 Days", "61-90 Days", "Over 90", "Total"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`AR_Aging_Report_${new Date().toISOString().split("T")[0]}.pdf`)
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
            <h1 className="text-3xl font-bold text-gray-900">AR Aging Report</h1>
            <p className="text-gray-500">
              Analyze receivables by age buckets (30/60/90/90+ days)
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
                <Label htmlFor="floor">Floor</Label>
                <Select value={floorFilter || "all"} onValueChange={(v) => setFloorFilter(v === "all" ? "" : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Floors" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Floors</SelectItem>
                    {floors.filter(f => f !== "").map((floor) => (
                      <SelectItem key={floor} value={floor}>
                        {floor}
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

        {/* Aging Summary Cards */}
        {report && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className="bg-green-50 border-green-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-green-600 mb-1">Current (0-30 days)</p>
                  <p className="text-2xl font-bold text-green-700">
                    {formatCurrency(report.grandTotals.current)}
                  </p>
                  <p className="text-sm text-green-600">
                    {report.percentages.current.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 border-yellow-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-yellow-600 mb-1">31-60 Days</p>
                  <p className="text-2xl font-bold text-yellow-700">
                    {formatCurrency(report.grandTotals.days31_60)}
                  </p>
                  <p className="text-sm text-yellow-600">
                    {report.percentages.days31_60.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-orange-50 border-orange-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-orange-600 mb-1">61-90 Days</p>
                  <p className="text-2xl font-bold text-orange-700">
                    {formatCurrency(report.grandTotals.days61_90)}
                  </p>
                  <p className="text-sm text-orange-600">
                    {report.percentages.days61_90.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-red-600 mb-1">Over 90 Days</p>
                  <p className="text-2xl font-bold text-red-700">
                    {formatCurrency(report.grandTotals.over90)}
                  </p>
                  <p className="text-sm text-red-600">
                    {report.percentages.over90.toFixed(1)}%
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-100 border-gray-300">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Total Outstanding</p>
                  <p className="text-2xl font-bold text-gray-800">
                    {formatCurrency(report.grandTotals.totalBalance)}
                  </p>
                  <p className="text-sm text-gray-600">
                    {report.grandTotals.unitsCount} units
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Aging Distribution Chart (Simple Bar) */}
        {report && report.grandTotals.totalBalance > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Aging Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-1 h-8 rounded overflow-hidden">
                <div
                  className="bg-green-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${report.percentages.current}%` }}
                >
                  {report.percentages.current > 10 ? `${report.percentages.current.toFixed(0)}%` : ""}
                </div>
                <div
                  className="bg-yellow-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${report.percentages.days31_60}%` }}
                >
                  {report.percentages.days31_60 > 10 ? `${report.percentages.days31_60.toFixed(0)}%` : ""}
                </div>
                <div
                  className="bg-orange-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${report.percentages.days61_90}%` }}
                >
                  {report.percentages.days61_90 > 10 ? `${report.percentages.days61_90.toFixed(0)}%` : ""}
                </div>
                <div
                  className="bg-red-500 flex items-center justify-center text-white text-xs font-medium"
                  style={{ width: `${report.percentages.over90}%` }}
                >
                  {report.percentages.over90 > 10 ? `${report.percentages.over90.toFixed(0)}%` : ""}
                </div>
              </div>
              <div className="flex justify-between mt-2 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-green-500 rounded"></span> Current
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-yellow-500 rounded"></span> 31-60
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-orange-500 rounded"></span> 61-90
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 bg-red-500 rounded"></span> 90+
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report Table */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Aging Details by Unit</CardTitle>
            </CardHeader>
            <CardContent>
              <DataGrid
                dataSource={report.data}
                keyExpr="unitId"
                showBorders={true}
                showRowLines={true}
                rowAlternationEnabled={true}
                allowColumnResizing={true}
                columnAutoWidth={true}
                wordWrapEnabled={true}
              >
                <SearchPanel visible={true} placeholder="Search all columns..." width={300} />
                <FilterRow visible={true} />
                <HeaderFilter visible={true} />
                <Sorting mode="multiple" />
                <Paging enabled={true} defaultPageSize={20} />

                <Column
                  dataField="unitNumber"
                  caption="Unit"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  sortOrder="asc"
                  sortIndex={0}
                  calculateSortValue={(rowData: AgingUnit) => getUnitSortValue(rowData.unitNumber)}
                  cellRender={(cellData: any) => (
                    <span className="font-medium">{cellData.value}</span>
                  )}
                />
                <Column
                  dataField="ownerName"
                  caption="Owner"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                />
                <Column
                  dataField="floorLevel"
                  caption="Floor"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  width={80}
                />
                <Column
                  dataField="current"
                  caption="Current (0-30)"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cssClass="bg-green-50"
                  headerCellRender={() => (
                    <span className="text-green-700 font-medium">Current (0-30)</span>
                  )}
                  cellRender={(cellData: any) => (
                    <span>{cellData.value > 0 ? formatNumber(cellData.value) : "-"}</span>
                  )}
                />
                <Column
                  dataField="days31_60"
                  caption="31-60 Days"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cssClass="bg-yellow-50"
                  headerCellRender={() => (
                    <span className="text-yellow-700 font-medium">31-60 Days</span>
                  )}
                  cellRender={(cellData: any) => (
                    <span>{cellData.value > 0 ? formatNumber(cellData.value) : "-"}</span>
                  )}
                />
                <Column
                  dataField="days61_90"
                  caption="61-90 Days"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cssClass="bg-orange-50"
                  headerCellRender={() => (
                    <span className="text-orange-700 font-medium">61-90 Days</span>
                  )}
                  cellRender={(cellData: any) => (
                    <span>{cellData.value > 0 ? formatNumber(cellData.value) : "-"}</span>
                  )}
                />
                <Column
                  dataField="over90"
                  caption="Over 90"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cssClass="bg-red-50"
                  headerCellRender={() => (
                    <span className="text-red-700 font-medium">Over 90</span>
                  )}
                  cellRender={(cellData: any) => (
                    <span>
                      {cellData.value > 0 ? (
                        <span className="flex items-center justify-end gap-1">
                          <AlertTriangle className="h-3 w-3 text-red-500" />
                          {formatNumber(cellData.value)}
                        </span>
                      ) : "-"}
                    </span>
                  )}
                />
                <Column
                  dataField="totalBalance"
                  caption="Total"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span className="font-bold">{formatNumber(cellData.value)}</span>
                  )}
                />

                <Summary>
                  <TotalItem
                    column="unitNumber"
                    summaryType="count"
                    displayFormat="{0} units"
                  />
                  <TotalItem
                    column="current"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="days31_60"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="days61_90"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="over90"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="totalBalance"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                </Summary>
              </DataGrid>

              {/* Percentage summary row */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
                <div className="grid grid-cols-5 gap-4 text-sm">
                  <div className="text-center">
                    <span className="text-gray-500">Current:</span>
                    <span className="ml-2 font-medium text-green-600">
                      {report.percentages.current.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-500">31-60:</span>
                    <span className="ml-2 font-medium text-yellow-600">
                      {report.percentages.days31_60.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-500">61-90:</span>
                    <span className="ml-2 font-medium text-orange-600">
                      {report.percentages.days61_90.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-500">Over 90:</span>
                    <span className="ml-2 font-medium text-red-600">
                      {report.percentages.over90.toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-500">Total:</span>
                    <span className="ml-2 font-bold">100%</span>
                  </div>
                </div>
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
