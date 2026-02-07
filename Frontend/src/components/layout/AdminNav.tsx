import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useDashboardFilterStore, getMonthOptions, getYearOptions } from '../../store/dashboardFilterStore'
import { organizationsApi } from '../../services/api'
import { Button } from '../ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { 
  ChevronRight, 
  ArrowLeft,
  Home,
  Users,
  FileText,
  BarChart3,
  Plus,
  Building2,
  Filter,
  TrendingUp,
  ClipboardCheck,
  Receipt,
  Target
} from 'lucide-react'

// Navigation items for quick access
const navItems = [
  { path: '/admin/teams', label: 'Teams', icon: Users, description: 'View all teams' },
  { path: '/admin/employees', label: 'Employees', icon: FileText, description: 'Employee reports' },
  { path: '/admin/employee-targets', label: 'Targets', icon: Target, description: 'Weekly targets' },
  { path: '/admin/orders', label: 'Orders', icon: BarChart3, description: 'Order analysis' },
  { path: '/admin/productivity', label: 'Productivity', icon: TrendingUp, description: 'Productivity reports' },
  { path: '/admin/quality-audit', label: 'Quality Audit', icon: ClipboardCheck, description: 'Quality audit reports' },
  { path: '/admin/billing', label: 'Billing', icon: Receipt, description: 'Billing reports' },
]

// Superadmin only nav items
const superadminNavItems = [
  { path: '/admin/organizations', label: 'Organizations', icon: Building2, description: 'Manage organizations' },
]

// Route configuration for breadcrumbs
const routeConfig: Record<string, { label: string; parent?: string }> = {
  '/admin': { label: 'Admin' },
  '/admin/dashboard': { label: 'Dashboard', parent: '/admin' },
  '/admin/teams': { label: 'Teams', parent: '/admin/dashboard' },
  '/admin/employees': { label: 'Employee Reports', parent: '/admin/dashboard' },
  '/admin/employee-management': { label: 'Employee Management', parent: '/admin/employees' },
  '/admin/employee-targets': { label: 'Employee Targets', parent: '/admin/dashboard' },
  '/admin/orders': { label: 'Order Analysis', parent: '/admin/dashboard' },
  '/admin/onboarding': { label: 'Onboarding', parent: '/admin/dashboard' },
  '/admin/team-management': { label: 'Team Management', parent: '/admin/teams' },
  '/admin/score-management': { label: 'Score Management', parent: '/admin/team-management' },
  '/admin/quality-audit': { label: 'Quality Audit', parent: '/admin/dashboard' },
  '/admin/billing': { label: 'Billing Reports', parent: '/admin/dashboard' },
  '/admin/team-report': { label: 'Team Report', parent: '/admin/teams' },
  '/admin/organizations': { label: 'Organizations', parent: '/admin/dashboard' },
  '/admin/productivity': { label: 'Productivity', parent: '/admin/dashboard' },
}

// Function to get breadcrumb trail
const getBreadcrumbs = (pathname: string): { path: string; label: string }[] => {
  const breadcrumbs: { path: string; label: string }[] = []
  
  // Handle dynamic routes like /admin/team-report/:id
  let currentPath = pathname
  
  // Check for dynamic team report route
  if (pathname.startsWith('/admin/team-report/')) {
    currentPath = '/admin/team-report'
  }
  
  // Check for dynamic employee performance route
  if (pathname.match(/^\/admin\/employees\/\d+\/performance$/)) {
    currentPath = '/admin/employees/:userId/performance'
    // Add to routeConfig dynamically if not present
    if (!routeConfig[currentPath]) {
      routeConfig[currentPath] = { label: 'Performance Report', parent: '/admin/employee-management' }
    }
  }
  
  // Check for dynamic employee detail route
  if (pathname.match(/^\/admin\/employees\/\d+$/) && !pathname.includes('/performance')) {
    currentPath = '/admin/employees/:userId'
    // Add to routeConfig dynamically if not present
    if (!routeConfig[currentPath]) {
      routeConfig[currentPath] = { label: 'Employee Details', parent: '/admin/employee-management' }
    }
  }
  
  // Build breadcrumb trail
  let path: string | undefined = currentPath
  while (path) {
    const routeInfo: { label: string; parent?: string } | undefined = routeConfig[path]
    if (routeInfo) {
      breadcrumbs.unshift({ path, label: routeInfo.label })
      path = routeInfo.parent
    } else {
      break
    }
  }
  
  return breadcrumbs
}

export const AdminNav = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const {
    filterMonth,
    filterYear,
    filterOrgId,
    setFilterMonth,
    setFilterYear,
    setFilterOrgId,
  } = useDashboardFilterStore()
  
  const breadcrumbs = getBreadcrumbs(location.pathname)
  const isDashboard = location.pathname === '/admin/dashboard' || location.pathname === '/admin'
  
  // Superadmin should not see Add Order button
  const showAddOrderButton = user?.userRole !== 'superadmin'
  const isSuperadmin = user?.userRole === 'superadmin'
  
  // Fetch organizations for superadmin filter
  const { data: orgsData } = useQuery({
    queryKey: ['organizations', 'list', 'active'],
    queryFn: () => organizationsApi.list({ isActive: true }),
    enabled: isSuperadmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
  
  // Combine nav items based on role
  const allNavItems = isSuperadmin ? [...navItems, ...superadminNavItems] : navItems
  
  // Determine the back path
  const getBackPath = () => {
    if (breadcrumbs.length > 1) {
      return breadcrumbs[breadcrumbs.length - 2].path
    }
    return '/admin/dashboard'
  }
  
  const handleBack = () => {
    // Try browser history first, fallback to parent route
    if (window.history.length > 2) {
      navigate(-1)
    } else {
      navigate(getBackPath())
    }
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="bg-white border-b border-slate-200">
      <div className="container mx-auto px-4">
        {/* Show navigation menu on dashboard, breadcrumbs on other pages */}
        {isDashboard ? (
          // Dashboard: Show main navigation with quick access
          <nav className="flex items-center justify-between py-3">
            <div className="flex items-center gap-1 overflow-x-auto">
              {allNavItems.map(({ path, label, icon: Icon }) => (
                <Link key={path} to={path}>
                  <Button 
                    variant={isActive(path) ? "default" : "ghost"}
                    size="sm"
                    className="whitespace-nowrap"
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {label}
                  </Button>
                </Link>
              ))}
            </div>
            
            {/* Primary CTA - Only show for non-superadmin */}
            {showAddOrderButton && (
              <Link to="/employee/new-order">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 whitespace-nowrap h-8">
                  <Plus className="w-4 h-4 mr-2" />
                  New Order
                </Button>
              </Link>
            )}
          </nav>
        ) : (
          // Other pages: Show breadcrumbs with back button
          <nav className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              {/* Back Button */}
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={handleBack}
                className="mr-2 hover:bg-slate-100"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              
              {/* Separator */}
              <div className="h-5 w-px bg-slate-300 mr-2" />
              
              {/* Home Icon */}
              <Link 
                to="/admin/dashboard" 
                className="text-slate-500 hover:text-slate-900 transition-colors"
              >
                <Home className="w-4 h-4" />
              </Link>
              
              {/* Breadcrumbs */}
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1
                const isFirst = index === 0 && crumb.path === '/admin'
                
                // Skip the /admin root in breadcrumbs display
                if (isFirst && crumb.label === 'Admin') {
                  return null
                }
                
                return (
                  <div key={crumb.path} className="flex items-center">
                    <ChevronRight className="w-4 h-4 text-slate-400 mx-1" />
                    {isLast ? (
                      <span className="text-sm font-medium text-slate-900">
                        {crumb.label}
                      </span>
                    ) : (
                      <Link 
                        to={crumb.path}
                        className="text-sm text-slate-500 hover:text-slate-900 transition-colors hover:underline"
                      >
                        {crumb.label}
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
            
            {/* Quick navigation links on inner pages */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.slice(0, 3).map(({ path, label, icon: Icon }) => (
                <Link key={path} to={path}>
                  <Button 
                    variant={isActive(path) ? "secondary" : "ghost"}
                    size="sm"
                    className="whitespace-nowrap text-xs"
                  >
                    <Icon className="w-3 h-3 mr-1" />
                    {label}
                  </Button>
                </Link>
              ))}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}
