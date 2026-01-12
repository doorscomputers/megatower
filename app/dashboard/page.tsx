'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from '@/lib/auth-client'
import { DashboardLayout } from '@/components/layouts/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Building2,
  Users,
  FileText,
  TrendingUp,
  AlertCircle,
  DollarSign,
  CheckCircle,
  Clock
} from 'lucide-react'

export default function DashboardPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()

  // Redirect UNIT_OWNER to owner portal
  useEffect(() => {
    if (!isPending && (session?.user as any)?.role === 'UNIT_OWNER') {
      router.replace('/owner')
    }
  }, [session, isPending, router])

  // Show loading while checking session
  if (isPending) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading...</div>
        </div>
      </DashboardLayout>
    )
  }

  // Don't render admin dashboard for unit owners (will redirect)
  if ((session?.user as any)?.role === 'UNIT_OWNER') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Redirecting to owner portal...</div>
        </div>
      </DashboardLayout>
    )
  }
  // Mock data - will be replaced with real API calls
  const stats = {
    totalUnits: 110,
    activeOwners: 98,
    unpaidBills: 15,
    monthlyRevenue: 245680.50,
    collectionRate: 86.4,
    overdueAccounts: 8,
  }

  const recentBills = [
    { unit: '2F-1', owner: 'Juan Dela Cruz', amount: 3234.85, status: 'Paid', date: 'Nov 5, 2025' },
    { unit: '3F-5', owner: 'Maria Santos', amount: 2890.00, status: 'Unpaid', date: 'Nov 5, 2025' },
    { unit: 'GF-12', owner: 'ABC Store Inc.', amount: 5240.00, status: 'Overdue', date: 'Oct 5, 2025' },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">Welcome back! Here's an overview of Mega Tower Residences.</p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Units</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUnits}</div>
              <p className="text-xs text-gray-500">Across 6 floors</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Owners</CardTitle>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.activeOwners}</div>
              <p className="text-xs text-gray-500">Registered unit owners</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">₱{stats.monthlyRevenue.toLocaleString()}</div>
              <p className="text-xs text-gray-500">November 2025</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Collection Rate</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.collectionRate}%</div>
              <p className="text-xs text-gray-500">This month</p>
            </CardContent>
          </Card>
        </div>

        {/* Second Row Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Unpaid Bills</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.unpaidBills}</div>
              <p className="text-xs text-gray-500">Requires attention</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overdue Accounts</CardTitle>
              <Clock className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.overdueAccounts}</div>
              <p className="text-xs text-gray-500">Past due date</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Paid This Month</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUnits - stats.unpaidBills}</div>
              <p className="text-xs text-gray-500">Units paid in full</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Bills */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Bills</CardTitle>
              <CardDescription>Latest billing statements generated</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentBills.map((bill, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{bill.unit} - {bill.owner}</p>
                      <p className="text-xs text-gray-500">{bill.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">₱{bill.amount.toLocaleString()}</p>
                      <span className={`inline-block px-2 py-1 text-xs rounded ${
                        bill.status === 'Paid' ? 'bg-green-100 text-green-800' :
                        bill.status === 'Unpaid' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {bill.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and shortcuts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <a
                  href="/billing/generate"
                  className="flex flex-col items-center justify-center p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                >
                  <FileText className="h-8 w-8 text-blue-600 mb-2" />
                  <span className="text-sm font-medium text-center">Generate Bills</span>
                </a>
                <a
                  href="/payments/record"
                  className="flex flex-col items-center justify-center p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                >
                  <DollarSign className="h-8 w-8 text-green-600 mb-2" />
                  <span className="text-sm font-medium text-center">Record Payment</span>
                </a>
                <a
                  href="/readings/electric"
                  className="flex flex-col items-center justify-center p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                >
                  <Building2 className="h-8 w-8 text-purple-600 mb-2" />
                  <span className="text-sm font-medium text-center">Enter Readings</span>
                </a>
                <a
                  href="/reports/floors"
                  className="flex flex-col items-center justify-center p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors"
                >
                  <TrendingUp className="h-8 w-8 text-orange-600 mb-2" />
                  <span className="text-sm font-medium text-center">View Reports</span>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Floor Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Floor Overview</CardTitle>
            <CardDescription>Collection summary by floor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {['GF', '2F', '3F', '4F', '5F', '6F'].map((floor, index) => {
                const collected = Math.floor(Math.random() * 20000) + 30000
                const total = Math.floor(Math.random() * 5000) + collected
                const percentage = ((collected / total) * 100).toFixed(1)
                
                return (
                  <div key={floor} className="flex items-center">
                    <div className="w-16 font-medium text-sm">{floor === 'GF' ? 'Ground Floor' : `${floor.charAt(0)}${floor.charAt(1)} Floor`}</div>
                    <div className="flex-1 mx-4">
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-24 text-right text-sm">
                      <span className="font-medium">₱{collected.toLocaleString()}</span>
                      <span className="text-gray-500"> / ₱{total.toLocaleString()}</span>
                    </div>
                    <div className="w-16 text-right text-sm font-medium text-gray-600">
                      {percentage}%
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
