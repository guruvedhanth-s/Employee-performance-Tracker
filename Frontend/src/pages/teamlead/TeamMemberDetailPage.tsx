import { useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import { useAuthStore } from '../../store/authStore'
import { usersApi, teamsApi, productivityApi, ordersApi, qualityAuditApi } from '../../services/api'
import type { UserWithTeams, Team, EmployeeProductivity, OrderSimple, QualityAudit } from '../../types'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Progress } from '../../components/ui/progress'
import { Label } from '../../components/ui/label'
import { TeamLeadNav } from '../../components/layout/TeamLeadNav'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { 
  User as UserIcon,
  ArrowLeft,
  Loader2, 
  AlertCircle,
  Users,
  Calendar,
  Clock,
  TrendingUp,
  Target,
  FileText,
  Award,
  BarChart3,
  ClipboardCheck,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { Toaster } from 'react-hot-toast'

const COLORS = ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444']

export const TeamMemberDetailPage = () => {
  const { user: currentUser } = useAuthStore()
  const navigate = useNavigate()
  const { teamId, userId } = useParams<{ teamId: string; userId: string }>()
  
  // Period filter state
  const [selectedPeriod, setSelectedPeriod] = useState<'current' | 'previous' | 'last3'>('current')
  
  // Redirect if not team lead
  if (!currentUser || currentUser.userRole !== 'team_lead') {
    navigate('/login')
    return null
  }

  if (!userId || !teamId) {
    navigate('/teamlead/team-management')
    return null
  }

  const employeeUserId = parseInt(userId)
  const teamIdNum = parseInt(teamId)

  // Calculate date range based on selected period
  const { startDate, endDate } = useMemo(() => {
    const now = new Date()
    switch (selectedPeriod) {
      case 'current':
        return {
          startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd')
        }
      case 'previous':
        const prevMonth = subMonths(now, 1)
        return {
          startDate: format(startOfMonth(prevMonth), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(prevMonth), 'yyyy-MM-dd')
        }
      case 'last3':
        return {
          startDate: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd')
        }
      default:
        return {
          startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd')
        }
    }
  }, [selectedPeriod])

  // Fetch employee details
  const { data: employee, isLoading: loadingEmployee, error: employeeError } = useQuery<UserWithTeams>({
    queryKey: ['users', employeeUserId],
    queryFn: () => usersApi.get(employeeUserId),
    enabled: !!employeeUserId,
  })

  // Fetch team details
  const { data: team, isLoading: loadingTeam, error: teamError } = useQuery<Team>({
    queryKey: ['teams', teamIdNum],
    queryFn: () => teamsApi.get(teamIdNum),
    enabled: !!teamIdNum,
  })

  // Fetch productivity data
  const { data: productivity, isLoading: loadingProductivity, error: productivityError } = useQuery<EmployeeProductivity>({
    queryKey: ['productivity', 'employee', employeeUserId, startDate, endDate],
    queryFn: () => productivityApi.getEmployeeProductivity({
      userId: employeeUserId,
      startDate,
      endDate
    }),
    enabled: !!employeeUserId,
  })

  // Fetch recent orders (last 30 days for this team)
  const { data: ordersData, isLoading: loadingOrders, error: ordersError } = useQuery({
    queryKey: ['orders', 'employee', employeeUserId, teamIdNum],
    queryFn: () => ordersApi.list({
      teamId: teamIdNum,
      pageSize: 50
    }),
    enabled: !!employeeUserId && !!teamIdNum,
  })

  // Filter orders for this employee
  const employeeOrders = useMemo(() => {
    if (!ordersData?.items) return []
    return ordersData.items.filter((order: OrderSimple) => 
      order.step1UserId === employeeUserId || order.step2UserId === employeeUserId
    ).slice(0, 20)
  }, [ordersData, employeeUserId])

  // Fetch quality audits for this employee
  const { data: auditsData, isLoading: loadingAudits, error: auditsError } = useQuery({
    queryKey: ['quality-audits', 'employee', employeeUserId],
    queryFn: () => qualityAuditApi.list({ examinerId: employeeUserId }),
    enabled: !!employeeUserId,
  })

  // Log errors for debugging
  if (employeeError) console.error('Employee fetch error:', employeeError)
  if (teamError) console.error('Team fetch error:', teamError)
  if (productivityError) console.error('Productivity fetch error:', productivityError)
  if (ordersError) console.error('Orders fetch error:', ordersError)
  if (auditsError) console.error('Audits fetch error:', auditsError)

  const recentAudits = useMemo(() => {
    if (!auditsData?.items) return []
    return auditsData.items.slice(0, 10)
  }, [auditsData])

  // Prepare chart data
  const processTypeData = useMemo(() => {
    if (!productivity) return []
    return [
      { name: 'Single Seat', count: productivity.completions?.singleSeat || 0, score: productivity.scores?.singleSeatScore || 0 },
      { name: 'Step 1', count: productivity.completions?.step1Only || 0, score: productivity.scores?.step1Score || 0 },
      { name: 'Step 2', count: productivity.completions?.step2Only || 0, score: productivity.scores?.step2Score || 0 },
    ]
  }, [productivity])

  const pieData = useMemo(() => {
    if (!productivity) return []
    const data = []
    if (productivity.completions?.singleSeat) data.push({ name: 'Single Seat', value: productivity.completions.singleSeat })
    if (productivity.completions?.step1Only) data.push({ name: 'Step 1', value: productivity.completions.step1Only })
    if (productivity.completions?.step2Only) data.push({ name: 'Step 2', value: productivity.completions.step2Only })
    return data
  }, [productivity])

  const getProductivityColor = (percent: number | null | undefined) => {
    if (percent === null || percent === undefined) return 'text-gray-500'
    if (percent >= 100) return 'text-green-600'
    if (percent >= 80) return 'text-blue-600'
    if (percent >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'team_lead':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'employee':
        return 'bg-green-100 text-green-700 border-green-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  const formatShortDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    return format(new Date(dateString), 'MMM dd, yyyy')
  }

  const getStatusBadge = (statusName: string | null | undefined) => {
    if (!statusName) return 'bg-gray-100 text-gray-700'
    const status = statusName.toLowerCase()
    if (status.includes('complete')) return 'bg-green-100 text-green-700'
    if (status.includes('progress')) return 'bg-blue-100 text-blue-700'
    if (status.includes('pending')) return 'bg-yellow-100 text-yellow-700'
    return 'bg-purple-100 text-purple-700'
  }

  const isLoading = loadingEmployee || loadingTeam

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading team member...</span>
            </div>
          </div>
        </header>
        <TeamLeadNav />
      </div>
    )
  }

  if (employeeError || !employee) {
    const errorMessage = employeeError instanceof Error 
      ? employeeError.message 
      : 'Team member not found or access denied'
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-6 w-6" />
                <span>{errorMessage}</span>
              </div>
            </div>
          </div>
        </header>
        <TeamLeadNav />
      </div>
    )
  }

  const initials = employee.userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />
      
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/teamlead/teams/${teamId}/members`)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-blue-100 text-blue-700 text-lg font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold">{employee.userName}</h1>
                <p className="text-sm text-slate-600">
                  {team?.name || 'Team'} - Member Details
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate(`/teamlead/employee/${userId}/performance`)}
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                View Performance
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <TeamLeadNav />
      
      <main className="container mx-auto px-4 py-6">
        {/* Top Summary Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          {/* Productivity Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Productivity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProductivity ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              ) : (
                <>
                  <div className={`text-3xl font-bold ${getProductivityColor(productivity?.productivityPercent)}`}>
                    {productivity?.productivityPercent !== null && productivity?.productivityPercent !== undefined
                      ? `${Math.round(productivity.productivityPercent)}%`
                      : 'N/A'}
                  </div>
                  {productivity?.productivityPercent !== null && (
                    <Progress 
                      value={Math.min(productivity?.productivityPercent || 0, 100)} 
                      className="mt-2 h-2"
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Total Score Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Award className="h-4 w-4" />
                Total Score
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProductivity ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-blue-600">
                    {productivity?.scores?.totalScore?.toFixed(1) || '0'}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Target: {productivity?.expectedTarget?.toFixed(1) || '0'}
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Orders Completed Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Orders
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProductivity ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-purple-600">
                    {(productivity?.completions?.singleSeat || 0) + 
                     (productivity?.completions?.step1Only || 0) + 
                     (productivity?.completions?.step2Only || 0)}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    This period
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          {/* Attendance Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingProductivity ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              ) : (
                <>
                  <div className="text-3xl font-bold text-green-600">
                    {productivity?.attendance?.daysPresent || 0}/{productivity?.period?.workingDays || 0}
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {productivity?.attendance?.attendancePercent?.toFixed(0) || 0}% attendance
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Period Filter */}
        <div className="flex items-center gap-4 mb-6">
          <Label className="text-sm font-medium">Period:</Label>
          <Select value={selectedPeriod} onValueChange={(value: 'current' | 'previous' | 'last3') => setSelectedPeriod(value)}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Current Month</SelectItem>
              <SelectItem value="previous">Previous Month</SelectItem>
              <SelectItem value="last3">Last 3 Months</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-slate-500">
            {format(new Date(startDate), 'MMM dd, yyyy')} - {format(new Date(endDate), 'MMM dd, yyyy')}
          </span>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="quality">Quality Audits</TabsTrigger>
            <TabsTrigger value="info">Employee Info</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Score Breakdown */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Score Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingProductivity ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={processTypeData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis fontSize={12} />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="count" name="Count" fill="#3b82f6" />
                          <Bar dataKey="score" name="Score" fill="#22c55e" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Order Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Order Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loadingProductivity ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                    </div>
                  ) : pieData.length === 0 ? (
                    <div className="flex items-center justify-center py-8 text-slate-500">
                      No orders in this period
                    </div>
                  ) : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, percent }) => `${name}: ${((percent || 0) * 100).toFixed(0)}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {pieData.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Score Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detailed Scores</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="p-4 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="text-sm font-medium text-blue-700">Single Seat</div>
                    <div className="text-2xl font-bold text-blue-600">{productivity?.completions?.singleSeat || 0}</div>
                    <div className="text-xs text-blue-600">Score: {productivity?.scores?.singleSeatScore?.toFixed(1) || '0'}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-50 border border-purple-100">
                    <div className="text-sm font-medium text-purple-700">Step 1 Only</div>
                    <div className="text-2xl font-bold text-purple-600">{productivity?.completions?.step1Only || 0}</div>
                    <div className="text-xs text-purple-600">Score: {productivity?.scores?.step1Score?.toFixed(1) || '0'}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                    <div className="text-sm font-medium text-green-700">Step 2 Only</div>
                    <div className="text-2xl font-bold text-green-600">{productivity?.completions?.step2Only || 0}</div>
                    <div className="text-xs text-green-600">Score: {productivity?.scores?.step2Score?.toFixed(1) || '0'}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Recent Orders
                </CardTitle>
                <CardDescription>
                  Orders worked on by this employee
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingOrders ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : employeeOrders.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No orders found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>File Number</TableHead>
                        <TableHead>Product Type</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>County</TableHead>
                        <TableHead>Process</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Entry Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {employeeOrders.map((order: OrderSimple) => (
                        <TableRow key={order.id} className="cursor-pointer hover:bg-slate-50" onClick={() => navigate(`/employee/edit-order/${order.id}`)}>
                          <TableCell className="font-medium font-mono">{order.fileNumber}</TableCell>
                          <TableCell>{order.productType || '-'}</TableCell>
                          <TableCell>{order.state}</TableCell>
                          <TableCell>{order.county}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.processTypeName || '-'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusBadge(order.orderStatusName)}>
                              {order.orderStatusName || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatShortDate(order.entryDate)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quality Audits Tab */}
          <TabsContent value="quality">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5" />
                  Quality Audits
                </CardTitle>
                <CardDescription>
                  Recent quality audit results
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingAudits ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                  </div>
                ) : recentAudits.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No quality audits found</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Audit Date</TableHead>
                        <TableHead>Process Type</TableHead>
                        <TableHead>Team</TableHead>
                        <TableHead>Files Reviewed</TableHead>
                        <TableHead>Files w/ Error</TableHead>
                        <TableHead>FB Quality</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentAudits.map((audit: QualityAudit) => (
                        <TableRow key={audit.id}>
                          <TableCell>{formatShortDate(audit.auditDate)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{audit.processType}</Badge>
                          </TableCell>
                          <TableCell>{audit.teamName}</TableCell>
                          <TableCell className="text-center">{audit.totalFilesReviewed}</TableCell>
                          <TableCell className="text-center">{audit.filesWithError}</TableCell>
                          <TableCell>
                            <Badge className={audit.fbQuality >= 0.95 ? 'bg-green-100 text-green-700' : audit.fbQuality >= 0.90 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}>
                              {(audit.fbQuality * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Employee Info Tab */}
          <TabsContent value="info">
            <div className="grid gap-4 md:grid-cols-2">
              {/* Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserIcon className="h-5 w-5" />
                    Employee Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Name</Label>
                    <p className="font-medium text-lg">{employee.userName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Username</Label>
                    <p className="font-medium">@{employee.userName}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Employee ID</Label>
                    <p className="font-medium font-mono">{employee.employeeId}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Role</Label>
                    <p className="mt-1">
                      <Badge className={getRoleBadgeColor(employee.userRole)}>
                        {employee.userRole.replace('_', ' ')}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Status</Label>
                    <p className="mt-1">
                      <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last Login
                    </Label>
                    <p className="text-sm">{formatDate(employee.lastLogin)}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Team Memberships */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Team Memberships
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {!employee.teams || employee.teams.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Not a member of any team</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {employee.teams.filter(t => t.isActive).map((membership) => (
                        <div 
                          key={membership.teamId} 
                          className={`p-3 rounded-lg border ${
                            membership.teamId === teamIdNum 
                              ? 'bg-blue-50 border-blue-200' 
                              : 'bg-slate-50 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {membership.teamName}
                                {membership.teamId === teamIdNum && (
                                  <Badge className="ml-2 bg-blue-100 text-blue-700" variant="outline">
                                    Current
                                  </Badge>
                                )}
                              </p>
                              <p className="text-xs text-slate-500">
                                Joined {formatShortDate(membership.joinedAt)}
                              </p>
                            </div>
                            <Badge variant={membership.role === 'lead' ? 'default' : 'secondary'}>
                              {membership.role}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}

export default TeamMemberDetailPage
