"use client"

import { useState, useEffect } from "react"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  FileText,
  Printer,
  DollarSign,
  FileSpreadsheet,
} from "lucide-react"
import { toast } from "sonner"
import { format } from "date-fns"
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

interface Collection {
  id: string
  orNumber: string | null
  paymentDate: string
  unit: {
    unitNumber: string
    floorLevel: string
  }
  owner: string
  amount: number
  advanceAmount: number
  paymentMethod: string
  referenceNumber: string | null
  checkNumber: string | null
  bankName: string | null
  componentBreakdown: {
    electric: number
    water: number
    dues: number
    penalty: number
    other: number
  }
  appliedToBills: Array<{
    billNumber: string
    billingMonth: string
    amount: number
  }>
}

interface CollectionReport {
  reportDate: {
    start: string
    end: string
    isSingleDay: boolean
  }
  totals: {
    totalAmount: number
    totalElectric: number
    totalWater: number
    totalDues: number
    totalPenalty: number
    totalOther: number
    totalAdvance: number
    paymentCount: number
    byMethod: Record<string, number>
  }
  byFloor: Record<
    string,
    {
      count: number
      amount: number
      electric: number
      water: number
      dues: number
    }
  >
  collections: Collection[]
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

const formatMethod = (method: string) => {
  return method.replace(/_/g, " ")
}

export default function CollectionReportPage() {
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [endDate, setEndDate] = useState("")
  const [floorFilter, setFloorFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [report, setReport] = useState<CollectionReport | null>(null)
  const [floors, setFloors] = useState<string[]>([])

  // Flatten collections data for DataGrid
  const gridData = report?.collections.map((c) => ({
    id: c.id,
    orNumber: c.orNumber || "-",
    unitNumber: c.unit.unitNumber,
    floorLevel: c.unit.floorLevel,
    owner: c.owner,
    paymentMethod: c.paymentMethod,
    electric: c.componentBreakdown.electric,
    water: c.componentBreakdown.water,
    dues: c.componentBreakdown.dues,
    penalty: c.componentBreakdown.penalty,
    other: c.componentBreakdown.other,
    amount: c.amount,
    paymentDate: c.paymentDate,
  })) || []

  const fetchFloors = async () => {
    try {
      const res = await fetch("/api/floors")
      if (!res.ok) throw new Error("Failed to fetch floors")
      const data = await res.json()
      setFloors(data)
    } catch (error: any) {
      toast.error(error.message)
    }
  }

  useEffect(() => {
    fetchFloors()
  }, [])

  const handleGenerate = async () => {
    try {
      setLoading(true)
      let url = `/api/reports/collections?startDate=${startDate}`
      if (endDate) url += `&endDate=${endDate}`
      if (floorFilter) url += `&floorLevel=${floorFilter}`

      const res = await fetch(url)
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || "Failed to generate report")
      }

      const data = await res.json()
      setReport(data)
      toast.success("Report generated successfully")
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleExportExcel = () => {
    if (!report) return

    const wsData: any[] = []

    wsData.push([
      "OR#",
      "Unit",
      "Floor",
      "Owner",
      "Method",
      "Electric",
      "Water",
      "Dues",
      "Penalty",
      "Other",
      "Total",
    ])

    for (const c of report.collections) {
      wsData.push([
        c.orNumber || "-",
        c.unit.unitNumber,
        c.unit.floorLevel,
        c.owner,
        formatMethod(c.paymentMethod),
        c.componentBreakdown.electric,
        c.componentBreakdown.water,
        c.componentBreakdown.dues,
        c.componentBreakdown.penalty,
        c.componentBreakdown.other,
        c.amount,
      ])
    }

    wsData.push([])
    wsData.push([
      "TOTAL",
      "",
      "",
      "",
      `${report.totals.paymentCount} payments`,
      report.totals.totalElectric,
      report.totals.totalWater,
      report.totals.totalDues,
      report.totals.totalPenalty,
      report.totals.totalOther,
      report.totals.totalAmount,
    ])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 12 },
      { wch: 12 },
      { wch: 8 },
      { wch: 25 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Collections")

    const dateStr = report.reportDate.isSingleDay
      ? format(new Date(report.reportDate.start), "yyyy-MM-dd")
      : `${format(new Date(report.reportDate.start), "yyyy-MM-dd")}_to_${format(new Date(report.reportDate.end), "yyyy-MM-dd")}`
    const fileName = `Collections_${dateStr}.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success("Excel file downloaded")
  }

  const handleExportPDF = () => {
    if (!report) return

    const doc = new jsPDF({ orientation: "landscape" })

    doc.setFontSize(16)
    doc.text("Collection Report", 14, 15)
    doc.setFontSize(10)
    const dateTitle = report.reportDate.isSingleDay
      ? format(new Date(report.reportDate.start), "MMMM dd, yyyy")
      : `${format(new Date(report.reportDate.start), "MMM dd")} - ${format(new Date(report.reportDate.end), "MMM dd, yyyy")}`
    doc.text(dateTitle, 14, 22)

    const tableData = report.collections.map((c) => [
      c.orNumber || "-",
      c.unit.unitNumber,
      c.owner,
      formatMethod(c.paymentMethod),
      formatNumber(c.componentBreakdown.electric),
      formatNumber(c.componentBreakdown.water),
      formatNumber(c.componentBreakdown.dues),
      formatNumber(c.amount),
    ])

    tableData.push([
      { content: "TOTAL", styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: `${report.totals.paymentCount} payments`, styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: "", styles: { fillColor: [220, 220, 220] } } as any,
      { content: "", styles: { fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.totals.totalElectric), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.totals.totalWater), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.totals.totalDues), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
      { content: formatNumber(report.totals.totalAmount), styles: { fontStyle: "bold", fillColor: [220, 220, 220] } } as any,
    ])

    autoTable(doc, {
      head: [["OR#", "Unit", "Owner", "Method", "Electric", "Water", "Dues", "Total"]],
      body: tableData,
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
    })

    const dateStr = report.reportDate.isSingleDay
      ? format(new Date(report.reportDate.start), "yyyy-MM-dd")
      : `${format(new Date(report.reportDate.start), "yyyy-MM-dd")}_to_${format(new Date(report.reportDate.end), "yyyy-MM-dd")}`
    doc.save(`Collections_${dateStr}.pdf`)
    toast.success("PDF file downloaded")
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Daily Collection Report
            </h1>
            <p className="text-gray-500">
              View payment collections by date with OR# tracking
            </p>
          </div>

          {report && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleExportExcel}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel
              </Button>
              <Button variant="outline" onClick={handleExportPDF}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          )}
        </div>

        {/* Filter Form */}
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Report Parameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Label htmlFor="startDate">Start Date *</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="endDate">End Date (Optional)</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
              <div>
                <Label htmlFor="floor">Floor (Optional)</Label>
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
              <div className="flex items-end">
                <Button
                  onClick={handleGenerate}
                  disabled={loading || !startDate}
                  className="w-full"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  {loading ? "Generating..." : "Generate Report"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Report Display */}
        {report && (
          <>
            {/* Report Content */}
            <div className="bg-white p-6 rounded-lg border print:border-0 print:shadow-none">
              {/* Report Header */}
              <div className="text-center mb-6 border-b pb-4">
                <h2 className="text-xl font-bold text-gray-900">
                  MEGA TOWER RESIDENCES
                </h2>
                <p className="text-gray-600">Condominium Corporation</p>
                <p className="text-lg font-semibold mt-2">
                  {report.reportDate.isSingleDay
                    ? `Daily Collection Report - ${format(new Date(report.reportDate.start), "MMMM dd, yyyy")}`
                    : `Collection Report: ${format(new Date(report.reportDate.start), "MMM dd")} - ${format(new Date(report.reportDate.end), "MMM dd, yyyy")}`}
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <p className="text-sm text-green-600">Total Collections</p>
                  <p className="text-2xl font-bold text-green-900">
                    {formatCurrency(report.totals.totalAmount)}
                  </p>
                  <p className="text-xs text-green-600 mt-1">
                    {report.totals.paymentCount} payment(s)
                  </p>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-600">Electric</p>
                  <p className="text-xl font-bold text-blue-900">
                    {formatCurrency(report.totals.totalElectric)}
                  </p>
                </div>
                <div className="bg-cyan-50 p-4 rounded-lg border border-cyan-200">
                  <p className="text-sm text-cyan-600">Water</p>
                  <p className="text-xl font-bold text-cyan-900">
                    {formatCurrency(report.totals.totalWater)}
                  </p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                  <p className="text-sm text-purple-600">Assoc. Dues</p>
                  <p className="text-xl font-bold text-purple-900">
                    {formatCurrency(report.totals.totalDues)}
                  </p>
                </div>
              </div>

              {/* By Payment Method */}
              <div className="mb-6">
                <h3 className="font-semibold mb-2">By Payment Method</h3>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(report.totals.byMethod).map(
                    ([method, amount]) => (
                      <Badge key={method} variant="secondary" className="text-sm">
                        {formatMethod(method)}: {formatCurrency(amount)}
                      </Badge>
                    )
                  )}
                </div>
              </div>

              {/* By Floor Summary */}
              {Object.keys(report.byFloor).length > 1 && (
                <div className="mb-6">
                  <h3 className="font-semibold mb-2">By Floor</h3>
                  <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                    {Object.entries(report.byFloor)
                      .sort(([a], [b]) => a.localeCompare(b))
                      .map(([floor, data]) => (
                        <div
                          key={floor}
                          className="bg-gray-50 p-2 rounded text-center"
                        >
                          <p className="font-semibold">{floor}</p>
                          <p className="text-sm text-green-600">
                            {formatCurrency(data.amount)}
                          </p>
                          <p className="text-xs text-gray-500">
                            {data.count} payment(s)
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Collection Details DataGrid */}
              <Card>
                <CardHeader>
                  <CardTitle>Collection Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <DataGrid
                    dataSource={gridData}
                    keyExpr="id"
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
                      dataField="orNumber"
                      caption="OR#"
                      allowSorting={true}
                      allowFiltering={true}
                      allowHeaderFiltering={true}
                      cellRender={(cellData: any) => (
                        <span className="font-mono">{cellData.value}</span>
                      )}
                    />
                    <Column
                      dataField="unitNumber"
                      caption="Unit"
                      allowSorting={true}
                      allowFiltering={true}
                      allowHeaderFiltering={true}
                      calculateSortValue={(rowData: any) => getUnitSortValue(rowData.unitNumber)}
                      cellRender={(cellData: any) => (
                        <span className="font-medium">{cellData.value}</span>
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
                      dataField="owner"
                      caption="Owner"
                      allowSorting={true}
                      allowFiltering={true}
                      allowHeaderFiltering={true}
                    />
                    <Column
                      dataField="paymentMethod"
                      caption="Method"
                      allowSorting={true}
                      allowFiltering={true}
                      allowHeaderFiltering={true}
                      cellRender={(cellData: any) => (
                        <Badge variant="outline" className="text-xs">
                          {formatMethod(cellData.value)}
                        </Badge>
                      )}
                    />
                    <Column
                      dataField="electric"
                      caption="Electric"
                      dataType="number"
                      allowSorting={true}
                      allowFiltering={true}
                      alignment="right"
                      cellRender={(cellData: any) => (
                        <span className="font-mono">
                          {cellData.value > 0 ? formatNumber(cellData.value) : "-"}
                        </span>
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
                        <span className="font-mono">
                          {cellData.value > 0 ? formatNumber(cellData.value) : "-"}
                        </span>
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
                        <span className="font-mono">
                          {cellData.value > 0 ? formatNumber(cellData.value) : "-"}
                        </span>
                      )}
                    />
                    <Column
                      dataField="penalty"
                      caption="Penalty"
                      dataType="number"
                      allowSorting={true}
                      allowFiltering={true}
                      alignment="right"
                      cellRender={(cellData: any) => (
                        <span className="font-mono text-red-600">
                          {cellData.value > 0 ? formatNumber(cellData.value) : "-"}
                        </span>
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
                        <span className="font-mono">
                          {cellData.value > 0 ? formatNumber(cellData.value) : "-"}
                        </span>
                      )}
                    />
                    <Column
                      dataField="amount"
                      caption="Total"
                      dataType="number"
                      allowSorting={true}
                      allowFiltering={true}
                      alignment="right"
                      cellRender={(cellData: any) => (
                        <span className="font-mono font-bold text-green-700">
                          {formatNumber(cellData.value)}
                        </span>
                      )}
                    />

                    <Summary>
                      <TotalItem
                        column="orNumber"
                        summaryType="count"
                        displayFormat="{0} payments"
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
                        column="other"
                        summaryType="sum"
                        valueFormat={{ type: "fixedPoint", precision: 2 }}
                        displayFormat="{0}"
                      />
                      <TotalItem
                        column="amount"
                        summaryType="sum"
                        valueFormat={{ type: "fixedPoint", precision: 2 }}
                        displayFormat="{0}"
                      />
                    </Summary>
                  </DataGrid>
                </CardContent>
              </Card>

              {/* Advance Payments */}
              {report.totals.totalAdvance > 0 && (
                <div className="mt-4 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                  <p className="text-sm font-medium text-yellow-800">
                    Note: {formatCurrency(report.totals.totalAdvance)} recorded
                    as advance payments (excess over bill amounts)
                  </p>
                </div>
              )}

              {/* Footer */}
              <div className="mt-6 pt-4 border-t text-xs text-gray-500 text-center">
                <p>
                  Generated on {format(new Date(), "MMMM dd, yyyy 'at' h:mm a")}
                </p>
              </div>
            </div>
          </>
        )}

        {/* Empty State */}
        {!report && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <DollarSign className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                Select a date and generate the collection report
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
