import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useDashboardFilterStore, getMonthOptions, getYearOptions } from '../../store/dashboardFilterStore'
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
  LayoutDashboard,
  Plus,
  Filter,
  TrendingUp,
  Settings,
  ClipboardCheck,
  Calendar
} from 'lucide-react'

// Navigation items for team lead
const navItems = [
  { path: '/teamlead/dashboard', label: 'Dashboard', icon: LayoutDashboard, description: 'Overview' },
  { path: '/teamlead/team', label: 'My Team', icon: Users, description: 'Team members' },
  { path: '/teamlead/orders', label: 'Orders', icon: FileText, description: 'Team orders' },
  { path: '/teamlead/productivity', label: 'Productivity', icon: TrendingUp, description: 'Team productivity' },
  { path: '/teamlead/attendance', label: 'Attendance', icon: Calendar, description: 'Mark attendance' },
  { path: '/teamlead/quality-audit', label: 'Quality Audit', icon: ClipboardCheck, description: 'Quality audits' },
  { path: '/teamlead/team-management', label: 'Manage Teams', icon: Settings, description: 'Manage teams' },
]

// Route configuration for breadcrumbs
const routeConfig: Record<string, { label: string; parent?: string }> = {
  '/teamlead': { label: 'Team Lead' },
  '/teamlead/dashboard': { label: 'Dashboard', parent: '/teamlead' },
  '/teamlead/team': { label: 'My Team', parent: '/teamlead/dashboard' },
  '/teamlead/orders': { label: 'Orders', parent: '/teamlead/dashboard' },
  '/teamlead/productivity': { label: 'Productivity', parent: '/teamlead/dashboard' },
  '/teamlead/attendance': { label: 'Attendance', parent: '/teamlead/dashboard' },
  '/teamlead/quality-audit': { label: 'Quality Audit', parent: '/teamlead/dashboard' },
  '/teamlead/team-management': { label: 'Manage Teams', parent: '/teamlead/dashboard' },
  '/teamlead/employee/:userId/performance': { label: 'Employee Performance', parent: '/teamlead/productivity' },
}

// Function to get breadcrumb trail
const getBreadcrumbs = (pathname: string): { path: string; label: string }[] => {
  const breadcrumbs: { path: string; label: string }[] = []
  
  let currentPath = pathname
  
  // Check for dynamic routes (e.g., /teamlead/employee/:userId/performance)
  let matchedRoute = routeConfig[currentPath]
  if (!matchedRoute) {
    // Try to match dynamic routes
    for (const [route, info] of Object.entries(routeConfig)) {
      if (route.includes(':')) {
        const pattern = route.replace(/:[^/]+/g, '[^/]+')
        const regex = new RegExp(`^${pattern}$`)
        if (regex.test(currentPath)) {
          matchedRoute = info
          currentPath = route // Use the pattern for building breadcrumbs
          break
        }
      }
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

export const TeamLeadNav = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { user: _user } = useAuthStore()
  const {
    filterMonth,
    filterYear,
    setFilterMonth,
    setFilterYear,
  } = useDashboardFilterStore()
  
  const breadcrumbs = getBreadcrumbs(location.pathname)
  const isDashboard = location.pathname === '/teamlead/dashboard' || location.pathname === '/teamlead'
  
  // Determine the back path
  const getBackPath = () => {
    if (breadcrumbs.length > 1) {
      return breadcrumbs[breadcrumbs.length - 2].path
    }
    return '/teamlead/dashboard'
  }
  
  const handleBack = () => {
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
        {isDashboard ? (
          // Dashboard: Show main navigation with quick access
          <nav className="flex items-center justify-between py-3">
            <div className="flex items-center gap-1 overflow-x-auto">
              {navItems.map(({ path, label, icon: Icon }) => (
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
            
            {/* Month-wise Filters */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-slate-500" />
              
              <Select 
                value={filterMonth} 
                onValueChange={setFilterMonth}
              >
                <SelectTrigger className="w-[110px] h-8 text-xs">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {getMonthOptions(filterYear).map((month) => (
                    <SelectItem key={month.value} value={month.value}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select 
                value={filterYear} 
                onValueChange={setFilterYear}
              >
                <SelectTrigger className="w-[85px] h-8 text-xs">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {getYearOptions().map((year) => (
                    <SelectItem key={year.value} value={year.value}>
                      {year.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* Primary CTA */}
              <Link to="/employee/new-order" className="ml-2">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 whitespace-nowrap h-8">
                  <Plus className="w-4 h-4 mr-2" />
                  New Order
                </Button>
              </Link>
            </div>
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
                to="/teamlead/dashboard" 
                className="text-slate-500 hover:text-slate-900 transition-colors"
              >
                <Home className="w-4 h-4" />
              </Link>
              
              {/* Breadcrumbs */}
              {breadcrumbs.map((crumb, index) => {
                const isLast = index === breadcrumbs.length - 1
                const isFirst = index === 0 && crumb.path === '/teamlead'
                
                // Skip the /teamlead root in breadcrumbs display
                if (isFirst && crumb.label === 'Team Lead') {
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
              {navItems.map(({ path, label, icon: Icon }) => (
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
