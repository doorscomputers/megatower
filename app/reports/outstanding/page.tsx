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
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  DollarSign,
  Printer,
  RefreshCw,
  FileSpreadsheet,
  FileText,
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

interface UnitBalance {
  unitId: string
  unitNumber: string
  floorLevel: string
  ownerName: string
  area: number
  unitType: string
  electric: number
  water: number
  dues: number
  penalty: number
  spAssessment: number
  parking: number
  other: number
  totalBalance: number
  oldestDueDate: string | null
  billsCount: number
}

interface FloorData {
  units: UnitBalance[]
  subtotals: {
    electric: number
    water: number
    dues: number
    penalty: number
    spAssessment: number
    parking: number
    other: number
    totalBalance: number
    unitsCount: number
  }
}

interface ReportData {
  data: UnitBalance[]
  byFloor: Record<string, FloorData>
  grandTotals: {
    electric: number
    water: number
    dues: number
    penalty: number
    spAssessment: number
    parking: number
    other: number
    totalBalance: number
    unitsCount: number
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

export default function OutstandingBalancesPage() {
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<ReportData | null>(null)
  const [floorFilter, setFloorFilter] = useState("")
  const [sortBy, setSortBy] = useState("unit")
  const [showAll, setShowAll] = useState(false)
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
      let url = `/api/reports/outstanding?sortBy=${sortBy}&showAll=${showAll}`
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
    fetchFloors()
  }, [])

  useEffect(() => {
    fetchReport()
  }, [floorFilter, sortBy, showAll])

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push([
      "Unit",
      "Owner",
      "Floor",
      "Type",
      "Electric",
      "Water",
      "Dues",
      "Penalty",
      "SP Assessment",
      "Parking",
      "Other",
      "Total Balance",
    ])

    for (const unit of report.data) {
      wsData.push([
        unit.unitNumber,
        unit.ownerName,
        unit.floorLevel,
        unit.unitType,
        unit.electric,
        unit.water,
        unit.dues,
        unit.penalty,
        unit.spAssessment,
        unit.parking,
        unit.other,
        unit.totalBalance,
      ])
    }

    wsData.push([])
    wsData.push([
      "GRAND TOTAL",
      "",
      "",
      `${report.grandTotals.unitsCount} units`,
      report.grandTotals.electric,
      report.grandTotals.water,
      report.grandTotals.dues,
      report.grandTotals.penalty,
      report.grandTotals.spAssessment,
      report.grandTotals.parking,
      report.grandTotals.other,
      report.grandTotals.totalBalance,
    ])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 12 },
      { wch: 25 },
      { wch: 8 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Outstanding Balances")

    const fileName = `Outstanding_Balances_${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(16)
    doc.text("Outstanding Balances Report", 14, 15)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date(report.generatedAt).toLocaleString()}`, 14, 22)

    const tableData = report.data.map((unit) => [
      unit.unitNumber,
      unit.ownerName,
      unit.floorLevel,
      formatNumber(unit.electric),
      formatNumber(unit.water),
      formatNumber(unit.dues),
      formatNumber(unit.penalty),
      formatNumber(unit.spAssessment),
      formatNumber(unit.other),
      formatNumber(unit.totalBalance),
    ])

    tableData.push([
      { content: "GRAND TOTAL", styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: `${report.grandTotals.unitsCount} units`, styles: { fontStyle: "bold", fillColor: [220, 220, 220] } },
      { content: "", styles: { fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.electric), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.water), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.dues), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.penalty), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.spAssessment), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.other), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.grandTotals.totalBalance), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
    ])

    autoTable(doc, {
      head: [["Unit", "Owner", "Floor", "Electric", "Water", "Dues", "Penalty", "SP Assess", "Other", "Total"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    doc.save(`Outstanding_Balances_${new Date().toISOString().split("T")[0]}.pdf`)
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
            <h1 className="text-3xl font-bold text-gray-900">Outstanding Balances Report</h1>
            <p className="text-gray-500">
              View all units with unpaid balances
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

              <div className="w-48">
                <Label htmlFor="sortBy">Sort By</Label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unit">Unit Number</SelectItem>
                    <SelectItem value="balance">Highest Balance</SelectItem>
                    <SelectItem value="oldest">Oldest Due Date</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="showAll"
                  checked={showAll}
                  onCheckedChange={(checked) => setShowAll(checked as boolean)}
                />
                <Label htmlFor="showAll" className="cursor-pointer">
                  Show all units (including zero balance)
                </Label>
              </div>

              <Button onClick={fetchReport} disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Summary Card */}
        {report && (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 rounded-lg">
                  <DollarSign className="h-8 w-8 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-red-600">Total Outstanding Balance</p>
                  <p className="text-3xl font-bold text-red-700">
                    {formatCurrency(report.grandTotals.totalBalance)}
                  </p>
                  <p className="text-sm text-red-600">
                    {report.grandTotals.unitsCount} units with balance
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Report Table */}
        {report && (
          <Card>
            <CardHeader>
              <CardTitle>Outstanding Balances by Unit</CardTitle>
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
                  calculateSortValue={(rowData: UnitBalance) => getUnitSortValue(rowData.unitNumber)}
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
                  dataField="unitType"
                  caption="Type"
                  allowSorting={true}
                  allowFiltering={true}
                  allowHeaderFiltering={true}
                  width={100}
                />
                <Column
                  dataField="electric"
                  caption="Electric"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span>{cellData.value > 0 ? formatNumber(cellData.value) : "-"}</span>
                  )}
                />
                <Column
                  dataField="water"
                  caption="Water"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span>{cellData.value > 0 ? formatNumber(cellData.value) : "-"}</span>
                  )}
                />
                <Column
                  dataField="dues"
                  caption="Dues"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span>{cellData.value > 0 ? formatNumber(cellData.value) : "-"}</span>
                  )}
                />
                <Column
                  dataField="penalty"
                  caption="Penalty"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cssClass="bg-red-50"
                  cellRender={(cellData: any) => (
                    <span className={cellData.value > 0 ? "text-red-600" : ""}>
                      {cellData.value > 0 ? formatNumber(cellData.value) : "-"}
                    </span>
                  )}
                />
                <Column
                  dataField="spAssessment"
                  caption="SP Assess"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span>{cellData.value > 0 ? formatNumber(cellData.value) : "-"}</span>
                  )}
                />
                <Column
                  dataField="parking"
                  caption="Parking"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span>{cellData.value > 0 ? formatNumber(cellData.value) : "-"}</span>
                  )}
                />
                <Column
                  dataField="other"
                  caption="Other"
                  dataType="number"
                  allowSorting={true}
                  allowFiltering={true}
                  alignment="right"
                  cellRender={(cellData: any) => (
                    <span>{cellData.value > 0 ? formatNumber(cellData.value) : "-"}</span>
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
                    <span className="font-bold text-red-600">{formatNumber(cellData.value)}</span>
                  )}
                />

                <Summary>
                  <TotalItem
                    column="unitNumber"
                    summaryType="count"
                    displayFormat="{0} units"
                  />
                  <TotalItem
                    column="electric"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="water"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="dues"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="penalty"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="spAssessment"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="parking"
                    summaryType="sum"
                    valueFormat={{ type: "fixedPoint", precision: 2 }}
                    displayFormat="{0}"
                  />
                  <TotalItem
                    column="other"
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
