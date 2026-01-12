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
  Editing,
  Toolbar,
  Item,
  RequiredRule,
  EmailRule,
} from "devextreme-react/data-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Users, Building2, Building, Printer, FileSpreadsheet, FileText } from "lucide-react"
import { toast } from "sonner"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"

interface Unit {
  id: string
  unitNumber: string
}

interface Owner {
  id: string
  lastName: string
  firstName: string
  middleName: string | null
  email: string | null
  phone: string | null
  address: string | null
  units: Unit[]
  _count: {
    units: number
  }
}

// Building filter type
type BuildingFilter = "ALL" | "M1" | "M2"

// Helper to determine which building(s) an owner belongs to
const getOwnerBuilding = (owner: Owner): string => {
  if (!owner.units || owner.units.length === 0) return "None"
  const hasM1 = owner.units.some(u => u.unitNumber.startsWith("M1-"))
  const hasM2 = owner.units.some(u => u.unitNumber.startsWith("M2-"))
  if (hasM1 && hasM2) return "Both"
  if (hasM1) return "M1"
  if (hasM2) return "M2"
  return "Other"
}

// Helper to get full name
const getFullName = (owner: Owner) => {
  const middle = owner.middleName ? ` ${owner.middleName.charAt(0)}.` : ''
  return `${owner.lastName}, ${owner.firstName}${middle}`
}

export default function OwnersPage() {
  const [owners, setOwners] = useState<Owner[]>([])
  const [loading, setLoading] = useState(true)
  const [assignDialogOpen, setAssignDialogOpen] = useState(false)
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null)
  const [buildingFilter, setBuildingFilter] = useState<BuildingFilter>("ALL")
  const gridRef = useRef<any>(null)

  // Filter owners by building
  const filteredOwners = useMemo(() => {
    if (buildingFilter === "ALL") return owners
    return owners.filter(owner => {
      const building = getOwnerBuilding(owner)
      if (buildingFilter === "M1") return building === "M1" || building === "Both"
      if (buildingFilter === "M2") return building === "M2" || building === "Both"
      return true
    })
  }, [owners, buildingFilter])

  // Stats by building
  const stats = useMemo(() => {
    const m1Owners = owners.filter(o => {
      const b = getOwnerBuilding(o)
      return b === "M1" || b === "Both"
    }).length
    const m2Owners = owners.filter(o => {
      const b = getOwnerBuilding(o)
      return b === "M2" || b === "Both"
    }).length
    const m1Units = owners.reduce((sum, o) =>
      sum + (o.units?.filter(u => u.unitNumber.startsWith("M1-")).length || 0), 0)
    const m2Units = owners.reduce((sum, o) =>
      sum + (o.units?.filter(u => u.unitNumber.startsWith("M2-")).length || 0), 0)
    return { m1Owners, m2Owners, m1Units, m2Units }
  }, [owners])

  useEffect(() => {
    fetchOwners()
  }, [])

  const fetchOwners = async () => {
    try {
      const res = await fetch("/api/owners")
      if (!res.ok) throw new Error("Failed to fetch owners")
      const data = await res.json()
      setOwners(data)
    } catch (error) {
      toast.error("Failed to load owners")
    } finally {
      setLoading(false)
    }
  }

  const onRowInserting = (e: any) => {
    e.cancel = (async () => {
      const res = await fetch("/api/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(e.data),
      })
      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || "Failed to create owner")
        throw new Error(error.error || "Failed to create owner")
      }
      toast.success("Owner created successfully")
      fetchOwners()
    })()
  }

  const onRowUpdating = (e: any) => {
    e.cancel = (async () => {
      const updatedData = { ...e.oldData, ...e.newData }
      const res = await fetch(`/api/owners/${e.key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastName: updatedData.lastName,
          firstName: updatedData.firstName,
          middleName: updatedData.middleName,
          email: updatedData.email,
          phone: updatedData.phone,
          address: updatedData.address,
        }),
      })
      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || "Failed to update owner")
        throw new Error(error.error || "Failed to update owner")
      }
      toast.success("Owner updated successfully")
      fetchOwners()
    })()
  }

  const onRowRemoving = (e: any) => {
    const owner = owners.find(o => o.id === e.key)
    if (owner && owner._count.units > 0) {
      toast.error("Cannot delete owner with assigned units")
      e.cancel = true
      return
    }
    e.cancel = (async () => {
      const res = await fetch(`/api/owners/${e.key}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const error = await res.json()
        toast.error(error.error || "Failed to delete owner")
        throw new Error(error.error || "Failed to delete owner")
      }
      toast.success("Owner deleted successfully")
      fetchOwners()
    })()
  }

  const openAssignDialog = (owner: Owner) => {
    setSelectedOwner(owner)
    setAssignDialogOpen(true)
  }

  const unitsCellRender = (data: any) => {
    const units = data.value || []
    const count = data.data._count?.units || 0
    return (
      <div className="flex items-center gap-2">
        <Badge variant="default">{count} units</Badge>
        {count > 0 && (
          <Button
            variant="link"
            size="sm"
            className="text-xs p-0 h-auto"
            onClick={() => openAssignDialog(data.data)}
          >
            View
          </Button>
        )}
      </div>
    )
  }

  // Export to Excel
  const handleExportExcel = () => {
    const wsData: any[] = []

    // Header row
    wsData.push([
      "Building",
      "Last Name",
      "First Name",
      "Middle Name",
      "Email",
      "Phone",
      "Units Owned",
      "Unit Numbers"
    ])

    // Data rows
    for (const owner of filteredOwners) {
      const building = getOwnerBuilding(owner)
      const unitNumbers = owner.units?.map(u => u.unitNumber).join(", ") || ""
      wsData.push([
        building,
        owner.lastName,
        owner.firstName,
        owner.middleName || "",
        owner.email || "",
        owner.phone || "",
        owner._count?.units || 0,
        unitNumbers
      ])
    }

    // Summary row
    wsData.push([])
    wsData.push([
      `Total: ${filteredOwners.length} owners`,
      "",
      "",
      "",
      "",
      "",
      filteredOwners.reduce((sum, o) => sum + (o._count?.units || 0), 0) + " units",
      ""
    ])

    const ws = XLSX.utils.aoa_to_sheet(wsData)
    ws["!cols"] = [
      { wch: 12 },  // Building
      { wch: 18 },  // Last Name
      { wch: 18 },  // First Name
      { wch: 15 },  // Middle Name
      { wch: 25 },  // Email
      { wch: 15 },  // Phone
      { wch: 12 },  // Units Owned
      { wch: 30 },  // Unit Numbers
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Owners")

    const filterLabel = buildingFilter === "ALL" ? "All" : buildingFilter
    const fileName = `Owners_${filterLabel}_${new Date().toISOString().split("T")[0]}.xlsx`
    XLSX.writeFile(wb, fileName)
    toast.success("Excel file downloaded")
  }

  // Export to PDF
  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" })

    // Title
    doc.setFontSize(16)
    const title = buildingFilter === "ALL"
      ? "Owners List - All Buildings"
      : `Owners List - ${buildingFilter === "M1" ? "Megatower I" : "Megatower II"}`
    doc.text(title, 14, 15)

    // Subtitle with date
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 22)
    doc.text(`Total: ${filteredOwners.length} owners`, 14, 28)

    // Table data
    const tableData = filteredOwners.map((owner) => [
      getOwnerBuilding(owner),
      owner.lastName,
      owner.firstName,
      owner.middleName || "-",
      owner.email || "-",
      owner.phone || "-",
      owner._count?.units || 0,
      owner.units?.map(u => u.unitNumber).join(", ") || "-"
    ])

    autoTable(doc, {
      head: [["Building", "Last Name", "First Name", "Middle", "Email", "Phone", "Units", "Unit Numbers"]],
      body: tableData,
      startY: 34,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 30 },
        2: { cellWidth: 30 },
        3: { cellWidth: 20 },
        4: { cellWidth: 40 },
        5: { cellWidth: 25 },
        6: { cellWidth: 15 },
        7: { cellWidth: 50 },
      }
    })

    const filterLabel = buildingFilter === "ALL" ? "All" : buildingFilter
    doc.save(`Owners_${filterLabel}_${new Date().toISOString().split("T")[0]}.pdf`)
    toast.success("PDF file downloaded")
  }

  // Print function
  const handlePrint = () => {
    const printContent = `
      <html>
        <head>
          <title>Owners List</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { font-size: 18px; margin-bottom: 5px; }
            .subtitle { font-size: 12px; color: #666; margin-bottom: 15px; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; }
            th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
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
          <h1>${buildingFilter === "ALL" ? "Owners List - All Buildings" : `Owners List - ${buildingFilter === "M1" ? "Megatower I" : "Megatower II"}`}</h1>
          <div class="subtitle">Generated: ${new Date().toLocaleString()}</div>
          <table>
            <thead>
              <tr>
                <th>Building</th>
                <th>Last Name</th>
                <th>First Name</th>
                <th>Middle</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Units</th>
                <th>Unit Numbers</th>
              </tr>
            </thead>
            <tbody>
              ${filteredOwners.map(owner => `
                <tr>
                  <td>${getOwnerBuilding(owner)}</td>
                  <td>${owner.lastName}</td>
                  <td>${owner.firstName}</td>
                  <td>${owner.middleName || '-'}</td>
                  <td>${owner.email || '-'}</td>
                  <td>${owner.phone || '-'}</td>
                  <td>${owner._count?.units || 0}</td>
                  <td>${owner.units?.map(u => u.unitNumber).join(", ") || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="summary">Total: ${filteredOwners.length} owners, ${filteredOwners.reduce((sum, o) => sum + (o._count?.units || 0), 0)} units</div>
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Owners Management</h1>
            <p className="text-gray-500">Manage all {owners.length} unit owners</p>
          </div>
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
        </div>

        {/* Building Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={buildingFilter === "ALL" ? "default" : "outline"}
            onClick={() => setBuildingFilter("ALL")}
            className={buildingFilter === "ALL" ? "bg-blue-600 hover:bg-blue-700 text-white" : ""}
          >
            All Buildings ({owners.length})
          </Button>
          <Button
            variant={buildingFilter === "M1" ? "default" : "outline"}
            onClick={() => setBuildingFilter("M1")}
            className={buildingFilter === "M1" ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <Building className="w-4 h-4 mr-2" />
            Megatower I ({stats.m1Owners})
          </Button>
          <Button
            variant={buildingFilter === "M2" ? "default" : "outline"}
            onClick={() => setBuildingFilter("M2")}
            className={buildingFilter === "M2" ? "bg-green-600 hover:bg-green-700" : ""}
          >
            <Building2 className="w-4 h-4 mr-2" />
            Megatower II ({stats.m2Owners})
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-gray-600" />
              <div>
                <p className="text-sm text-gray-500">
                  {buildingFilter === "ALL" ? "Total Owners" : `${buildingFilter} Owners`}
                </p>
                <p className="text-2xl font-bold">{filteredOwners.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-blue-200 bg-blue-50">
            <div className="flex items-center gap-3">
              <Building className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-blue-700">Megatower I</p>
                <p className="text-2xl font-bold text-blue-800">{stats.m1Owners} owners</p>
                <p className="text-sm text-blue-600">{stats.m1Units} units</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-green-200 bg-green-50">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-green-700">Megatower II</p>
                <p className="text-2xl font-bold text-green-800">{stats.m2Owners} owners</p>
                <p className="text-sm text-green-600">{stats.m2Units} units</p>
              </div>
            </div>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-gray-500">Multiple Units</p>
                <p className="text-2xl font-bold">{owners.filter((o) => o._count.units > 1).length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <DataGrid
            ref={gridRef}
            dataSource={filteredOwners}
            keyExpr="id"
            showBorders={true}
            showRowLines={true}
            showColumnLines={true}
            rowAlternationEnabled={true}
            columnAutoWidth={true}
            onRowInserting={onRowInserting}
            onRowUpdating={onRowUpdating}
            onRowRemoving={onRowRemoving}
          >
            <Paging defaultPageSize={20} />
            <Pager showPageSizeSelector={true} allowedPageSizes={[10, 20, 50, 100]} showInfo={true} />
            <FilterRow visible={true} />
            <HeaderFilter visible={true} />
            <SearchPanel visible={true} placeholder="Search owners..." />
            <Editing
              mode="popup"
              allowAdding={true}
              allowUpdating={true}
              allowDeleting={true}
              popup={{ title: "Owner Information", showTitle: true, width: 550, height: 400 }}
            />

            <Column
              caption="Building"
              width={100}
              calculateCellValue={(rowData: Owner) => getOwnerBuilding(rowData)}
              cellRender={(data: any) => {
                const building = data.value
                if (building === "M1") return <Badge className="bg-blue-600 text-white">Megatower I</Badge>
                if (building === "M2") return <Badge className="bg-green-600 text-white">Megatower II</Badge>
                if (building === "Both") return <Badge className="bg-purple-600 text-white">Both</Badge>
                return <Badge variant="secondary">{building}</Badge>
              }}
              allowEditing={false}
              formItem={{ visible: false }}
            />
            <Column dataField="lastName" caption="Last Name" width={150}>
              <RequiredRule message="Last name is required" />
            </Column>
            <Column dataField="firstName" caption="First Name" width={150}>
              <RequiredRule message="First name is required" />
            </Column>
            <Column dataField="middleName" caption="Middle Name" width={120} />
            <Column dataField="email" caption="Email" width={180}>
              <EmailRule message="Invalid email format" />
            </Column>
            <Column dataField="phone" caption="Phone" width={130} />
            <Column dataField="address" caption="Address" width={200} visible={false} />
            <Column
              dataField="units"
              caption="Units Owned"
              width={200}
              cellRender={unitsCellRender}
              allowEditing={false}
              allowFiltering={false}
              allowSorting={false}
              formItem={{ visible: false }}
            />

            <Toolbar>
              <Item name="addRowButton" showText="always" />
              <Item name="searchPanel" />
            </Toolbar>
          </DataGrid>
        </div>
      </div>

      {/* Unit Assignment Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="max-w-md max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Units Owned by {selectedOwner && getFullName(selectedOwner)}</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[50vh] space-y-2 py-4">
            {selectedOwner?.units && selectedOwner.units.length > 0 ? (
              selectedOwner.units.map(unit => (
                <div key={unit.id} className="flex items-center space-x-3 p-2 bg-gray-50 rounded">
                  <span className="font-medium">{unit.unitNumber}</span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No units assigned</p>
            )}
          </div>
          <div className="text-sm text-gray-500 border-t pt-4">
            To assign or transfer units, go to <strong>Units</strong> page and change the owner there.
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
