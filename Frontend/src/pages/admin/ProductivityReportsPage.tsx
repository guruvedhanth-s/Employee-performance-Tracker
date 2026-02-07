import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useDashboardFilterStore, getMonthOptions, getYearOptions } from '../../store/dashboardFilterStore'
import { teamsApi, organizationsApi, productivityApi } from '../../services/api'
import type { Organization, Team, TeamProductivity, EmployeeProductivity } from '../../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Progress } from '../../components/ui/progress'
import { Badge } from '../../components/ui/badge'
import { AdminNav } from '../../components/layout/AdminNav'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { 
  TrendingUp, 
  Settings, 
  RefreshCw,
  Activity,
  Filter,
  Users,
  Trophy,
  Zap,
  Calendar,
  Calculator,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts'
import toast from 'react-hot-toast'

export const ProductivityReportsPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  
  const [teams, setTeams] = useState<Team[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [teamProductivity, setTeamProductivity] = useState<TeamProductivity | null>(null)
  const [leaderboard, setLeaderboard] = useState<EmployeeProductivity[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTeamData, setLoadingTeamData] = useState(false)
  const [expandedTeams, setExpandedTeams] = useState<Set<number>>(new Set())
  const [allTeamsProductivity, setAllTeamsProductivity] = useState<TeamProductivity[]>([])
  
  // Custom date range states
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  
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
  
  // For superadmin: selected org for filtering
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(
    user?.userRole === 'superadmin' ? null : (user?.orgId || null)
  )

  useEffect(() => {
    if (!user || !['admin', 'superadmin'].includes(user.userRole)) {
      navigate('/login')
    } else {
      fetchInitialData()
    }
  }, [user, navigate])

  // Re-fetch when org filter changes
  useEffect(() => {
    if (user) {
      fetchTeams()
    }
  }, [selectedOrgId])

  // Re-fetch productivity data when month/year or team changes
  useEffect(() => {
    if (user && teams.length > 0) {
      fetchProductivityData()
    }
  }, [filterMonth, filterYear, selectedTeamId, teams, customStartDate, customEndDate])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      
      // Fetch organizations for superadmin
      if (user?.userRole === 'superadmin') {
        const orgsResponse = await organizationsApi.list({ isActive: true })
        setOrganizations(orgsResponse.items || [])
      }
      
      await fetchTeams()
    } catch (error) {
      console.error('Failed to fetch initial data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const fetchTeams = async () => {
    try {
      const orgIdToFetch = user?.userRole === 'superadmin' 
        ? (selectedOrgId ?? undefined) 
        : (user?.orgId ?? undefined)
      
      const teamsResponse = await teamsApi.list({ orgId: orgIdToFetch, isActive: true })
      setTeams(teamsResponse.items || [])
      
      // Auto-select first team if none selected
      if (!selectedTeamId && teamsResponse.items?.length > 0) {
        setSelectedTeamId(teamsResponse.items[0].id)
      }
    } catch (error) {
      console.error('Failed to fetch teams:', error)
    }
  }

  const fetchProductivityData = async () => {
    try {
      setLoadingTeamData(true)
      
      // Calculate date range - use custom dates if period is 'custom', otherwise use month/year
      let startDate: string
      let endDate: string
      
      if (filterPeriod === 'custom' && customStartDate && customEndDate) {
        startDate = customStartDate
        endDate = customEndDate
      } else {
        const lastDay = new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate()
        startDate = `${filterYear}-${filterMonth.padStart(2, '0')}-01`
        endDate = `${filterYear}-${filterMonth.padStart(2, '0')}-${lastDay}`
      }
      
      const orgIdToFetch = user?.userRole === 'superadmin' 
        ? (selectedOrgId ?? undefined) 
        : (user?.orgId ?? undefined)
      
      // Fetch leaderboard
      const leaderboardResponse = await productivityApi.getLeaderboard({
        startDate,
        endDate,
        orgId: orgIdToFetch,
        teamId: selectedTeamId ?? undefined,
        limit: 10
      })
      setLeaderboard(leaderboardResponse.items || [])
      
      // Fetch productivity for selected team
      if (selectedTeamId) {
        const teamProdResponse = await productivityApi.getTeamProductivity({
          teamId: selectedTeamId,
          startDate,
          endDate
        })
        setTeamProductivity(teamProdResponse)
      }
      
      // Fetch productivity for all teams (for overview)
      const allTeamsProd: TeamProductivity[] = []
      for (const team of teams.slice(0, 10)) { // Limit to 10 teams for performance
        try {
          const prod = await productivityApi.getTeamProductivity({
            teamId: team.id,
            startDate,
            endDate
          })
          allTeamsProd.push(prod)
        } catch (err) {
          // Skip teams with errors
        }
      }
      setAllTeamsProductivity(allTeamsProd)
      
    } catch (error) {
      console.error('Failed to fetch productivity data:', error)
    } finally {
      setLoadingTeamData(false)
    }
  }

  const toggleTeamExpand = (teamId: number) => {
    setExpandedTeams(prev => {
      const newSet = new Set(prev)
      if (newSet.has(teamId)) {
        newSet.delete(teamId)
      } else {
        newSet.add(teamId)
      }
      return newSet
    })
  }

  const getProductivityColor = (percent: number | null) => {
    if (percent === null) return 'text-gray-500'
    if (percent >= 100) return 'text-green-600'
    if (percent >= 80) return 'text-blue-600'
    if (percent >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Prepare chart data for team comparison
  const teamComparisonData = allTeamsProductivity
    .sort((a, b) => b.teamProductivityPercent - a.teamProductivityPercent)
    .map(tp => ({
      name: tp.teamName.length > 15 ? tp.teamName.substring(0, 12) + '...' : tp.teamName,
      productivity: tp.teamProductivityPercent,
      fullName: tp.teamName
    }))

  // Calculate summary stats
  const avgProductivity = allTeamsProductivity.length > 0
    ? allTeamsProductivity.reduce((acc, tp) => acc + tp.teamProductivityPercent, 0) / allTeamsProductivity.length
    : 0
  
  const totalScore = allTeamsProductivity.reduce((acc, tp) => acc + tp.totalTeamScore, 0)
  const totalTarget = allTeamsProductivity.reduce((acc, tp) => acc + tp.totalExpectedTarget, 0)
  const totalMembers = allTeamsProductivity.reduce((acc, tp) => acc + tp.activeMembers, 0)

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Productivity Reports</h1>
              <p className="text-sm text-slate-600">Track employee and team productivity scores</p>
            </div>
            <Button onClick={() => navigate('/admin/team-management')}>
              <Settings className="h-4 w-4 mr-2" />
              Manage Targets
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
              {/* Left side - Organization & Team filters */}
              <div className="flex items-center gap-4">
                {user?.userRole === 'superadmin' && (
                  <>
                    <Label className="whitespace-nowrap">Organization:</Label>
                    <Select
                      value={selectedOrgId ? selectedOrgId.toString() : 'all'}
                      onValueChange={(value) => {
                        const orgId = value === 'all' ? null : parseInt(value)
                        setSelectedOrgId(orgId)
                        setSelectedTeamId(null)
                      }}
                    >
                      <SelectTrigger className="w-48">
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
                
                <Label className="whitespace-nowrap">Team:</Label>
                <Select
                  value={selectedTeamId ? selectedTeamId.toString() : 'all'}
                  onValueChange={(value) => {
                    setSelectedTeamId(value === 'all' ? null : parseInt(value))
                  }}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="All Teams" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Right side - Period filters */}
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
                
                {filterPeriod === 'custom' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">From:</Label>
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="w-40 h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">To:</Label>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="w-40 h-8 text-xs"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
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
                    <Select value={filterYear} onValueChange={setFilterYear}>
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
                  </>
                )}
                
                <Button variant="outline" size="sm" onClick={fetchProductivityData} disabled={loadingTeamData}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${loadingTeamData ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Productivity</CardTitle>
                  <Activity className="h-4 w-4 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className={`text-2xl font-bold ${getProductivityColor(avgProductivity)}`}>
                    {avgProductivity.toFixed(1)}%
                  </div>
                  <Progress 
                    value={Math.min(avgProductivity, 100)} 
                    className="mt-2"
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Score</CardTitle>
                  <Zap className="h-4 w-4 text-yellow-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalScore.toFixed(1)}</div>
                  <p className="text-xs text-muted-foreground">
                    of {totalTarget} target
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Employees</CardTitle>
                  <Users className="h-4 w-4 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totalMembers}</div>
                  <p className="text-xs text-muted-foreground">
                    Across {allTeamsProductivity.length} teams
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Period</CardTitle>
                  <Calendar className="h-4 w-4 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filterPeriod === 'custom' && customStartDate && customEndDate ? (
                      `${new Date(customStartDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(customEndDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                    ) : (
                      new Date(parseInt(filterYear), parseInt(filterMonth) - 1).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {teamProductivity?.period?.workingDays || '--'} working days
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Grid */}
            <div className="grid gap-6 lg:grid-cols-3 mb-6">
              {/* Leaderboard */}
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Top Performers
                  </CardTitle>
                  <CardDescription>Highest productivity scores</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTeamData ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : leaderboard.length > 0 ? (
                    <div className="space-y-3">
                      {leaderboard.slice(0, 10).map((emp, index) => (
                        <div 
                          key={`${emp.userId}-${index}`} 
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-50"
                        >
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-700' :
                            index === 1 ? 'bg-slate-200 text-slate-700' :
                            index === 2 ? 'bg-orange-100 text-orange-700' :
                            'bg-slate-50 text-slate-600'
                          }`}>
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">
                              {emp.userName || emp.userName}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">
                              {emp.teamBreakdown?.[0]?.teamName || `${emp.teamsIncluded?.length || 0} team(s)`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold ${getProductivityColor(emp.productivityPercent)}`}>
                              {emp.productivityPercent !== null ? `${emp.productivityPercent.toFixed(1)}%` : 'N/A'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {emp.scores.totalScore.toFixed(1)} pts
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Trophy className="h-10 w-10 mx-auto mb-2 opacity-30" />
                      <p>No data available</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Team Comparison Chart */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Team Productivity Comparison
                  </CardTitle>
                  <CardDescription>Productivity percentage by team</CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingTeamData ? (
                    <div className="flex items-center justify-center h-[300px]">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : teamComparisonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={teamComparisonData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" domain={[0, 'dataMax']} tickFormatter={(val) => `${val}%`} />
                        <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip 
                          formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`, 'Productivity']}
                          labelFormatter={(label) => {
                            const item = teamComparisonData.find(d => d.name === label)
                            return item?.fullName || label
                          }}
                        />
                        <Bar dataKey="productivity" radius={[0, 4, 4, 0]}>
                          {teamComparisonData.map((entry, index) => (
                            <Cell 
                              key={`cell-${index}`} 
                              fill={
                                entry.productivity >= 100 ? '#22c55e' :
                                entry.productivity >= 80 ? '#3b82f6' :
                                entry.productivity >= 60 ? '#eab308' :
                                '#ef4444'
                              } 
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      No team data available
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Team Details Table */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Team Productivity Details
                </CardTitle>
                <CardDescription>
                  Click on a team to view individual employee scores. 
                  Score = (Step1 × 1) + (Step2 × Team Multiplier) + (Single Seat × 1)
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingTeamData ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                ) : allTeamsProductivity.length > 0 ? (
                  <div className="space-y-2">
                    {allTeamsProductivity.map((tp) => (
                      <div key={tp.teamId} className="border rounded-lg overflow-hidden">
                        {/* Team Header Row */}
                        <div 
                          className="flex items-center justify-between p-4 bg-slate-50 cursor-pointer hover:bg-slate-100"
                          onClick={() => toggleTeamExpand(tp.teamId)}
                        >
                          <div className="flex items-center gap-4">
                            {expandedTeams.has(tp.teamId) ? (
                              <ChevronUp className="h-5 w-5 text-slate-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-slate-400" />
                            )}
                            <div>
                              <div className="font-medium">{tp.teamName}</div>
                              <div className="text-sm text-muted-foreground">
                                {tp.activeMembers} members | Target: {tp.dailyTarget}/day | Step2 Score: {tp.step2ScoreMultiplier}x
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              <div className="text-sm text-muted-foreground">Total Score</div>
                              <div className="font-bold">{tp.totalTeamScore.toFixed(1)} / {tp.totalExpectedTarget}</div>
                            </div>
                            <div className="text-right min-w-[100px]">
                              <div className="text-sm text-muted-foreground">Productivity</div>
                              <div className={`text-xl font-bold ${getProductivityColor(tp.teamProductivityPercent)}`}>
                                {tp.teamProductivityPercent.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        {/* Expanded Employee Details */}
                        {expandedTeams.has(tp.teamId) && tp.employees && tp.employees.length > 0 && (
                          <div className="border-t">
                            <Table>
                              <TableHeader>
                                <TableRow className="bg-slate-50">
                                  <TableHead>Employee</TableHead>
                                  <TableHead className="text-center">Step 1</TableHead>
                                  <TableHead className="text-center">Step 2</TableHead>
                                  <TableHead className="text-center">Single Seat</TableHead>
                                  <TableHead className="text-center">Total Score</TableHead>
                                  <TableHead className="text-center">Expected</TableHead>
                                  <TableHead className="text-right">Productivity</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {tp.employees
                                  .sort((a, b) => {
                                    if (a.productivityPercent === null && b.productivityPercent === null) return 0
                                    if (a.productivityPercent === null) return 1
                                    if (b.productivityPercent === null) return -1
                                    return b.productivityPercent - a.productivityPercent
                                  })
                                  .map((emp) => (
                                  <TableRow key={emp.userId}>
                                    <TableCell>
                                      <div>
                                        <div className="font-medium">{emp.userName || emp.userName}</div>
                                        <div className="text-xs text-muted-foreground">{emp.employeeId}</div>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div>{emp.completions.step1Only}</div>
                                      <div className="text-xs text-muted-foreground">({emp.scores.step1Score} pts)</div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div>{emp.completions.step2Only}</div>
                                      <div className="text-xs text-muted-foreground">({emp.scores.step2Score.toFixed(1)} pts)</div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                      <div>{emp.completions.singleSeat}</div>
                                      <div className="text-xs text-muted-foreground">({emp.scores.singleSeatScore} pts)</div>
                                    </TableCell>
                                    <TableCell className="text-center font-medium">
                                      {emp.scores.totalScore.toFixed(1)}
                                    </TableCell>
                                    <TableCell className="text-center text-muted-foreground">
                                      {emp.expectedTarget}
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <Badge 
                                        variant="outline" 
                                        className={`${getProductivityColor(emp.productivityPercent)} border-current`}
                                      >
                                        {emp.productivityPercent !== null ? `${emp.productivityPercent.toFixed(1)}%` : 'N/A'}
                                      </Badge>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                        
                        {expandedTeams.has(tp.teamId) && (!tp.employees || tp.employees.length === 0) && (
                          <div className="p-4 text-center text-muted-foreground border-t">
                            No employee data available
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <Calculator className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>No productivity data available</p>
                    <p className="text-sm mt-1">Select a team or adjust the date filters</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Legend / Help Card */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-sm">How Productivity is Calculated</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">Score Calculation</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li><span className="font-medium text-slate-700">Step 1 Only:</span> 1 point per completion</li>
                      <li><span className="font-medium text-slate-700">Step 2 Only:</span> Team's Step2 Score multiplier per completion</li>
                      <li><span className="font-medium text-slate-700">Single Seat:</span> 1 point per completion (both steps by same user)</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Productivity Formula</h4>
                    <p className="text-muted-foreground">
                      <code className="bg-slate-100 px-2 py-1 rounded">
                        Productivity % = (Total Score / Expected Target) × 100
                      </code>
                    </p>
                    <p className="text-muted-foreground mt-2">
                      Expected Target = Working Days × Daily Target
                    </p>
                  </div>
                </div>
                <div className="flex gap-4 mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-green-500" />
                    <span className="text-xs">100%+ Excellent</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-blue-500" />
                    <span className="text-xs">80-99% Good</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-yellow-500" />
                    <span className="text-xs">60-79% Average</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded bg-red-500" />
                    <span className="text-xs">&lt;60% Needs Improvement</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  )
}

export default ProductivityReportsPage
