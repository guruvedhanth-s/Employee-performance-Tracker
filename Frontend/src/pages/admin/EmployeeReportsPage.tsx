import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useDashboardFilterStore, getMonthOptions, getYearOptions } from '../../store/dashboardFilterStore'
import { usersApi, organizationsApi, metricsApi } from '../../services/api'
import type { Organization, TeamMetrics, User } from '../../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { AdminNav } from '../../components/layout/AdminNav'
import { 
  Users, 
  UserCheck, 
  UserX, 
  UserPlus, 
  TrendingUp, 
  Settings,
  Activity,
  BarChart3,
  PieChart,
  Filter
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  AreaChart,
  Area
} from 'recharts'

// Trend data interfaces
interface TrendData {
  month: string
  hired: number
  left: number
  active: number
}

interface RoleDistribution {
  name: string
  value: number
  color: string
  [key: string]: string | number  // Index signature for recharts compatibility
}

interface PerformanceData {
  name: string
  orders: number
  avgTime: number
}

export const EmployeeReportsPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [employees, setEmployees] = useState<User[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [teamMetrics, setTeamMetrics] = useState<TeamMetrics[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedPeriod, setSelectedPeriod] = useState<string>('6months')
  const [selectedOrg, setSelectedOrg] = useState<string>('all')

  // Get filter state from store
  const {
    filterMonth,
    filterYear,
    filterPeriod,
    setFilterMonth,
    setFilterYear,
    setCurrentMonth,
    setPreviousMonth,
    setFilterPeriod,
  } = useDashboardFilterStore()

  useEffect(() => {
    if (!user || !['admin', 'superadmin'].includes(user.userRole)) {
      navigate('/login')
    } else {
      fetchData()
    }
  }, [user, navigate, location.key])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch employees, organizations, and team metrics in parallel
      const [usersRes, orgsRes, metricsRes] = await Promise.all([
        usersApi.list(),
        organizationsApi.list({ isActive: true }),
        metricsApi.getTeamMetrics({ periodType: 'weekly' }).catch(() => ({ items: [] }))
      ])
      
      // Filter out superadmin from the list (they're not regular employees)
      const filteredEmployees = (usersRes.items || []).filter((u: User) => 
        u.userRole !== 'superadmin'
      )
      setEmployees(filteredEmployees)
      setOrganizations(orgsRes.items || [])
      setTeamMetrics(metricsRes.items || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate stats
  const activeCount = employees.filter(e => e.isActive).length
  const inactiveCount = employees.length - activeCount
  const activeEmployees = employees.filter(e => e.isActive)
  const adminCount = activeEmployees.filter(e => e.userRole === 'admin').length
  const teamLeadCount = activeEmployees.filter(e => e.userRole === 'team_lead').length
  const employeeCount = activeEmployees.filter(e => e.userRole === 'employee').length

  // Generate trend data based on actual employee creation dates
  const generateTrendData = (): TrendData[] => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const basePeriods = selectedPeriod === '3months' ? 3 : selectedPeriod === '6months' ? 6 : selectedPeriod === '12months' ? 12 : 24
    
    // Get the date range based on selected period
    const now = new Date()
    const currentYear = now.getFullYear()
    const currentMonth = now.getMonth()
    
    const data: TrendData[] = []
    
    // Create maps to count hires and departures per month
    const hiresByMonth: Map<string, number> = new Map()
    const leftByMonth: Map<string, number> = new Map()
    
    // Find the earliest employee creation date
    let earliestDate: Date | null = null
    
    employees.forEach(emp => {
      // Track hires by createdAt
      if (emp.createdAt) {
        const createdDate = new Date(emp.createdAt)
        const hireKey = `${createdDate.getFullYear()}-${createdDate.getMonth()}`
        hiresByMonth.set(hireKey, (hiresByMonth.get(hireKey) || 0) + 1)
        
        if (!earliestDate || createdDate < earliestDate) {
          earliestDate = createdDate
        }
      }
      
      // Track departures by deactivatedAt (if available) or count inactive users without deactivatedAt in current month
      if (emp.deactivatedAt) {
        const deactivatedDate = new Date(emp.deactivatedAt)
        const leftKey = `${deactivatedDate.getFullYear()}-${deactivatedDate.getMonth()}`
        leftByMonth.set(leftKey, (leftByMonth.get(leftKey) || 0) + 1)
        
        // Also consider deactivation date for earliest date calculation
        if (!earliestDate || deactivatedDate < earliestDate) {
          earliestDate = deactivatedDate
        }
      } else if (!emp.isActive) {
        // For inactive users without deactivatedAt, count them in the current month
        // (these are users who were deactivated before we added the deactivatedAt tracking)
        const leftKey = `${currentYear}-${currentMonth}`
        leftByMonth.set(leftKey, (leftByMonth.get(leftKey) || 0) + 1)
      }
    })
    
    // Calculate how many months to show
    let actualPeriods = basePeriods
    if (earliestDate !== null && selectedPeriod === 'all') {
      // For "All Time", go back to the earliest employee creation
      const earliest = earliestDate as Date
      const monthsDiff = (currentYear - earliest.getFullYear()) * 12 + (currentMonth - earliest.getMonth())
      actualPeriods = Math.max(monthsDiff + 1, 1)
    }
    
    // Calculate running active count
    let runningActive = 0
    
    // Go through each month in the period
    for (let i = actualPeriods - 1; i >= 0; i--) {
      let targetMonth = currentMonth - i
      let targetYear = currentYear
      
      // Handle year rollover
      while (targetMonth < 0) {
        targetMonth += 12
        targetYear -= 1
      }
      
      const key = `${targetYear}-${targetMonth}`
      const hired = hiresByMonth.get(key) || 0
      const left = leftByMonth.get(key) || 0
      
      runningActive += hired - left
      
      data.push({
        month: `${months[targetMonth]}${targetYear !== currentYear ? " '" + targetYear.toString().slice(-2) : ''}`,
        hired,
        left,
        active: runningActive
      })
    }
    
    return data
  }

  const trendData = generateTrendData()

  // Role distribution for pie chart
  const roleDistribution: RoleDistribution[] = [
    { name: 'Employees', value: employeeCount, color: '#22c55e' },
    { name: 'Team Leads', value: teamLeadCount, color: '#3b82f6' },
    { name: 'Admins', value: adminCount, color: '#8b5cf6' },
  ]

  // Generate performance data from real team metrics
  const generatePerformanceData = (): PerformanceData[] => {
    if (teamMetrics.length === 0) {
      return []
    }

    // Sort metrics by date and get the last 4 weeks
    const sortedMetrics = [...teamMetrics]
      .filter(m => m.periodType === 'weekly')
      .sort((a, b) => new Date(a.metricDate).getTime() - new Date(b.metricDate).getTime())
      .slice(-4)

    // Aggregate metrics by week (sum across all teams)
    const weeklyData: Map<string, { orders: number; avgTime: number; count: number }> = new Map()

    sortedMetrics.forEach(metric => {
      const weekDate = new Date(metric.metricDate)
      const weekLabel = `${weekDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      
      const existing = weeklyData.get(weekLabel) || { orders: 0, avgTime: 0, count: 0 }
      weeklyData.set(weekLabel, {
        orders: existing.orders + metric.totalOrdersCompleted,
        avgTime: existing.avgTime + (metric.avgOrderCompletionMinutes || 0),
        count: existing.count + 1
      })
    })

    // Convert to array format
    const result: PerformanceData[] = []
    let weekNum = 1
    weeklyData.forEach((data, weekLabel) => {
      result.push({
        name: weekLabel || `Week ${weekNum}`,
        orders: data.orders,
        avgTime: data.count > 0 ? Math.round(data.avgTime / data.count) : 0
      })
      weekNum++
    })

    return result
  }

  const performanceData = generatePerformanceData()

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header with Actions */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Employee Reports</h1>
            <p className="text-slate-600 mt-1">
              Analyze employee headcount and distribution
            </p>
          </div>
          <Button 
            onClick={() => navigate('/admin/employee-management')}
            variant="outline"
          >
            <Settings className="h-4 w-4 mr-2" />
            Manage Employees
          </Button>
        </div>

        {/* Filters Row */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6">
          {/* Left side filters */}
          <div className="flex items-center gap-4">
            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="12months">Last 12 Months</SelectItem>
                <SelectItem value="all">All Time</SelectItem>
              </SelectContent>
            </Select>
            
            {user?.userRole === 'superadmin' && (
              <Select value={selectedOrg} onValueChange={setSelectedOrg}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="All Organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id.toString()}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          
          {/* Right side - Month/Year filters */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-500" />
            <Select 
              value={filterPeriod} 
              onValueChange={(value) => {
                if (value === 'current') {
                  setCurrentMonth()
                } else if (value === 'previous') {
                  setPreviousMonth()
                } else {
                  setFilterPeriod('custom')
                }
              }}
            >
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Select Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="current">Current Month</SelectItem>
                <SelectItem value="previous">Previous Month</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
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
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Across all roles
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeCount}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {((activeCount / Math.max(employees.length, 1)) * 100).toFixed(0)}% of workforce
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Headcount Trend */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Headcount Trend
              </CardTitle>
              <CardDescription>
                Monthly active employee count
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Area 
                      type="monotone" 
                      dataKey="active" 
                      stroke="#3b82f6" 
                      fill="#93c5fd" 
                      name="Active Employees"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Hiring vs Attrition */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Hiring vs Attrition
              </CardTitle>
              <CardDescription>
                Monthly employee movement
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[300px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="hired" fill="#22c55e" name="Hired" />
                    <Bar dataKey="left" fill="#ef4444" name="Left" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Second Charts Row */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          {/* Role Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Role Distribution
              </CardTitle>
              <CardDescription>
                Breakdown by role type
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-[250px]">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={200}>
                    <RechartsPieChart>
                      <Pie
                        data={roleDistribution}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {roleDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-4 mt-2">
                    {roleDistribution.map((item) => (
                      <div key={item.name} className="flex items-center gap-2 text-sm">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-muted-foreground">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Status Distribution */}
          <Card>
            <CardHeader>
              <CardTitle>Employment Status</CardTitle>
              <CardDescription>
                Active vs Inactive employees
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-green-600" />
                      Active
                    </span>
                    <span className="text-sm text-muted-foreground">{activeCount}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${(activeCount / Math.max(employees.length, 1)) * 100}%` }}
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <UserX className="h-4 w-4 text-slate-400" />
                      Inactive
                    </span>
                    <span className="text-sm text-muted-foreground">{inactiveCount}</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-slate-400 rounded-full transition-all"
                      style={{ width: `${(inactiveCount / Math.max(employees.length, 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-4 border-t">
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {((activeCount / Math.max(employees.length, 1)) * 100).toFixed(0)}%
                    </div>
                    <div className="text-xs text-muted-foreground">Active Rate</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-slate-600">
                      {employees.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Total Count</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics - Empty for now to complete the 3-column layout */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Quick Stats
              </CardTitle>
              <CardDescription>
                Key employee metrics
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Admins</span>
                  <Badge variant="secondary">{adminCount}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Team Leads</span>
                  <Badge variant="secondary">{teamLeadCount}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Employees</span>
                  <Badge variant="secondary">{employeeCount}</Badge>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium">Total Active</span>
                  <Badge className="bg-green-600">{activeCount}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default EmployeeReportsPage

