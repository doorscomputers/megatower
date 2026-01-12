"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { format } from "date-fns"
import {
  Archive,
  FileText,
  Eye,
  Send,
  Trash2,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronRight,
  RefreshCw,
} from "lucide-react"

interface SOABatch {
  id: string
  batchNumber: string
  asOfDate: string
  billingMonth: string | null
  filterType: string
  filterValue: string | null
  status: "GENERATED" | "REVIEWED" | "DISTRIBUTED" | "CANCELLED"
  distributedAt: string | null
  totalUnits: number
  totalAmount: number
  totalBalance: number
  documentCount: number
  generatedBy: string
  createdAt: string
}

interface SOADocument {
  id: string
  unitNumber: string
  ownerName: string
  floorLevel: string
  totalBilled: number
  totalPaid: number
  currentBalance: number
  aging: {
    current: number
    days31to60: number
    days61to90: number
    over90days: number
  }
}

interface BatchDetail {
  id: string
  batchNumber: string
  asOfDate: string
  billingMonth: string | null
  filterType: string
  filterValue: string | null
  status: string
  distributedAt: string | null
  distributedBy: string | null
  totalUnits: number
  totalAmount: number
  totalBalance: number
  generatedBy: string
  remarks: string | null
  createdAt: string
  documents: SOADocument[]
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount)
}

const getStatusBadge = (status: string) => {
  switch (status) {
    case "GENERATED":
      return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200"><Clock className="w-3 h-3 mr-1" />Generated</Badge>
    case "REVIEWED":
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200"><Eye className="w-3 h-3 mr-1" />Reviewed</Badge>
    case "DISTRIBUTED":
      return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200"><CheckCircle2 className="w-3 h-3 mr-1" />Distributed</Badge>
    case "CANCELLED":
      return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200"><XCircle className="w-3 h-3 mr-1" />Cancelled</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

export default function SOAArchivePage() {
  const [batches, setBatches] = useState<SOABatch[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedBatch, setSelectedBatch] = useState<BatchDetail | null>(null)
  const [loadingBatch, setLoadingBatch] = useState(false)
  const [distributing, setDistributing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showDistributeDialog, setShowDistributeDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [batchToDelete, setBatchToDelete] = useState<SOABatch | null>(null)
  const [yearFilter, setYearFilter] = useState<string>(new Date().getFullYear().toString())

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  useEffect(() => {
    fetchBatches()
  }, [yearFilter])

  const fetchBatches = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (yearFilter) params.set("year", yearFilter)

      const response = await fetch(`/api/billing/soa/archive?${params}`)
      if (response.ok) {
        const data = await response.json()
        setBatches(data.batches)
      }
    } catch (error) {
      console.error("Error fetching batches:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchBatchDetail = async (batchId: string) => {
    setLoadingBatch(true)
    try {
      const response = await fetch(`/api/billing/soa/archive/${batchId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedBatch(data.batch)
      }
    } catch (error) {
      console.error("Error fetching batch detail:", error)
    } finally {
      setLoadingBatch(false)
    }
  }

  const handleDistribute = async () => {
    if (!selectedBatch) return

    setDistributing(true)
    try {
      const response = await fetch(`/api/billing/soa/archive/${selectedBatch.id}/distribute`, {
        method: "POST",
      })

      if (response.ok) {
        const data = await response.json()
        alert(`Success! ${data.billsLocked} bills have been locked.`)
        setShowDistributeDialog(false)
        fetchBatches()
        fetchBatchDetail(selectedBatch.id)
      } else {
        const error = await response.json()
        alert(error.error || "Failed to distribute batch")
      }
    } catch (error) {
      console.error("Error distributing batch:", error)
      alert("Failed to distribute batch")
    } finally {
      setDistributing(false)
    }
  }

  const handleDelete = async () => {
    if (!batchToDelete) return

    setDeleting(true)
    try {
      const response = await fetch(`/api/billing/soa/archive/${batchToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        alert("Batch deleted successfully")
        setShowDeleteDialog(false)
        setBatchToDelete(null)
        if (selectedBatch?.id === batchToDelete.id) {
          setSelectedBatch(null)
        }
        fetchBatches()
      } else {
        const error = await response.json()
        alert(error.error || "Failed to delete batch")
      }
    } catch (error) {
      console.error("Error deleting batch:", error)
      alert("Failed to delete batch")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Archive className="h-7 w-7 text-blue-600" />
              SOA Archive
            </h1>
            <p className="text-gray-600">View and manage generated Statement of Accounts</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {years.map(year => (
                  <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={fetchBatches}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Batch List */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">SOA Batches</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                  </div>
                ) : batches.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Archive className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p>No SOA batches found</p>
                    <p className="text-sm mt-1">Generate SOAs from the Statement of Account page</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {batches.map((batch) => (
                      <div
                        key={batch.id}
                        className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                          selectedBatch?.id === batch.id ? "bg-blue-50 border-l-4 border-blue-500" : ""
                        }`}
                        onClick={() => fetchBatchDetail(batch.id)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">
                              {batch.batchNumber}
                            </p>
                            <p className="text-sm text-gray-500">
                              {format(new Date(batch.asOfDate), "MMM dd, yyyy")}
                            </p>
                            <div className="mt-1">{getStatusBadge(batch.status)}</div>
                          </div>
                          <div className="text-right ml-4">
                            <p className="text-sm font-medium text-gray-900">
                              {batch.totalUnits} units
                            </p>
                            <p className="text-sm text-red-600 font-medium">
                              {formatCurrency(batch.totalBalance)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Batch Detail */}
          <div className="lg:col-span-2">
            {loadingBatch ? (
              <Card>
                <CardContent className="py-12">
                  <div className="flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                  </div>
                </CardContent>
              </Card>
            ) : selectedBatch ? (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {selectedBatch.batchNumber}
                      </CardTitle>
                      <p className="text-sm text-gray-500 mt-1">
                        Generated on {format(new Date(selectedBatch.createdAt), "MMMM dd, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedBatch.status !== "DISTRIBUTED" && selectedBatch.status !== "CANCELLED" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setBatchToDelete(batches.find(b => b.id === selectedBatch.id) || null)
                              setShowDeleteDialog(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-600 hover:bg-green-700"
                            onClick={() => setShowDistributeDialog(true)}
                          >
                            <Send className="h-4 w-4 mr-1" />
                            Distribute
                          </Button>
                        </>
                      )}
                      {getStatusBadge(selectedBatch.status)}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">As of Date</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {format(new Date(selectedBatch.asOfDate), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-sm text-blue-600">Total Units</p>
                      <p className="text-lg font-semibold text-blue-900">{selectedBatch.totalUnits}</p>
                    </div>
                    <div className="bg-gray-50 p-4 rounded-lg">
                      <p className="text-sm text-gray-600">Total Billed</p>
                      <p className="text-lg font-semibold text-gray-900">
                        {formatCurrency(selectedBatch.totalAmount)}
                      </p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-lg">
                      <p className="text-sm text-red-600">Total Balance</p>
                      <p className="text-lg font-semibold text-red-900">
                        {formatCurrency(selectedBatch.totalBalance)}
                      </p>
                    </div>
                  </div>

                  {selectedBatch.distributedAt && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle2 className="h-5 w-5" />
                        <span className="font-medium">Distributed on {format(new Date(selectedBatch.distributedAt), "MMMM dd, yyyy 'at' h:mm a")}</span>
                      </div>
                      <p className="text-sm text-green-600 mt-1">
                        All related bills are locked and cannot be modified.
                      </p>
                    </div>
                  )}

                  {/* Documents List */}
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-3">
                      SOA Documents ({selectedBatch.documents.length})
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Unit</th>
                            <th className="px-4 py-3 text-left font-medium text-gray-600">Owner</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-600">Billed</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-600">Paid</th>
                            <th className="px-4 py-3 text-right font-medium text-gray-600">Balance</th>
                            <th className="px-4 py-3 text-center font-medium text-gray-600">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {selectedBatch.documents.map((doc) => (
                            <tr key={doc.id} className="hover:bg-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {doc.unitNumber}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{doc.ownerName}</td>
                              <td className="px-4 py-3 text-right text-gray-900">
                                {formatCurrency(doc.totalBilled)}
                              </td>
                              <td className="px-4 py-3 text-right text-green-600">
                                {formatCurrency(doc.totalPaid)}
                              </td>
                              <td className={`px-4 py-3 text-right font-medium ${
                                doc.currentBalance > 0 ? "text-red-600" : "text-gray-900"
                              }`}>
                                {formatCurrency(doc.currentBalance)}
                              </td>
                              <td className="px-4 py-3 text-center">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(`/billing/soa/archive/view/${doc.id}`, "_blank")}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12">
                  <div className="text-center text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-lg font-medium">Select a batch to view details</p>
                    <p className="text-sm mt-1">Click on a batch from the list to see its documents</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Distribute Confirmation Dialog */}
      <Dialog open={showDistributeDialog} onOpenChange={setShowDistributeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Distribute SOA Batch
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to distribute this SOA batch?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                <strong>This action will:</strong>
              </p>
              <ul className="mt-2 text-sm text-yellow-700 space-y-1 list-disc list-inside">
                <li>Mark this batch as "Distributed"</li>
                <li>Lock all bills included in these SOAs</li>
                <li>Prevent any modifications to locked bills</li>
              </ul>
              <p className="mt-3 text-sm text-yellow-800 font-medium">
                This action cannot be easily undone. Only administrators can unlock bills.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDistributeDialog(false)}>
              Cancel
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleDistribute}
              disabled={distributing}
            >
              {distributing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Distributing...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Confirm Distribute
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete SOA Batch
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete batch <strong>{batchToDelete?.batchNumber}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">
              This will permanently delete the batch and all its SOA documents. This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Batch
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  )
}
