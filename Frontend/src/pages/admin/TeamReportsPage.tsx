import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useDashboardFilterStore, getMonthOptions, getYearOptions } from '../../store/dashboardFilterStore'
import api, { teamsApi, organizationsApi, metricsApi, ordersApi, productivityApi } from '../../services/api'
import type { Organization, TeamMetrics, Order, TeamProductivity } from '../../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Progress } from '../../components/ui/progress'
import { AdminNav } from '../../components/layout/AdminNav'
import { 
  Users, 
  TrendingUp, 
  Target, 
  Settings, 
  MapPin, 
  Package, 
  RefreshCw,
  CheckCircle2,
  BarChart3,
  Award,
  Activity,
  Filter
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

// Interfaces matching the backend API response
interface TeamState {
  id: number
  teamId: number
  state: string
}

interface TeamProduct {
  id: number
  teamId: number
  productType: string
}

interface TeamMember {
  id: number
  userId: number
  userName: string
  userRole: string
  isActive: boolean
}

interface Team {
  id: number
  name: string
  orgId: number
  teamLeadId: number | null
  isActive: boolean
  states: TeamState[]
  products: TeamProduct[]
  members?: TeamMember[]
}

export const TeamReportsPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [teams, setTeams] = useState<Team[]>([])
  const [teamMetrics, setTeamMetrics] = useState<TeamMetrics[]>([])
  const [teamProductivity, setTeamProductivity] = useState<TeamProductivity[]>([])
  const [calculatedTeamStats, setCalculatedTeamStats] = useState<{
    teamId: number
    teamName: string
    totalOrders: number
    completedOrders: number
    completionRate: number
  }[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  
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
  
  // For superadmin: selected org for filtering (default to 'all' / null)
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(
    user?.userRole === 'superadmin' ? null : (user?.orgId || null)
  )

  useEffect(() => {
    if (!user || !['admin', 'superadmin'].includes(user.userRole)) {
      navigate('/login')
    } else {
      fetchData()
      // Fetch organizations for superadmin
      if (user?.userRole === 'superadmin') {
        fetchOrganizations()
      }
    }
  }, [user, navigate])

  // Re-fetch when selectedOrgId or month/year filters change
  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [selectedOrgId, filterMonth, filterYear])

  const fetchOrganizations = async () => {
    try {
      const response = await organizationsApi.list({ isActive: true })
      setOrganizations(response.items || [])
    } catch (error) {
      console.error('Failed to fetch organizations:', error)
    }
  }

  const fetchData = async () => {
    try {
      setLoading(true)
      const orgIdToFetch = user?.userRole === 'superadmin' 
        ? (selectedOrgId ?? undefined) 
        : (user?.orgId ?? undefined)
      
      // Fetch teams
      const teamsResponse = await teamsApi.list({ orgId: orgIdToFetch, isActive: true })
      const teamsData = teamsResponse.items || []
      
      // Fetch member count for all teams
      const teamsWithMembers = await Promise.all(
        teamsData.map(async (team: Team) => {
          try {
            const membersResponse = await api.get(`/teams/${team.id}/members`)
            return { ...team, members: membersResponse.data }
          } catch (error) {
            console.error(`Failed to fetch members for team ${team.id}:`, error)
            return { ...team, members: [] }
          }
        })
      )
      setTeams(teamsWithMembers)

      // Calculate start and end dates from filterMonth and filterYear
      const startDate = `${filterYear}-${filterMonth.padStart(2, '0')}-01`
      const lastDay = new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate()
      const endDate = `${filterYear}-${filterMonth.padStart(2, '0')}-${lastDay}`

      // Fetch team productivity for all teams
      const productivityData: TeamProductivity[] = []
      for (const team of teamsWithMembers) {
        try {
          const productivity = await productivityApi.getTeamProductivity({
            teamId: team.id,
            startDate,
            endDate,
          })
          productivityData.push(productivity)
        } catch (error) {
          console.error(`Failed to fetch productivity for team ${team.id}:`, error)
        }
      }
      setTeamProductivity(productivityData)

      // Fetch team metrics with month/year filter
      let metricsData: TeamMetrics[] = []
      try {
        const metricsResponse = await metricsApi.getTeamMetrics({ 
          orgId: orgIdToFetch,
          periodType: 'monthly',
          startDate,
          endDate,
        })
        metricsData = metricsResponse.items || []
        setTeamMetrics(metricsData)
      } catch (error) {
        console.error('Failed to fetch team metrics:', error)
        setTeamMetrics([])
      }

      // If no pre-calculated metrics, calculate from orders data
      if (metricsData.length === 0 && teamsWithMembers.length > 0) {
        try {
          // Fetch all orders for the period
          const ordersResponse = await ordersApi.list({
            orgId: orgIdToFetch,
            startDate,
            endDate,
            pageSize: 100, // Maximum allowed by backend
          })
          const orders = ordersResponse.items || []

          // Calculate stats per team
          const teamStatsMap = new Map<number, { total: number; completed: number }>()
          
          // Initialize all teams
          teamsWithMembers.forEach(team => {
            teamStatsMap.set(team.id, { total: 0, completed: 0 })
          })

          // Count orders per team
          orders.forEach((order: Order) => {
            if (order.teamId) {
              const stats = teamStatsMap.get(order.teamId)
              if (stats) {
                stats.total++
                // Check if order is completed (status name contains 'Completed' or 'BP and RTI')
                if (order.orderStatusName?.toLowerCase().includes('completed') || 
                    order.orderStatusName?.toLowerCase().includes('bp and rti')) {
                  stats.completed++
                }
              }
            }
          })

          // Convert to array and calculate completion rate
          const calculatedStats = teamsWithMembers
            .map(team => {
              const stats = teamStatsMap.get(team.id) || { total: 0, completed: 0 }
              return {
                teamId: team.id,
                teamName: team.name,
                totalOrders: stats.total,
                completedOrders: stats.completed,
                completionRate: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
              }
            })
            .filter(s => s.totalOrders > 0) // Only teams with orders
            .sort((a, b) => b.completedOrders - a.completedOrders) // Sort by completed orders
            .slice(0, 5) // Top 5

          setCalculatedTeamStats(calculatedStats)
        } catch (error) {
          console.error('Failed to calculate team stats from orders:', error)
          setCalculatedTeamStats([])
        }
      } else {
        setCalculatedTeamStats([])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Calculate summary statistics
  const activeTeams = teams.filter(t => t.isActive).length
  const inactiveTeams = teams.filter(t => !t.isActive).length
  const totalMembers = teams.reduce((acc, t) => acc + (t.members?.length || 0), 0)
  const totalStates = new Set(teams.flatMap(t => t.states.map(s => s.state))).size
  const totalProducts = new Set(teams.flatMap(t => t.products.map(p => p.productType))).size
  const avgMembersPerTeam = teams.length > 0 ? (totalMembers / teams.length).toFixed(1) : '0'

  // Calculate metrics summaries
  const totalOrdersCompleted = teamMetrics.reduce((acc, m) => acc + m.totalOrdersCompleted, 0)
  const totalOrdersAssigned = teamMetrics.reduce((acc, m) => acc + m.totalOrdersAssigned, 0)
  const avgCompletionRate = teamMetrics.length > 0 
    ? (teamMetrics.reduce((acc, m) => acc + (m.completionRate || 0), 0) / teamMetrics.length).toFixed(1)
    : '0'
  const avgEfficiencyScore = teamMetrics.length > 0
    ? (teamMetrics.reduce((acc, m) => acc + (m.teamEfficiencyScore || 0), 0) / teamMetrics.length).toFixed(1)
    : '0'

  // Prepare chart data - State coverage
  const stateCoverage: Record<string, number> = {}
  teams.forEach(team => {
    team.states.forEach(s => {
      stateCoverage[s.state] = (stateCoverage[s.state] || 0) + 1
    })
  })
  const stateChartData = Object.entries(stateCoverage)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([state, count]) => ({ name: state, teams: count }))

  // Prepare chart data - Product coverage
  const productCoverage: Record<string, number> = {}
  teams.forEach(team => {
    team.products.forEach(p => {
      productCoverage[p.productType] = (productCoverage[p.productType] || 0) + 1
    })
  })
  const productChartData = Object.entries(productCoverage)
    .map(([product, count]) => ({ name: product, value: count }))

  // Top performing teams by productivity percentage
  const topTeams = [...teamProductivity]
    .filter(tp => tp.teamProductivityPercent !== null && tp.activeMembers > 0)
    .sort((a, b) => b.teamProductivityPercent - a.teamProductivityPercent)
    .slice(0, 5)
  
  // Use calculated stats if no productivity data available
  const hasTopTeamsData = topTeams.length > 0 || calculatedTeamStats.length > 0

  // Team size distribution
  const teamSizeData = [
    { range: '1-3', count: teams.filter(t => (t.members?.length || 0) >= 1 && (t.members?.length || 0) <= 3).length },
    { range: '4-6', count: teams.filter(t => (t.members?.length || 0) >= 4 && (t.members?.length || 0) <= 6).length },
    { range: '7-10', count: teams.filter(t => (t.members?.length || 0) >= 7 && (t.members?.length || 0) <= 10).length },
    { range: '10+', count: teams.filter(t => (t.members?.length || 0) > 10).length },
  ].filter(d => d.count > 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Team Analytics</h1>
              <p className="text-sm text-slate-600">Statistics and insights across all teams</p>
            </div>
            <Button onClick={() => navigate('/admin/team-management')}>
              <Settings className="h-4 w-4 mr-2" />
              Manage Teams
            </Button>
          </div>
        </div>
      </header>

      <AdminNav />

      <main className="container mx-auto px-4 py-8">
        {/* Filters Card */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              {/* Left side - Organization filter (superadmin only) */}
              <div className="flex items-center gap-4">
                {user?.userRole === 'superadmin' && (
                  <>
                    <Label className="whitespace-nowrap">Filter by Organization:</Label>
                    <Select
                      value={selectedOrgId ? selectedOrgId.toString() : 'all'}
                      onValueChange={(value) => {
                        const orgId = value === 'all' ? null : parseInt(value)
                        setSelectedOrgId(orgId)
                      }}
                    >
                      <SelectTrigger className="w-64">
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
                  </>
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
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {/* Key Metrics Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Teams</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{teams.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {activeTeams} active, {inactiveTeams} inactive
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Members</CardTitle>
                  <Users className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalMembers}</div>
                  <p className="text-xs text-muted-foreground">
                    Avg {avgMembersPerTeam} per team
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">State Coverage</CardTitle>
                  <MapPin className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalStates}</div>
                  <p className="text-xs text-muted-foreground">
                    Unique states covered
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Product Types</CardTitle>
                  <Package className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalProducts}</div>
                  <p className="text-xs text-muted-foreground">
                    Products handled
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Performance Metrics */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Orders Completed</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{totalOrdersCompleted}</div>
                  <p className="text-xs text-muted-foreground">
                    of {totalOrdersAssigned} assigned
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Completion Rate</CardTitle>
                  <Target className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgCompletionRate}%</div>
                  <Progress value={parseFloat(avgCompletionRate)} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Efficiency Score</CardTitle>
                  <Activity className="h-4 w-4 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{avgEfficiencyScore}</div>
                  <p className="text-xs text-muted-foreground">
                    Team performance index
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {teams.length > 0 ? ((activeTeams / teams.length) * 100).toFixed(0) : 0}%
                  </div>
                  <Progress 
                    value={teams.length > 0 ? (activeTeams / teams.length) * 100 : 0} 
                    className="mt-2" 
                  />
                </CardContent>
              </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 md:grid-cols-2 mb-6">
              {/* State Coverage Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    Top States by Team Coverage
                  </CardTitle>
                  <CardDescription>Number of teams covering each state</CardDescription>
                </CardHeader>
                <CardContent>
                  {stateChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={stateChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="name" type="category" width={100} />
                        <Tooltip />
                        <Bar dataKey="teams" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No state coverage data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Product Coverage Chart */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Product Distribution
                  </CardTitle>
                  <CardDescription>Number of teams handling each product type</CardDescription>
                </CardHeader>
                <CardContent>
                  {productChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={productChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={120} 
                          tick={{ fontSize: 12 }}
                        />
                        <Tooltip 
                          formatter={(value) => [`${value} teams`, 'Teams']}
                        />
                        <Bar 
                          dataKey="value" 
                          fill="#8b5cf6" 
                          radius={[0, 4, 4, 0]}
                          name="Teams"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No product data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Bottom Row */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Top Performing Teams */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-yellow-500" />
                    Top Performing Teams
                  </CardTitle>
                  <CardDescription>
                    By monthly productivity target achievement
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {topTeams.length > 0 ? (
                    <div className="space-y-4">
                      {topTeams.map((productivity, index) => {
                        const team = teams.find(t => t.id === productivity.teamId)
                        return (
                          <div key={productivity.teamId} className="flex items-center gap-4">
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              index === 0 ? 'bg-yellow-100 text-yellow-700' :
                              index === 1 ? 'bg-slate-100 text-slate-700' :
                              index === 2 ? 'bg-orange-100 text-orange-700' :
                              'bg-slate-50 text-slate-600'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex-1">
                              <div className="font-medium">{productivity.teamName || team?.name || `Team ${productivity.teamId}`}</div>
                              <div className="text-sm text-muted-foreground">
                                {productivity.activeMembers} active members • Target: {productivity.totalExpectedTarget}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`font-bold ${
                                productivity.teamProductivityPercent >= 100 ? 'text-green-600' :
                                productivity.teamProductivityPercent >= 90 ? 'text-blue-600' :
                                productivity.teamProductivityPercent >= 75 ? 'text-yellow-600' :
                                'text-red-600'
                              }`}>
                                {productivity.teamProductivityPercent.toFixed(1)}%
                              </div>
                              <div className="text-xs text-muted-foreground">productivity</div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : calculatedTeamStats.length > 0 ? (
                    <div className="space-y-4">
                      {calculatedTeamStats.map((stat, index) => (
                        <div key={stat.teamId} className="flex items-center gap-4">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-slate-100 text-slate-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-50 text-slate-600'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">{stat.teamName}</div>
                            <div className="text-sm text-muted-foreground">
                              {stat.completedOrders} of {stat.totalOrders} orders completed
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">{stat.completionRate.toFixed(1)}%</div>
                            <div className="text-xs text-muted-foreground">completion</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mb-2 opacity-50" />
                      <p>No orders data for this period</p>
                      <p className="text-sm">Select a different month/year</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Team Size Distribution & Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Overview
                  </CardTitle>
                  <CardDescription>Size distribution and status</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {/* Team Size Distribution */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">Team Size Distribution</h4>
                      {teamSizeData.length > 0 ? (
                        <div className="space-y-2">
                          {teamSizeData.map(({ range, count }) => (
                            <div key={range} className="flex items-center gap-3">
                              <span className="text-sm w-16">{range} members</span>
                              <div className="flex-1 bg-slate-100 rounded-full h-2">
                                <div 
                                  className="bg-blue-500 rounded-full h-2" 
                                  style={{ width: `${(count / teams.length) * 100}%` }}
                                />
                              </div>
                              <span className="text-sm font-medium w-8">{count}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No teams available</p>
                      )}
                    </div>

                    {/* Status Breakdown */}
                    <div>
                      <h4 className="text-sm font-medium mb-3">Status Breakdown</h4>
                      <div className="flex gap-4">
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-green-500" />
                          <span className="text-sm">Active: {activeTeams}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full bg-slate-300" />
                          <span className="text-sm">Inactive: {inactiveTeams}</span>
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="pt-4 border-t">
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => navigate('/admin/team-management')}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Go to Team Management
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  )
}

export default TeamReportsPage
