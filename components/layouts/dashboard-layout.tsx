"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { signOut, useSession } from "@/lib/auth-client"
import {
  LayoutDashboard,
  Database,
  Building2,
  Users,
  Gauge,
  Zap,
  Droplet,
  FileText,
  FilePlus,
  FileStack,
  FileBarChart,
  CreditCard,
  Plus,
  List,
  BarChart3,
  Building,
  TrendingUp,
  Clock,
  UserCog,
  Settings,
  DollarSign,
  Calendar,
  Shield,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Upload,
  SlidersHorizontal,
  Home,
  AlertTriangle,
  Receipt,
  Trophy,
  GitCompare,
  FileCheck,
  PieChart,
  Loader2,
  LucideIcon,
  User,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Icon mapping from database icon names to Lucide components
const iconMap: Record<string, LucideIcon> = {
  LayoutDashboard,
  Database,
  Building2,
  Users,
  Gauge,
  Zap,
  Droplet,
  FileText,
  FilePlus,
  FileStack,
  FileBarChart,
  CreditCard,
  Plus,
  List,
  BarChart3,
  Building,
  TrendingUp,
  Clock,
  UserCog,
  Settings,
  DollarSign,
  Calendar,
  Shield,
  Upload,
  SlidersHorizontal,
  Home,
  AlertTriangle,
  Receipt,
  Trophy,
  GitCompare,
  FileCheck,
  PieChart,
}

interface ApiMenu {
  id: string
  name: string
  label: string
  icon: string | null
  path: string | null
  parentId: string | null
  order: number
  isActive: boolean
  canView: boolean
  canCreate: boolean
  canEdit: boolean
  canDelete: boolean
  canExport: boolean
  children?: ApiMenu[]
}

interface MenuItem {
  name: string
  label: string
  icon: LucideIcon
  path?: string
  children?: MenuItem[]
}

// Transform API menu to local menu item
function transformMenu(apiMenu: ApiMenu): MenuItem {
  const Icon = apiMenu.icon ? iconMap[apiMenu.icon] || LayoutDashboard : LayoutDashboard

  return {
    name: apiMenu.name,
    label: apiMenu.label,
    icon: Icon,
    path: apiMenu.path || undefined,
    children: apiMenu.children?.map(transformMenu),
  }
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuItems, setMenuItems] = useState<MenuItem[]>([])
  const [isLoadingMenus, setIsLoadingMenus] = useState(true)
  const pathname = usePathname()
  const router = useRouter()
  const { data: session, isPending } = useSession()

  // Fetch menus from API based on user role
  useEffect(() => {
    async function fetchMenus() {
      try {
        const response = await fetch("/api/menus/user")
        if (response.ok) {
          const data: ApiMenu[] = await response.json()
          const transformed = data.map(transformMenu)
          setMenuItems(transformed)
        }
      } catch (error) {
        console.error("Failed to fetch menus:", error)
      } finally {
        setIsLoadingMenus(false)
      }
    }

    if (session?.user) {
      fetchMenus()
    }
  }, [session])

  // Auto-expand menus based on current path
  const getOpenMenus = () => {
    const open: string[] = []
    for (const item of menuItems) {
      if (item.children) {
        const hasActiveChild = item.children.some(child =>
          child.path && pathname.startsWith(child.path.split('/').slice(0, -1).join('/') || child.path)
        )
        if (hasActiveChild || item.children.some(child => pathname === child.path)) {
          open.push(item.name)
        }
      }
    }
    return open
  }

  const [openMenus, setOpenMenus] = useState<string[]>([])

  // Update open menus when menuItems or path changes
  useEffect(() => {
    if (menuItems.length > 0) {
      setOpenMenus(getOpenMenus())
    }
  }, [menuItems, pathname])

  const currentOpenMenus = getOpenMenus()

  const toggleMenu = (menuName: string) => {
    setOpenMenus((prev) =>
      prev.includes(menuName)
        ? prev.filter((name) => name !== menuName)
        : [...prev, menuName]
    )
  }

  const isActive = (path?: string) => {
    if (!path) return false
    return pathname === path
  }

  const isParentActive = (item: MenuItem) => {
    if (!item.children) return false
    return item.children.some(child => child.path && pathname === child.path)
  }

  const renderMenuItem = (item: MenuItem) => {
    const Icon = item.icon
    const hasChildren = item.children && item.children.length > 0
    const isMenuOpen = openMenus.includes(item.name) || currentOpenMenus.includes(item.name)
    const parentActive = isParentActive(item)

    if (hasChildren) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleMenu(item.name)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              parentActive
                ? "bg-blue-50 text-blue-700"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform",
                isMenuOpen && "rotate-180"
              )}
            />
          </button>
          {isMenuOpen && (
            <div className="ml-8 mt-1 space-y-1">
              {item.children!.map((child) => renderMenuItem(child))}
            </div>
          )}
        </div>
      )
    }

    return (
      <Link
        key={item.name}
        href={item.path!}
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
              <p className="text-xs text-gray-500">Billing System</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4">
            {isLoadingMenus ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : menuItems.length === 0 ? (
              <div className="text-center py-8 text-sm text-gray-500">
                No menus available
              </div>
            ) : (
              <div className="space-y-1">{menuItems.map(renderMenuItem)}</div>
            )}
          </nav>

          {/* User section */}
          <div className="border-t border-gray-200 p-4">
            <div className="mb-2 rounded-lg bg-gray-50 p-3">
              <p className="text-sm font-medium text-gray-900">
                {session?.user?.name || ((session?.user as any)?.firstName + ' ' + (session?.user as any)?.lastName)}
              </p>
              <p className="text-xs text-gray-500">{(session?.user as any)?.role}</p>
            </div>
            <div className="space-y-1">
              <Link
                href="/profile"
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  pathname === "/profile"
                    ? "bg-blue-50 text-blue-600"
                    : "text-gray-700 hover:bg-gray-100"
                )}
              >
                <User className="h-4 w-4" />
                <span>My Profile</span>
              </Link>
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
