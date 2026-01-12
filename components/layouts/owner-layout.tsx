"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "@/lib/auth-client"
import {
  LayoutDashboard,
  FileBarChart,
  FileStack,
  CreditCard,
  Menu,
  X,
  LogOut,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface MenuItem {
  name: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  path: string
}

const menuItems: MenuItem[] = [
  {
    name: "dashboard",
    label: "My Dashboard",
    icon: LayoutDashboard,
    path: "/owner",
  },
  {
    name: "soa",
    label: "Statement of Account",
    icon: FileBarChart,
    path: "/owner/soa",
  },
  {
    name: "bills",
    label: "My Bills",
    icon: FileStack,
    path: "/owner/bills",
  },
  {
    name: "payments",
    label: "Payment History",
    icon: CreditCard,
    path: "/owner/payments",
  },
]

export function OwnerLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const { data: session } = useSession()

  const isActive = (path: string) => {
    if (path === "/owner") {
      return pathname === "/owner"
    }
    return pathname.startsWith(path)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 transition-transform lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Logo */}
          <div className="flex items-center gap-3 border-b border-gray-200 p-6">
            <div className="text-3xl">🏢</div>
            <div>
              <h2 className="text-sm font-semibold text-gray-900">
                Mega Tower
              </h2>
              <p className="text-xs text-gray-500">Owner Portal</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            <div className="space-y-1">
              {menuItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.name}
                    href={item.path}
                    onClick={() => setSidebarOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive(item.path)
                        ? "bg-blue-50 text-blue-600"
                        : "text-gray-700 hover:bg-gray-100"
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>

          {/* User section */}
          <div className="border-t border-gray-200 p-4">
            <div className="mb-2 rounded-lg bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">
                {session?.user?.name || `${(session?.user as any)?.firstName || ''} ${(session?.user as any)?.lastName || ''}`}
              </p>
              <p className="text-xs text-gray-500">Unit Owner</p>
            </div>
            <button
              onClick={async () => {
                await signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      router.push("/login")
                    },
                  },
                })
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden"
          >
            {sidebarOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>

          <div className="flex items-center gap-4 ml-auto">
            <time className="text-sm text-gray-500">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
          </div>
        </header>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  )
}
