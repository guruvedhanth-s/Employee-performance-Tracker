import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useDashboardFilterStore } from '../../store/dashboardFilterStore'
import { useTeamLeadFilterStore } from '../../store/teamLeadFilterStore'
import { teamsApi, metricsApi, productivityApi, ordersApi } from '../../services/api'
import { getInitials, handleLogoutFlow } from '../../utils/helpers'
import type { DashboardStats, TeamProductivity } from '../../types'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Progress } from '../../components/ui/progress'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { TeamLeadNav } from '../../components/layout/TeamLeadNav'
import { ChangePasswordDialog } from '../../components/common/ChangePasswordDialog'
import { 
  Users, 
  Clock, 
  LogOut,
  Plus,
  TrendingUp,
  Activity,
  FileText,
  Award,
  ArrowRight,
  BarChart3,
  Filter,
  ClipboardCheck,
  Settings,
  Lock
} from 'lucide-react'

export const TeamLeadDashboard = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { filterMonth, filterYear } = useDashboardFilterStore()
  const { selectedTeamId, setSelectedTeamId } = useTeamLeadFilterStore()
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  // Redirect if not team lead
  if (!user || user.userRole !== 'team_lead') {
    navigate('/login')
  }

  // Get all teams the team lead manages
  const { data: teamsData, isLoading: loadingTeams } = useQuery({
    queryKey: ['teams', 'my-teams', user?.id],
    queryFn: () => teamsApi.myTeams(),
    enabled: !!user && user.userRole === 'team_lead',
  })

  const myTeams = teamsData?.items || []
  
  // Auto-select first team if none selected or selected team is not in the list
  const teamId = selectedTeamId && myTeams.some(t => t.id === selectedTeamId) 
    ? selectedTeamId 
    : myTeams[0]?.id || null

  // Update selected team if it changes
  if (teamId && teamId !== selectedTeamId) {
    setSelectedTeamId(teamId)
  }

  const currentTeam = myTeams.find(t => t.id === teamId)

  // Calculate date range from filter
  const startDate = `${filterYear}-${filterMonth.padStart(2, '0')}-01`
  const lastDay = new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate()
  const endDate = `${filterYear}-${filterMonth.padStart(2, '0')}-${lastDay}`

  // Dashboard stats query with caching
  const { data: stats, isLoading: loading } = useQuery<DashboardStats>({
    queryKey: ['dashboard', 'teamlead', user?.id, teamId, filterMonth, filterYear],
    queryFn: () => metricsApi.getDashboardStats({
      teamId: teamId ?? undefined,
      month: parseInt(filterMonth),
      year: parseInt(filterYear)
    }),
    enabled: !!user && user.userRole === 'team_lead' && !!teamId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  // Team productivity query
  const { data: teamProductivity, isLoading: loadingProductivity, error: productivityError } = useQuery<TeamProductivity>({
    queryKey: ['productivity', 'team', teamId, startDate, endDate],
    queryFn: () => productivityApi.getTeamProductivity({
      teamId: teamId!,
      startDate,
      endDate,
    }),
    enabled: !!teamId,
    staleTime: 10 * 60 * 1000,
    retry: false, // Don't retry on error to show message faster
  })

  // Recent orders
  const { data: ordersData } = useQuery({
    queryKey: ['orders', 'team', teamId, 'recent'],
    queryFn: () => ordersApi.list({
      teamId: teamId!,
      startDate,
      endDate,
      pageSize: 5,
    }),
    enabled: !!teamId,
    staleTime: 5 * 60 * 1000,
  })

  const recentOrders = ordersData?.items || []

  const handleLogout = () => {
    handleLogoutFlow(logout, navigate)
  }

  const getProductivityColor = (percent: number | null) => {
    if (percent === null) return 'text-gray-500'
    if (percent >= 100) return 'text-green-600'
    if (percent >= 80) return 'text-blue-600'
    if (percent >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  // Get month name
  const monthName = new Date(parseInt(filterYear), parseInt(filterMonth) - 1).toLocaleString('default', { month: 'long' })

  const statsCards = [
    { 
      title: 'Team Members', 
      value: (stats?.activeEmployees ?? 0).toString(), 
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    { 
      title: 'Total Orders', 
      value: (stats?.totalOrders ?? 0).toString(), 
      icon: FileText,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    { 
      title: 'Pending Billing', 
      value: (stats?.ordersPendingBilling ?? 0).toString(), 
      icon: Clock,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    },
  ]

  // Top performers from productivity data - sort by score if no productivity %, otherwise by productivity %
  const topPerformers = teamProductivity?.employees
    ?.filter(e => e.scores?.totalScore > 0 || e.productivityPercent !== null)
    ?.sort((a, b) => {
      // If both have productivity %, sort by that
      if (a.productivityPercent !== null && b.productivityPercent !== null) {
        return b.productivityPercent - a.productivityPercent
      }
      // Otherwise sort by total score
      return (b.scores?.totalScore ?? 0) - (a.scores?.totalScore ?? 0)
    })
    .slice(0, 5) || []

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Team Lead Dashboard</h1>
              <p className="text-sm text-slate-600">
                Welcome, {user?.userName}!
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Team Filter */}
              {myTeams.length > 1 && (
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-slate-600" />
                  <Select 
                    value={teamId?.toString() || ''} 
                    onValueChange={(value) => setSelectedTeamId(parseInt(value))}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Select team" />
                    </SelectTrigger>
                    <SelectContent>
                      {myTeams.map((team) => (
                        <SelectItem key={team.id} value={team.id.toString()}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {myTeams.length === 1 && currentTeam && (
                <Badge variant="outline" className="px-3 py-1">
                  <Users className="w-3 h-3 mr-1" />
                  {currentTeam.name}
                </Badge>
              )}
              
              <Badge variant="outline" className="px-3 py-1">
                <Activity className="w-3 h-3 mr-1" />
                {user?.userRole}
              </Badge>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                    <Avatar>
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        {getInitials(user?.userName || '')}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuLabel>
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium">{user?.userName}</p>
                      <p className="text-xs text-muted-foreground">@{user?.userName}</p>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setChangePasswordOpen(true)}>
                    <Lock className="mr-2 h-4 w-4" />
                    Change Password
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <TeamLeadNav />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Show message if no teams assigned */}
        {!loadingTeams && myTeams.length === 0 && (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Users className="h-16 w-16 text-slate-400 mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">No Teams Assigned</h2>
              <p className="text-slate-600 text-center mb-4">
                You are not assigned as a team lead for any teams yet. Please contact your administrator.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Show loading state */}
        {loadingTeams && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        )}

        {/* Show dashboard content when team is selected */}
        {!loadingTeams && myTeams.length > 0 && teamId && (
          <>
            {/* Team Info Banner */}
            <div className="mb-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {currentTeam?.name || 'Team Dashboard'}
                  </h2>
                  <p className="text-sm text-blue-100">
                    {myTeams.length === 1 
                      ? 'You are managing this team' 
                      : `Managing ${myTeams.length} teams - viewing ${currentTeam?.name}`}
                  </p>
                </div>
              </div>
            </div>
        {/* Stats Grid */}
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardHeader className="pb-2">
                  <div className="h-4 bg-slate-200 rounded w-24"></div>
                </CardHeader>
                <CardContent>
                  <div className="h-8 bg-slate-200 rounded w-16 mb-2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {statsCards.map((stat, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    {stat.title}
                  </CardTitle>
                  <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{stat.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          {/* Team Productivity Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Team Productivity
                </CardTitle>
                <CardDescription>{monthName} {filterYear}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/teamlead/productivity')}>
                View Details
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {loadingProductivity ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-4 bg-slate-200 rounded w-full"></div>
                  <div className="h-8 bg-slate-200 rounded w-24"></div>
                </div>
              ) : productivityError ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-2">Failed to load productivity data</div>
                  <p className="text-sm text-muted-foreground">Please try refreshing the page</p>
                </div>
              ) : teamProductivity ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-600">Overall Productivity</span>
                    <span className={`text-2xl font-bold ${getProductivityColor(teamProductivity.totalExpectedTarget > 0 ? teamProductivity.teamProductivityPercent : null)}`}>
                      {teamProductivity.totalExpectedTarget > 0 
                        ? `${Math.round(teamProductivity.teamProductivityPercent)}%`
                        : 'N/A'}
                    </span>
                  </div>
                  {teamProductivity.totalExpectedTarget > 0 ? (
                    <Progress 
                      value={Math.min(teamProductivity.teamProductivityPercent, 100)} 
                      className="h-3"
                    />
                  ) : (
                    <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                      No monthly target set. Set team target in Admin Settings to track productivity.
                    </div>
                  )}
                  <div className="grid grid-cols-3 gap-4 pt-2">
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <div className="text-lg font-bold">{teamProductivity.totalTeamScore.toFixed(1)}</div>
                      <div className="text-xs text-slate-600">Total Score</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <div className="text-lg font-bold">
                        {teamProductivity.totalExpectedTarget > 0 
                          ? teamProductivity.totalExpectedTarget.toFixed(1) 
                          : '-'}
                      </div>
                      <div className="text-xs text-slate-600">Target</div>
                    </div>
                    <div className="text-center p-3 bg-slate-50 rounded-lg">
                      <div className="text-lg font-bold">{teamProductivity.activeMembers}</div>
                      <div className="text-xs text-slate-600">Active</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-muted-foreground mb-2">No team members with productivity data</p>
                  <p className="text-xs text-slate-400">
                    Ensure employees are assigned to this team via Team Management
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Top Performers Card */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-yellow-600" />
                  Top Performers
                </CardTitle>
                <CardDescription>This month's best performers</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate('/teamlead/team')}>
                View All
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {loadingProductivity ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4">
                      <div className="h-8 w-8 bg-slate-200 rounded-full"></div>
                      <div className="flex-1 h-4 bg-slate-200 rounded"></div>
                    </div>
                  ))}
                </div>
              ) : topPerformers.length > 0 ? (
                <div className="space-y-4">
                  {topPerformers.map((employee, idx) => (
                    <div key={employee.userId} className="flex items-center gap-4">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${
                        idx === 0 ? 'bg-yellow-100 text-yellow-800' :
                        idx === 1 ? 'bg-slate-200 text-slate-700' :
                        idx === 2 ? 'bg-orange-100 text-orange-800' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {idx + 1}
                      </div>
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{getInitials('')}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{employee.userName || employee.userName}</p>
                        <p className="text-xs text-muted-foreground">Score: {employee.scores.totalScore.toFixed(1)}</p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={`${getProductivityColor(employee.productivityPercent)}`}
                      >
                        {employee.productivityPercent !== null ? `${Math.round(employee.productivityPercent)}%` : 'N/A'}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : productivityError ? (
                <div className="text-center py-8">
                  <div className="text-red-500 mb-2">Failed to load data</div>
                  <p className="text-sm text-muted-foreground">Please try refreshing</p>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Award className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                  <p className="text-muted-foreground mb-2">No performance data yet</p>
                  <p className="text-xs text-slate-400">
                    Employees need to be assigned to teams and have completed orders
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Recent Orders
              </CardTitle>
              <CardDescription>Latest orders from your team</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/teamlead/orders')}>
              View All Orders
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {recentOrders.length > 0 ? (
              <div className="space-y-3">
                {recentOrders.map((order) => (
                  <div 
                    key={order.id} 
                    className="flex items-center justify-between p-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                    onClick={() => navigate(`/employee/edit-order/${order.id}`)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="font-mono text-sm font-medium">{order.fileNumber}</div>
                      <Badge variant="outline">{order.state}</Badge>
                      <Badge variant="secondary">{order.productType}</Badge>
                    </div>
                    <div className="flex items-center gap-3">
                      {order.step1UserId && order.step2UserId ? (
                        <Badge className="bg-green-100 text-green-800">Completed</Badge>
                      ) : order.step1UserId || order.step2UserId ? (
                        <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
                      ) : (
                        <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.entryDate).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No orders yet this month</p>
                <Button className="mt-4" variant="outline" onClick={() => navigate('/employee/new-order')}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create New Order
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8">
          <Card 
            className="hover:shadow-lg transition-all cursor-pointer hover:border-blue-300"
            onClick={() => navigate('/teamlead/team')}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-blue-50 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold">Manage Team</h3>
                <p className="text-sm text-muted-foreground">View and manage team members</p>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="hover:shadow-lg transition-all cursor-pointer hover:border-purple-300"
            onClick={() => navigate('/teamlead/orders')}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-purple-50 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
              <div>
                <h3 className="font-semibold">View Orders</h3>
                <p className="text-sm text-muted-foreground">Browse all team orders</p>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="hover:shadow-lg transition-all cursor-pointer hover:border-green-300"
            onClick={() => navigate('/teamlead/productivity')}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-green-50 rounded-lg">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold">Productivity Reports</h3>
                <p className="text-sm text-muted-foreground">View detailed productivity metrics</p>
              </div>
            </CardContent>
          </Card>
          
          <Card 
            className="hover:shadow-lg transition-all cursor-pointer hover:border-amber-300"
            onClick={() => navigate('/teamlead/quality-audit')}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className="p-3 bg-amber-50 rounded-lg">
                <ClipboardCheck className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold">Quality Audit</h3>
                <p className="text-sm text-muted-foreground">Track quality metrics</p>
              </div>
            </CardContent>
          </Card>
        </div>
          </>
        )}
      </main>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  )
}

export default TeamLeadDashboard
