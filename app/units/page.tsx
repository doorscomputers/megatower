"use client"

import { useEffect, useState, useRef, useMemo } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import DataGrid, {
  Column,
  Paging,
  Pager,
  FilterRow,
  HeaderFilter,
  SearchPanel,
  Toolbar,
  Item,
} from "devextreme-react/data-grid"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Plus, Building2, Building, Pencil, Trash2, Printer, FileSpreadsheet, FileText } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

// Building filter type
type BuildingFilter = "ALL" | "M1" | "M2"

// Helper to determine which building a unit belongs to
const getUnitBuilding = (unitNumber: string): string => {
  if (unitNumber.startsWith("M1-")) return "M1"
  if (unitNumber.startsWith("M2-")) return "M2"
  return "Other"
}

interface Owner {
  id: string
  name: string
  lastName: string
  firstName: string
  middleName: string | null
  email: string | null
  phone: string | null
}

interface Unit {
  id: string
  unitNumber: string
  floorLevel: string
  area: number
  parkingArea: number
  unitType: string
  occupancyStatus: string
  isActive: boolean
  owner: Owner
  ownerId: string
}

interface UnitFormData {
  unitNumber: string
  floorLevel: string
  area: string
  parkingArea: string
  unitType: string
  ownerId: string
  occupancyStatus: string
}

const DEFAULT_FLOORS = ["GF", "2F", "3F", "4F", "5F", "6F"]
const UNIT_TYPES = ["RESIDENTIAL", "COMMERCIAL"]
const OCCUPANCY_STATUS = ["OCCUPIED", "VACANT", "OWNER_OCCUPIED", "RENTED"]

const initialFormData: UnitFormData = {
  unitNumber: "",
  floorLevel: "",
  area: "",
  parkingArea: "",
  unitType: "",
  ownerId: "",
  occupancyStatus: "OCCUPIED",
}

export default function UnitsPage() {
  const [units, setUnits] = useState<Unit[]>([])
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [floors, setFloors] = useState<string[]>(DEFAULT_FLOORS)
  const [buildingFilter, setBuildingFilter] = useState<BuildingFilter>("ALL")

  // Sort units: M1 first, then M2, within each building sort by floor then unit number
  const sortUnits = (unitsList: Unit[]) => {
    return [...unitsList].sort((a, b) => {
      // Extract building (M1 or M2)
      const buildingA = a.unitNumber.startsWith("M1") ? 1 : a.unitNumber.startsWith("M2") ? 2 : 3
      const buildingB = b.unitNumber.startsWith("M1") ? 1 : b.unitNumber.startsWith("M2") ? 2 : 3
      if (buildingA !== buildingB) return buildingA - buildingB

      // Extract floor level number
      const floorA = parseInt(a.floorLevel.replace(/\D/g, "") || "0")
      const floorB = parseInt(b.floorLevel.replace(/\D/g, "") || "0")
      if (floorA !== floorB) return floorA - floorB

      // Extract unit number suffix
      const unitNumA = parseInt(a.unitNumber.split("-").pop() || "0")
      const unitNumB = parseInt(b.unitNumber.split("-").pop() || "0")
      return unitNumA - unitNumB
    })
  }

  // Filter units by building and sort
  const filteredUnits = useMemo(() => {
    let result = units
    if (buildingFilter !== "ALL") {
      result = units.filter(unit => {
        const building = getUnitBuilding(unit.unitNumber)
        return building === buildingFilter
      })
    }
    return sortUnits(result)
  }, [units, buildingFilter])

  // Stats by building
  const stats = useMemo(() => {
    const m1Units = units.filter(u => u.unitNumber.startsWith("M1-"))
    const m2Units = units.filter(u => u.unitNumber.startsWith("M2-"))
    return {
      m1Total: m1Units.length,
      m2Total: m2Units.length,
      m1Residential: m1Units.filter(u => u.unitType === "RESIDENTIAL").length,
      m2Residential: m2Units.filter(u => u.unitType === "RESIDENTIAL").length,
      m1Commercial: m1Units.filter(u => u.unitType === "COMMERCIAL").length,
      m2Commercial: m2Units.filter(u => u.unitType === "COMMERCIAL").length,
    }
  }, [units])

  // Dialog states
  const [showUnitDialog, setShowUnitDialog] = useState(false)
  const [showFloorDialog, setShowFloorDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  // Form state
  const [formData, setFormData] = useState<UnitFormData>(initialFormData)
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null)
  const [deletingUnit, setDeletingUnit] = useState<Unit | null>(null)
  const [saving, setSaving] = useState(false)

  const gridRef = useRef<any>(null)
  const floorInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchUnits()
    fetchOwners()
    fetchFloors()
  }, [])

  const fetchFloors = async () => {
    try {
      const res = await fetch("/api/floors")
      if (!res.ok) throw new Error("Failed to fetch floors")
      const data = await res.json()
      setFloors(data)
    } catch (error) {
      console.error("Failed to load floors:", error)
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
    } finally {
      setLoading(false)
    }
  }

  const fetchOwners = async () => {
    try {
      const res = await fetch("/api/owners")
      if (!res.ok) throw new Error("Failed to fetch owners")
      const data = await res.json()
      setOwners(data)
    } catch (error) {
      toast.error("Failed to load owners")
    }
  }

  const handleAddFloor = async () => {
    const inputValue = floorInputRef.current?.value || ""
    const floor = inputValue.trim().toUpperCase()
    if (!floor) {
      toast.error("Please enter a floor name")
      return
    }
    if (floors.includes(floor)) {
      toast.error("Floor already exists")
      return
    }

    try {
      const res = await fetch("/api/floors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ floorName: floor }),
      })

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || "Failed to add floor")
        return
      }

      await fetchFloors()
      // Auto-select the newly added floor
      setFormData((prev) => ({ ...prev, floorLevel: floor }))
      if (floorInputRef.current) {
        floorInputRef.current.value = ""
      }
      setShowFloorDialog(false)
      toast.success(`Floor "${floor}" added`)
    } catch (error) {
      toast.error("Failed to add floor")
    }
  }

  const openAddDialog = () => {
    setEditingUnit(null)
    setFormData(initialFormData)
    setShowUnitDialog(true)
  }

  const openEditDialog = (unit: Unit) => {
    setEditingUnit(unit)
    setFormData({
      unitNumber: unit.unitNumber,
      floorLevel: unit.floorLevel,
      area: unit.area.toString(),
      parkingArea: unit.parkingArea?.toString() || "0",
      unitType: unit.unitType,
      ownerId: unit.ownerId,
      occupancyStatus: unit.occupancyStatus,
    })
    setShowUnitDialog(true)
  }

  const openDeleteDialog = (unit: Unit) => {
    setDeletingUnit(unit)
    setShowDeleteDialog(true)
  }

  const handleSaveUnit = async () => {
    // Validation
    if (!formData.unitNumber || !formData.floorLevel || !formData.area || !formData.unitType || !formData.ownerId) {
      toast.error("Please fill in all required fields")
      return
    }

    // Validate unit number format (supports M1-GF-1, M2-2F-3, GF-1, 2F-5, etc.)
    const unitNumberPattern = /^[A-Z0-9]+(-[A-Z0-9]+)+$/
    if (!unitNumberPattern.test(formData.unitNumber.toUpperCase())) {
      toast.error("Unit number format should be like M1-GF-1, M2-2F-3, GF-1, etc.")
      return
    }

    setSaving(true)
    try {
      const payload = {
        unitNumber: formData.unitNumber.toUpperCase(),
        floorLevel: formData.floorLevel,
        area: parseFloat(formData.area),
        parkingArea: parseFloat(formData.parkingArea) || 0,
        unitType: formData.unitType,
        ownerId: formData.ownerId,
        occupancyStatus: formData.occupancyStatus,
      }

      let res: Response
      if (editingUnit) {
        res = await fetch(`/api/units/${editingUnit.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      } else {
        res = await fetch("/api/units", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      }

      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || "Failed to save unit")
        return
      }

      toast.success(editingUnit ? "Unit updated successfully" : "Unit created successfully")
      setShowUnitDialog(false)
      fetchUnits()
    } catch (error) {
      toast.error("Failed to save unit")
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteUnit = async () => {
    if (!deletingUnit) return

    setSaving(true)
    try {
      const res = await fetch(`/api/units/${deletingUnit.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        toast.error("Failed to delete unit")
        return
      }

      toast.success("Unit deleted successfully")
      setShowDeleteDialog(false)
      setDeletingUnit(null)
      fetchUnits()
    } catch (error) {
      toast.error("Failed to delete unit")
    } finally {
      setSaving(false)
    }
  }

  const cellRender = (data: any) => {
    const type = data.value
    return (
      <Badge variant={type === "RESIDENTIAL" ? "default" : "secondary"}>
        {type}
      </Badge>
    )
  }

  const statusCellRender = (data: any) => {
    const status = data.value
    const variants: Record<string, "success" | "warning" | "secondary"> = {
      OCCUPIED: "success",
      VACANT: "warning",
      OWNER_OCCUPIED: "default" as "success",
      RENTED: "secondary",
    }
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.replace("_", " ")}
      </Badge>
    )
  }

  const ownerCellRender = (data: any) => {
    const owner = data.data?.owner
    if (!owner) return null
    return (
      <div>
        <p className="font-medium text-sm">{owner.name}</p>
        {owner.email && (
          <p className="text-xs text-gray-500">{owner.email}</p>
        )}
      </div>
    )
  }

  const actionsCellRender = (data: any) => {
    const unit = data.data as Unit
    return (
      <div className="flex gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openEditDialog(unit)}
          className="h-8 w-8 p-0"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => openDeleteDialog(unit)}
          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Export to Excel
  const handleExportExcel = () => {
    const wsData: any[] = []

    // Header row
    wsData.push([
      "Building",
      "Unit Number",
      "Floor",
      "Area (sqm)",
      "Parking (sqm)",
      "Type",
      "Owner",
      "Email",
      "Phone",
      "Status"
    ])

    // Data rows
    for (const unit of filteredUnits) {
      wsData.push([
        getUnitBuilding(unit.unitNumber),
        unit.unitNumber,
        unit.floorLevel,
        unit.area,
        unit.parkingArea || 0,
        unit.unitType,
        unit.owner?.name || "-",
        unit.owner?.email || "-",
        unit.owner?.phone || "-",
        unit.occupancyStatus.replace("_", " ")
      ])
    }

    // Summary row
    wsData.push([])
    wsData.push([
      `Total: ${filteredUnits.length} units`,
      "",
      "",
      filteredUnits.reduce((sum, u) => sum + u.area, 0).toFixed(2),
      filteredUnits.reduce((sum, u) => sum + (u.parkingArea || 0), 0).toFixed(2)
    ])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 12 },  // Building
      { wch: 14 },  // Unit Number
      { wch: 8 },   // Floor
      { wch: 12 },  // Area
      { wch: 12 },  // Parking
      { wch: 14 },  // Type
      { wch: 25 },  // Owner
      { wch: 25 },  // Email
      { wch: 15 },  // Phone
      { wch: 15 },  // Status
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Units")

    const filterLabel = buildingFilter === "ALL" ? "All" : buildingFilter
    const fileName = `Units_${filterLabel}_${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success("Excel file downloaded")
  }

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" })

    // Title
    doc.setFontSize(16)
    const title = buildingFilter === "ALL"
      ? "Units List - All Buildings"
      : `Units List - ${buildingFilter === "M1" ? "Megatower I" : "Megatower II"}`
    doc.text(title, 14, 15)

    // Subtitle with date
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22)
    doc.text(`Total: ${filteredUnits.length} units | Total Area: ${filteredUnits.reduce((sum, u) => sum + u.area, 0).toFixed(2)} sqm`, 14, 28)

    // Table data
    const tableData = filteredUnits.map((unit) => [
      getUnitBuilding(unit.unitNumber),
      unit.unitNumber,
      unit.floorLevel,
      unit.area.toFixed(2),
      (unit.parkingArea || 0).toFixed(2),
      unit.unitType,
      unit.owner?.name || "-",
      unit.occupancyStatus.replace("_", " ")
    ])

    autoTable(doc, {
      head: [["Bldg", "Unit", "Floor", "Area", "Parking", "Type", "Owner", "Status"]],
      body: tableData,
      startY: 34,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 22 },
        2: { cellWidth: 15 },
        3: { cellWidth: 18 },
        4: { cellWidth: 18 },
        5: { cellWidth: 25 },
        6: { cellWidth: 60 },
        7: { cellWidth: 25 },
      }
    })

    const filterLabel = buildingFilter === "ALL" ? "All" : buildingFilter
    doc.save(`Units_${filterLabel}_${new Date().toISOString().split("T")[0]}.pdf`)
    toast.success("PDF file downloaded")
  }

  // Print function
  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Units List</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            .subtitle { font-size: 12px; color: #666; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #ddd; padding: 5px; text-align: left; }
            th { background-color: #3b82f6; color: white; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .summary { margin-top: 15px; font-weight: bold; }
            @media print {
              body { padding: 0; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <h1>${buildingFilter === "ALL" ? "Units List - All Buildings" : `Units List - ${buildingFilter === "M1" ? "Megatower I" : "Megatower II"}`}</h1>
          <div class="subtitle">Generated: ${new Date().toLocaleString()}</div>
          <table>
            <thead>
              <tr>
                <th>Bldg</th>
                <th>Unit</th>
                <th>Floor</th>
                <th>Area</th>
                <th>Parking</th>
                <th>Type</th>
                <th>Owner</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${filteredUnits.map(unit => `
                <tr>
                  <td>${getUnitBuilding(unit.unitNumber)}</td>
                  <td>${unit.unitNumber}</td>
                  <td>${unit.floorLevel}</td>
                  <td>${unit.area.toFixed(2)}</td>
                  <td>${(unit.parkingArea || 0).toFixed(2)}</td>
                  <td>${unit.unitType}</td>
                  <td>${unit.owner?.name || '-'}</td>
                  <td>${unit.occupancyStatus.replace("_", " ")}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="summary">
            Total: ${filteredUnits.length} units |
            Total Area: ${filteredUnits.reduce((sum, u) => sum + u.area, 0).toFixed(2)} sqm
          </div>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(printContent)
      printWindow.document.close()
      printWindow.onload = () => {
        printWindow.print()
      }
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Units Management</h1>
            <p className="text-gray-500">
              Manage all {units.length} condominium units
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Export Buttons */}
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
            <Button onClick={openAddDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Add Unit
            </Button>
          </div>
        </div>

        {/* Building Filter Buttons */}
        <div className="flex gap-2">
          <Button
            variant={buildingFilter === "ALL" ? "default" : "outline"}
            onClick={() => setBuildingFilter("ALL")}
            className={buildingFilter === "ALL" ? "bg-gray-800 hover:bg-gray-900" : ""}
          >
            All Buildings ({units.length})
          </Button>
          <Button
            variant={buildingFilter === "M1" ? "default" : "outline"}
            onClick={() => setBuildingFilter("M1")}
            className={buildingFilter === "M1" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <Building className="w-4 h-4 mr-2" />
            Megatower I ({stats.m1Total})
          </Button>
          <Button
            variant={buildingFilter === "M2" ? "default" : "outline"}
            onClick={() => setBuildingFilter("M2")}
            className={buildingFilter === "M2" ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Building2 className="w-4 h-4 mr-2" />
            Megatower II ({stats.m2Total})
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-gray-600" />
              <div>
                <p className="text-sm text-gray-500">
                  {buildingFilter === "ALL" ? "Total Units" : `${buildingFilter} Units`}
                </p>
                <p className="text-2xl font-bold">{filteredUnits.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-3">
              <Building className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-blue-700">Megatower I</p>
                <p className="text-2xl font-bold text-blue-800">{stats.m1Total} units</p>
                <p className="text-sm text-blue-600">{stats.m1Residential} res / {stats.m1Commercial} com</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200 bg-green-50">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-green-700">Megatower II</p>
                <p className="text-2xl font-bold text-green-800">{stats.m2Total} units</p>
                <p className="text-sm text-green-600">{stats.m2Residential} res / {stats.m2Commercial} com</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-500">Vacant</p>
            <p className="text-2xl font-bold">
              {filteredUnits.filter((u) => u.occupancyStatus === "VACANT").length}
            </p>
          </div>
        </div>

        {/* DataGrid */}
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <DataGrid
            ref={gridRef}
            dataSource={filteredUnits}
            keyExpr="id"
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            rowAlternationEnabled={true}
            columnAutoWidth={true}
          >
            <Paging defaultPageSize={20} />
            <Pager
              showPageSizeSelector={true}
              allowedPageSizes={[10, 20, 50, 100]}
              showInfo={true}
            />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <SearchPanel visible={true} placeholder="Search units..." />

            <Column
              caption="Building"
              width={100}
              calculateCellValue={(rowData: Unit) => getUnitBuilding(rowData.unitNumber)}
              cellRender={(data: any) => {
                const building = data.value
                if (building === "M1") return <Badge className="bg-blue-600 text-white">Megatower I</Badge>
                if (building === "M2") return <Badge className="bg-green-600 text-white">Megatower II</Badge>
                return <Badge variant="secondary">{building}</Badge>
              }}
            />
            <Column dataField="unitNumber" caption="Unit Number" width={120} />
            <Column dataField="floorLevel" caption="Floor" width={80} />
            <Column
              dataField="area"
              caption="Area (sqm)"
              dataType="number"
              format="#0.00"
              width={100}
            />
            <Column
              dataField="parkingArea"
              caption="Parking (sqm)"
              dataType="number"
              format="#0.00"
              width={110}
              cellRender={(data: any) => {
                const val = Number(data.value) || 0
                return val > 0 ? (
                  <span className="text-blue-600 font-medium">{val.toFixed(2)}</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )
              }}
            />
            <Column
              dataField="unitType"
              caption="Type"
              width={130}
              cellRender={cellRender}
            />
            <Column
              caption="Owner"
              width={250}
              calculateCellValue={(rowData: Unit) => rowData.owner?.name || "No Owner"}
              cellRender={ownerCellRender}
              filterOperations={["contains", "startswith", "endswith"]}
              selectedFilterOperation="contains"
            />
            <Column
              dataField="occupancyStatus"
              caption="Status"
              width={150}
              cellRender={statusCellRender}
            />
            <Column
              caption="Actions"
              width={100}
              cellRender={actionsCellRender}
              allowFiltering={false}
              allowSorting={false}
            />

            <Toolbar>
              <Item name="searchPanel" />
            </Toolbar>
          </DataGrid>
        </div>
      </div>

      {/* Add/Edit Unit Dialog */}
      <Dialog open={showUnitDialog} onOpenChange={setShowUnitDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {editingUnit ? "Edit Unit" : "Add New Unit"}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unitNumber">Unit Number *</Label>
                <Input
                  id="unitNumber"
                  placeholder="e.g., 2F-1"
                  value={formData.unitNumber}
                  onChange={(e) => setFormData({ ...formData, unitNumber: e.target.value.toUpperCase() })}
                />
                <p className="text-xs text-gray-500">Format: GF-1, 2F-5, etc.</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="floorLevel">Floor *</Label>
                <div className="flex gap-2">
                  <Select
                    value={formData.floorLevel}
                    onValueChange={(value) => setFormData({ ...formData, floorLevel: value })}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select floor" />
                    </SelectTrigger>
                    <SelectContent>
                      {floors.map((floor) => (
                        <SelectItem key={floor} value={floor}>
                          {floor}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setShowFloorDialog(true)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="area">Area (sqm) *</Label>
                <Input
                  id="area"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 45.5"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="parkingArea">Parking Area (sqm)</Label>
                <Input
                  id="parkingArea"
                  type="number"
                  step="0.01"
                  placeholder="e.g., 14"
                  value={formData.parkingArea}
                  onChange={(e) => setFormData({ ...formData, parkingArea: e.target.value })}
                />
                <p className="text-xs text-gray-500">Leave 0 if no parking</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unitType">Type *</Label>
                <Select
                  value={formData.unitType}
                  onValueChange={(value) => setFormData({ ...formData, unitType: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="occupancyStatus">Status *</Label>
                <Select
                  value={formData.occupancyStatus}
                  onValueChange={(value) => setFormData({ ...formData, occupancyStatus: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {OCCUPANCY_STATUS.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ownerId">Owner *</Label>
              <Select
                value={formData.ownerId}
                onValueChange={(value) => setFormData({ ...formData, ownerId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select owner" />
                </SelectTrigger>
                <SelectContent>
                  {owners.map((owner) => (
                    <SelectItem key={owner.id} value={owner.id}>
                      {owner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUnitDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveUnit} disabled={saving}>
              {saving ? "Saving..." : editingUnit ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Floor Dialog */}
      <Dialog open={showFloorDialog} onOpenChange={(open) => {
        if (!open && floorInputRef.current) {
          floorInputRef.current.value = ""
        }
        setShowFloorDialog(open)
      }}>
        <DialogContent className="sm:max-w-[350px]">
          <DialogHeader>
            <DialogTitle>Add New Floor</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newFloor">Floor Name</Label>
            <Input
              ref={floorInputRef}
              id="newFloor"
              placeholder="e.g., 7F, B1, PH"
              className="mt-2"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  handleAddFloor()
                }
              }}
            />
            <p className="text-xs text-gray-500 mt-2">
              Examples: 7F, 8F, B1, B2, PH (Penthouse)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFloorDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddFloor}>Add Floor</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Delete Unit</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>Are you sure you want to delete unit <strong>{deletingUnit?.unitNumber}</strong>?</p>
            <p className="text-sm text-gray-500 mt-2">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteUnit} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
