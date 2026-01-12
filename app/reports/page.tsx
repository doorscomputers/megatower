"use client"

import { useState, useEffect } from "react"
import { DashboardLayout } from "@/components/layouts/dashboard-layout"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Users,
  FileText,
  ArrowRight,
  BarChart3,
  PieChart,
  Clock,
  Building,
  UserCheck,
  Receipt,
  RefreshCw,
  Zap,
  Droplets,
  Trophy,
  Calendar,
  FileCheck,
  GitCompare,
  Home,
  History,
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

interface DashboardMetrics {
  totalOutstanding: number
  unitsWithBalance: number
  thisMonthCollections: number
  collectionEfficiency: number
  totalUnits: number
  overdueBillsCount: number
  outstandingByComponent: {
    electric: number
    water: number
    dues: number
    penalty: number
    spAssessment: number
    other: number
  }
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 2,
  }).format(amount)
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true)
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [asOf, setAsOf] = useState<string>("")

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/reports/dashboard")
      if (!res.ok) throw new Error("Failed to fetch metrics")
      const data = await res.json()
      setMetrics(data.metrics)
      setAsOf(data.asOf)
    } catch (error: any) {
      toast.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchMetrics()
  }, [])

  // Financial Reports
  const financialReports = [
    {
      title: "Outstanding Balances",
      description: "View all units with unpaid balances, grouped by floor with totals",
      icon: <DollarSign className="h-6 w-6" />,
      href: "/reports/outstanding",
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "AR Aging Report",
      description: "Analyze receivables by age (30/60/90/90+ days)",
      icon: <Clock className="h-6 w-6" />,
      href: "/reports/aging",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      title: "Collection Summary",
      description: "Payments summary by date range, component, and method",
      icon: <BarChart3 className="h-6 w-6" />,
      href: "/reports/collection-summary",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Revenue Report",
      description: "Monthly revenue breakdown by component with trends",
      icon: <TrendingUp className="h-6 w-6" />,
      href: "/reports/revenue",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Annual Summary",
      description: "Comprehensive yearly financial overview with charts",
      icon: <Calendar className="h-6 w-6" />,
      href: "/reports/annual-summary",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Penalty Report",
      description: "Track penalties charged and collected by month",
      icon: <Receipt className="h-6 w-6" />,
      href: "/reports/penalties",
      color: "text-pink-600",
      bgColor: "bg-pink-50",
    },
  ]

  // Operational Reports
  const operationalReports = [
    {
      title: "Unit Status",
      description: "Complete unit status with occupancy, payments, and balance",
      icon: <Home className="h-6 w-6" />,
      href: "/reports/unit-status",
      color: "text-cyan-600",
      bgColor: "bg-cyan-50",
    },
    {
      title: "Floor Summary",
      description: "Aggregated metrics by floor - billed, collected, outstanding",
      icon: <Building className="h-6 w-6" />,
      href: "/reports/floor-summary",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Bill Status",
      description: "Detailed breakdown of all bills by status",
      icon: <FileCheck className="h-6 w-6" />,
      href: "/reports/bill-status",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Delinquency Report",
      description: "Identify units with chronic late payments",
      icon: <AlertTriangle className="h-6 w-6" />,
      href: "/reports/delinquency",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Owner Summary",
      description: "Outstanding balances grouped by owner",
      icon: <UserCheck className="h-6 w-6" />,
      href: "/reports/owner-summary",
      color: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      title: "Payment History",
      description: "Detailed payment records with filtering options",
      icon: <History className="h-6 w-6" />,
      href: "/reports/payment-history",
      color: "text-teal-600",
      bgColor: "bg-teal-50",
    },
  ]

  // Analysis Reports
  const analysisReports = [
    {
      title: "Efficiency Trend",
      description: "Monthly collection efficiency over time",
      icon: <TrendingUp className="h-6 w-6" />,
      href: "/reports/efficiency-trend",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Top Payers",
      description: "Best paying units ranked by payment performance",
      icon: <Trophy className="h-6 w-6" />,
      href: "/reports/top-payers",
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
    },
    {
      title: "Comparative Analysis",
      description: "Month-over-Month and Year-over-Year comparisons",
      icon: <GitCompare className="h-6 w-6" />,
      href: "/reports/comparative",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Consumption Report",
      description: "Electric and water usage analysis with trends",
      icon: <Zap className="h-6 w-6" />,
      href: "/reports/consumption",
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
    {
      title: "Daily Collections",
      description: "Daily payment records with OR# tracking",
      icon: <FileText className="h-6 w-6" />,
      href: "/reports/collections",
      color: "text-teal-600",
      bgColor: "bg-teal-50",
    },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports Dashboard</h1>
            <p className="text-gray-500">
              Access management reports and financial summaries
            </p>
          </div>
          <Button
            variant="outline"
            onClick={fetchMetrics}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Outstanding
              </CardTitle>
              <DollarSign className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {loading ? "..." : formatCurrency(metrics?.totalOutstanding || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                {metrics?.unitsWithBalance || 0} units with balance
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                This Month&apos;s Collections
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {loading ? "..." : formatCurrency(metrics?.thisMonthCollections || 0)}
              </div>
              <p className="text-xs text-muted-foreground">
                Payments received this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Collection Efficiency
              </CardTitle>
              <PieChart className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {loading ? "..." : `${metrics?.collectionEfficiency || 0}%`}
              </div>
              <p className="text-xs text-muted-foreground">
                Collections vs. billed this month
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Overdue Bills
              </CardTitle>
              <AlertTriangle className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {loading ? "..." : metrics?.overdueBillsCount || 0}
              </div>
              <p className="text-xs text-muted-foreground">
                Bills past due date
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Outstanding by Component */}
        {metrics && !loading && (
          <Card>
            <CardHeader>
              <CardTitle>Outstanding Balance Breakdown</CardTitle>
              <CardDescription>
                Total outstanding amounts by billing component
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Electric</p>
                  <p className="font-semibold text-yellow-700">
                    {formatCurrency(metrics.outstandingByComponent.electric)}
                  </p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Water</p>
                  <p className="font-semibold text-blue-700">
                    {formatCurrency(metrics.outstandingByComponent.water)}
                  </p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Assoc. Dues</p>
                  <p className="font-semibold text-green-700">
                    {formatCurrency(metrics.outstandingByComponent.dues)}
                  </p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Penalty</p>
                  <p className="font-semibold text-red-700">
                    {formatCurrency(metrics.outstandingByComponent.penalty)}
                  </p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">SP Assessment</p>
                  <p className="font-semibold text-purple-700">
                    {formatCurrency(metrics.outstandingByComponent.spAssessment)}
                  </p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 mb-1">Other</p>
                  <p className="font-semibold text-gray-700">
                    {formatCurrency(metrics.outstandingByComponent.other)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Financial Reports */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Financial Reports
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {financialReports.map((report) => (
              <Link key={report.href} href={report.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${report.bgColor} ${report.color}`}>
                        {report.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {report.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {report.description}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Operational Reports */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Building className="h-5 w-5 text-blue-600" />
            Operational Reports
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {operationalReports.map((report) => (
              <Link key={report.href} href={report.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${report.bgColor} ${report.color}`}>
                        {report.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {report.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {report.description}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Analysis Reports */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            Analysis & Insights
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analysisReports.map((report) => (
              <Link key={report.href} href={report.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${report.bgColor} ${report.color}`}>
                        {report.icon}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {report.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {report.description}
                        </p>
                      </div>
                      <ArrowRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Last Updated */}
        {asOf && (
          <p className="text-xs text-gray-400 text-center">
            Last updated: {new Date(asOf).toLocaleString()}
          </p>
        )}
      </div>
    </DashboardLayout>
  )
}
