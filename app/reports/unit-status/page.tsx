"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import {
  Building2,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Users,
  Home,
  Phone,
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
} from "devextreme-react/data-grid"
import "devextreme/dist/css/dx.light.css"

interface UnitStatus {
  unitId: string
  unitNumber: string
  floorLevel: string
  unitType: string
  area: number
  occupancyStatus: string
  ownerName: string
  ownerPhone: string | null
  ownerEmail: string | null
  hasSpAssessment: boolean
  totalOutstanding: number
  paidThisYear: number
  reliabilityScore: number
  overdueCount: number
  lastPaymentDate: string | null
  lastPaymentAmount: number | null
  lastElectricConsumption: number | null
  lastWaterConsumption: number | null
  advanceDues: number
  advanceUtilities: number
  overallStatus: "good" | "warning" | "critical"
}

interface ReportData {
  data: UnitStatus[]
  summary: {
    totalUnits: number
    occupancy: {
      occupied: number
      vacant: number
      ownerOccupied: number
      rented: number
    }
    unitType: {
      residential: number
      commercial: number
    }
    status: {
      good: number
      warning: number
      critical: number
    }
    totalOutstanding: number
    avgReliabilityScore: number
    withSpAssessment: number
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
    const bldgNum = parseInt(match[2]) || 0
    const floor = match[3].toUpperCase()
    const unitNum = parseInt(match[4])
    const floorVal = floorOrder[floor] ?? 99
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

const statusIcons = {
  good: <CheckCircle className="h-4 w-4 text-green-600" />,
  warning: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
  critical: <XCircle className="h-4 w-4 text-red-600" />,
}

const occupancyLabels: Record<string, string> = {
  OCCUPIED: "Occupied",
  VACANT: "Vacant",
  OWNER_OCCUPIED: "Owner Occupied",
  RENTED: "Rented",
}

export default function UnitStatusReportPage() {
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
      let url = `/api/reports/unit-status`
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

    wsData.push(["Unit Status Report"])
    wsData.push([])
    wsData.push([
      "Unit",
      "Floor",
      "Type",
      "Area",
      "Occupancy",
      "Owner",
      "Phone",
      "Outstanding",
      "Reliability %",
      "Overdue Bills",
      "Last Payment",
      "Status",
    ])

    report.data.forEach((unit) => {
      wsData.push([
        unit.unitNumber,
        unit.floorLevel,
        unit.unitType,
        unit.area,
        occupancyLabels[unit.occupancyStatus] || unit.occupancyStatus,
        unit.ownerName,
        unit.ownerPhone || "",
        unit.totalOutstanding,
        `${unit.reliabilityScore}%`,
        unit.overdueCount,
        unit.lastPaymentDate ? new Date(unit.lastPaymentDate).toLocaleDateString() : "Never",
        unit.overallStatus.toUpperCase(),
      ])
    })

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 10 }, { wch: 6 }, { wch: 12 }, { wch: 8 }, { wch: 14 },
      { wch: 20 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
      { wch: 12 }, { wch: 10 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Unit Status")

    XLSX.writeFile(wb, `Unit_Status_Report_${new Date().toISOString().split("T")[0]}.xlsx`)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(16)
    doc.text("Unit Status Report", 14, 15)

    const tableData = report.data.map((unit) => [
      unit.unitNumber,
      unit.floorLevel,
      unit.unitType,
      occupancyLabels[unit.occupancyStatus] || unit.occupancyStatus,
      unit.ownerName,
      formatCurrency(unit.totalOutstanding),
      `${unit.reliabilityScore}%`,
      unit.overdueCount.toString(),
      unit.overallStatus.toUpperCase(),
    ])

    autoTable(doc, {
      head: [["Unit", "Floor", "Type", "Occupancy", "Owner", "Outstanding", "Reliability", "Overdue", "Status"]],
      body: tableData,
      startY: 22,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`Unit_Status_Report_${new Date().toISOString().split("T")[0]}.pdf`)
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
            <h1 className="text-3xl font-bold text-gray-900">Unit Status Report</h1>
            <p className="text-gray-500">
              Complete status overview of all units
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

        {/* Summary Cards */}
        {report && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Units</CardTitle>
                  <Building2 className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{report.summary.totalUnits}</div>
                  <p className="text-xs text-muted-foreground">
                    {report.summary.unitType.residential} residential, {report.summary.unitType.commercial} commercial
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Occupancy</CardTitle>
                  <Home className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {Math.round(((report.summary.totalUnits - report.summary.occupancy.vacant) / report.summary.totalUnits) * 100)}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {report.summary.occupancy.vacant} vacant units
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg. Reliability</CardTitle>
                  <Users className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{report.summary.avgReliabilityScore}%</div>
                  <p className="text-xs text-muted-foreground">
                    Payment reliability score
                  </p>
                </CardContent>
              </Card>

              <Card className="bg-red-50 border-red-200">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-700">
                    {formatCurrency(report.summary.totalOutstanding)}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Status Distribution */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="bg-green-50 border-green-200">
                <CardContent className="pt-6 text-center">
                  <CheckCircle className="h-8 w-8 mx-auto text-green-600 mb-2" />
                  <p className="text-2xl font-bold text-green-700">{report.summary.status.good}</p>
                  <p className="text-sm text-green-600">Good Standing</p>
                </CardContent>
              </Card>

              <Card className="bg-yellow-50 border-yellow-200">
                <CardContent className="pt-6 text-center">
                  <AlertTriangle className="h-8 w-8 mx-auto text-yellow-600 mb-2" />
                  <p className="text-2xl font-bold text-yellow-700">{report.summary.status.warning}</p>
                  <p className="text-sm text-yellow-600">Warning</p>
                </CardContent>
              </Card>

              <Card className="bg-red-50 border-red-200">
                <CardContent className="pt-6 text-center">
                  <XCircle className="h-8 w-8 mx-auto text-red-600 mb-2" />
                  <p className="text-2xl font-bold text-red-700">{report.summary.status.critical}</p>
                  <p className="text-sm text-red-600">Critical</p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Unit Table */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Unit Details</CardTitle>
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
                  dataField="overallStatus"
                  caption="Status"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  width={80}
                  cellRender={(cellData: any) => (
                    <div className="flex justify-center">
                      {statusIcons[cellData.value as keyof typeof statusIcons]}
                    </div>
                  )}
                />
                <Column
                  dataField="unitNumber"
                  caption="Unit"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  sortOrder="asc"
                  sortIndex={0}
                  calculateSortValue={(rowData: UnitStatus) => getUnitSortValue(rowData.unitNumber)}
                  cellRender={(cellData: any) => (
                    <div>
                      <div className="font-medium">{cellData.value}</div>
                      <div className="text-xs text-gray-500">{cellData.data.unitType}</div>
                    </div>
                  )}
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
                  dataField="ownerName"
                  caption="Owner"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  cellRender={(cellData: any) => (
                    <div>
                      <div>{cellData.value}</div>
                      {cellData.data.ownerPhone && (
                        <div className="text-xs text-gray-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {cellData.data.ownerPhone}
                        </div>
                      )}
                    </div>
                  )}
                />
                <Column
                  dataField="occupancyStatus"
                  caption="Occupancy"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  cellRender={(cellData: any) => (
                    <Badge variant="outline" className="text-xs">
                      {occupancyLabels[cellData.value] || cellData.value}
                    </Badge>
                  )}
                />
                <Column
                  dataField="totalOutstanding"
                  caption="Outstanding"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span className={`font-medium ${cellData.value > 0 ? 'text-red-600' : ''}`}>
                      {cellData.value > 0 ? formatNumber(cellData.value) : "-"}
                    </span>
                  )}
                />
                <Column
                  dataField="reliabilityScore"
                  caption="Reliability"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  width={100}
                  cellRender={(cellData: any) => (
                    <span className={`font-medium ${
                      cellData.value >= 80 ? 'text-green-600' :
                      cellData.value >= 50 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {cellData.value}%
                    </span>
                  )}
                />
                <Column
                  dataField="overdueCount"
                  caption="Overdue"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  width={90}
                  cellRender={(cellData: any) => (
                    <span className={cellData.value > 0 ? 'text-red-600 font-medium' : ''}>
                      {cellData.value > 0 ? cellData.value : "-"}
                    </span>
                  )}
                />
                <Column
                  dataField="lastPaymentDate"
                  caption="Last Payment"
                  dataType="date"
                  allowSorting={true}
                  allowFiltering={true}
                  cellRender={(cellData: any) => (
                    <span className="text-sm">
                      {cellData.value ? new Date(cellData.value).toLocaleDateString() : "Never"}
                    </span>
                  )}
                />

                <Summary>
                  <TotalItem
                    column="unitNumber"
                    summaryType="count"
                    displayFormat="{0} units"
                  />
                  <TotalItem
                    column="totalOutstanding"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                </Summary>
              </DataGrid>
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
