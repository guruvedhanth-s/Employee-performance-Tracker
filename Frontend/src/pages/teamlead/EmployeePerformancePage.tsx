import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useAuthStore } from '../../store/authStore'
import { useDashboardFilterStore, getMonthOptions, getYearOptions } from '../../store/dashboardFilterStore'
import { useTeamLeadFilterStore } from '../../store/teamLeadFilterStore'
import { productivityApi, ordersApi, usersApi, teamsApi } from '../../services/api'
import { getInitials } from '../../utils/helpers'
import type { EmployeeProductivity, OrderSimple, Team } from '../../types'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Progress } from '../../components/ui/progress'
import { Label } from '../../components/ui/label'
import { TeamLeadNav } from '../../components/layout/TeamLeadNav'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { Calendar } from '../../components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import { 
  TrendingUp, 
  Award,
  Loader2,
  CalendarIcon,
  Filter,
  FileText,
  CheckCircle2,
  XCircle,
  User
} from 'lucide-react'
// Recharts imports removed - chart section was removed

export const EmployeePerformancePage = () => {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { filterMonth, filterYear, filterPeriod, setFilterMonth, setFilterYear, setFilterPeriod, setCurrentMonth, setPreviousMonth } = useDashboardFilterStore()
  const { selectedTeamId, setSelectedTeamId } = useTeamLeadFilterStore()
  
  // Custom date range state
  const [dateRange, setDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  })
  const [useCustomRange, setUseCustomRange] = useState(false)

  // Redirect if not team lead
  if (!user || user.userRole !== 'team_lead') {
    navigate('/login')
    return null
  }

  if (!userId) {
    navigate('/teamlead/productivity')
    return null
  }

  const employeeUserId = parseInt(userId)

  // Fetch employee details including their teams
  const { data: employeeData } = useQuery({
    queryKey: ['users', employeeUserId],
    queryFn: () => usersApi.get(employeeUserId),
    enabled: !!employeeUserId,
  })

  // Get all teams the team lead manages
  const { data: teamsData } = useQuery({
    queryKey: ['teams', 'my-teams', user?.id],
    queryFn: () => teamsApi.myTeams(),
    enabled: !!user && user.userRole === 'team_lead',
  })

  const myTeams = teamsData?.items || []
  
  // Auto-select team: use selectedTeamId if valid, otherwise use first team
  const effectiveTeamId = selectedTeamId && myTeams.some((t: Team) => t.id === selectedTeamId) 
    ? selectedTeamId 
    : myTeams[0]?.id || null

  // Update selected team if it changes
  useEffect(() => {
    if (effectiveTeamId && effectiveTeamId !== selectedTeamId) {
      setSelectedTeamId(effectiveTeamId)
    }
  }, [effectiveTeamId, selectedTeamId, setSelectedTeamId])

  // Calculate date range based on filter type
  let startDate: string
  let endDate: string

  if (useCustomRange && dateRange.from && dateRange.to) {
    startDate = format(dateRange.from, 'yyyy-MM-dd')
    endDate = format(dateRange.to, 'yyyy-MM-dd')
  } else {
    startDate = `${filterYear}-${filterMonth.padStart(2, '0')}-01`
    const lastDay = new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate()
    endDate = `${filterYear}-${filterMonth.padStart(2, '0')}-${lastDay}`
  }

  // Fetch employee productivity (aggregated across all teams)
  const { data: productivity, isLoading: loadingProductivity } = useQuery<EmployeeProductivity>({
    queryKey: ['productivity', 'employee', employeeUserId, startDate, endDate],
    queryFn: () => productivityApi.getEmployeeProductivity({
      userId: employeeUserId,
      startDate,
      endDate,
    }),
    enabled: !!employeeUserId,
  })

  // Fetch employee orders for the period (where employee worked on step1 or step2)
  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['orders', 'employee', employeeUserId, effectiveTeamId, startDate, endDate],
    queryFn: async () => {
      // Fetch all orders for the team in the date range, then filter by employee
      const response = await ordersApi.list({
        teamId: effectiveTeamId || undefined,
        startDate,
        endDate,
      })
      // Filter to only show orders where this employee was involved
      const employeeOrders = response.items.filter(
        order => order.step1UserId === employeeUserId || order.step2UserId === employeeUserId
      )
      return { ...response, items: employeeOrders }
    },
    enabled: !!employeeUserId && !!effectiveTeamId,
  })

  const orders = ordersData?.items || []

  const handlePeriodChange = (value: string) => {
    if (value === 'current') {
      setCurrentMonth()
      setUseCustomRange(false)
    } else if (value === 'previous') {
      setPreviousMonth()
      setUseCustomRange(false)
    } else if (value === 'custom') {
      setFilterPeriod('custom')
      setUseCustomRange(true)
    } else {
      setFilterPeriod('custom')
      setUseCustomRange(false)
    }
  }

  const getInitials = (name: string) => {
    if (!name) return '??'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getProductivityColor = (percent: number | null) => {
    if (percent === null) return 'text-gray-500'
    if (percent >= 100) return 'text-green-600'
    if (percent >= 80) return 'text-blue-600'
    if (percent >= 60) return 'text-yellow-600'
    return 'text-red-600'
  }

  const getDateRangeDisplay = () => {
    if (useCustomRange && dateRange.from && dateRange.to) {
      return `${format(dateRange.from, 'MMM dd, yyyy')} - ${format(dateRange.to, 'MMM dd, yyyy')}`
    }
    const monthName = new Date(parseInt(filterYear), parseInt(filterMonth) - 1).toLocaleString('default', { month: 'long' })
    return `${monthName} ${filterYear}`
  }

  // Calculate order statistics - OrderSimple uses orderStatusName instead of status
  const completedOrders = orders.filter(o => o.orderStatusName?.toLowerCase() === 'completed').length

  // Group orders by date for chart
  // Order statistics (kept for potential future use but chart was removed)
  const _ordersByDate = orders.reduce((acc, order) => {
    if (!order.createdAt) return acc
    const date = format(new Date(order.createdAt), 'MMM dd')
    if (!acc[date]) {
      acc[date] = { date, completed: 0, pending: 0, inProgress: 0 }
    }
    const status = order.orderStatusName?.toLowerCase() || ''
    if (status === 'completed') acc[date].completed++
    else if (status === 'pending') acc[date].pending++
    else if (status === 'in progress') acc[date].inProgress++
    return acc
  }, {} as Record<string, { date: string; completed: number; pending: number; inProgress: number }>)
  void _ordersByDate // Suppress unused warning

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Avatar className="h-12 w-12">
                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                  {getInitials(employeeData?.userName || '')}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">
                  {employeeData?.userName || 'Employee Performance'}
                </h1>
                <p className="text-sm text-slate-600">
                  @{employeeData?.userName} • {getDateRangeDisplay()}
                </p>
              </div>
            </div>
            
            <Button variant="outline" onClick={() => navigate('/teamlead/productivity')}>
              Back to Team
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <TeamLeadNav />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Filters Card */}
        <Card className="mb-6 overflow-visible relative z-10">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">Filters</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Team Filter - Show if managing multiple teams */}
              {myTeams.length > 1 && (
                <div className="space-y-1">
                  <Label className="text-xs text-slate-500">Team</Label>
                  <Select value={effectiveTeamId?.toString() || ''} onValueChange={(value) => setSelectedTeamId(parseInt(value))}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select Team" />
                    </SelectTrigger>
                    <SelectContent>
                      {myTeams.map((team: Team) => (
                        <SelectItem key={team.id} value={team.id.toString()}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {/* Period Filter */}
              <div className="space-y-1">
                <Label className="text-xs text-slate-500">Period</Label>
                <Select value={useCustomRange ? 'custom' : filterPeriod} onValueChange={handlePeriodChange}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="current">Current Month</SelectItem>
                    <SelectItem value="previous">Previous Month</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Month/Year Filters - Only show when not custom range */}
              {!useCustomRange && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Month</Label>
                    <Select value={filterMonth} onValueChange={setFilterMonth}>
                      <SelectTrigger className="h-9">
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
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Year</Label>
                    <Select value={filterYear} onValueChange={setFilterYear}>
                      <SelectTrigger className="h-9">
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
                </>
              )}
              
              {/* Custom Date Range Picker */}
              {useCustomRange && (
                <>
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">From Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-9 justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.from ? format(dateRange.from, 'MMM dd, yyyy') : <span className="text-muted-foreground">Pick start date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white" align="start" side="bottom">
                        <Calendar
                          mode="single"
                          selected={dateRange.from}
                          onSelect={(date) => setDateRange({ ...dateRange, from: date })}
                          disabled={(date) => dateRange.to ? date > dateRange.to : false}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">To Date</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full h-9 justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {dateRange.to ? format(dateRange.to, 'MMM dd, yyyy') : <span className="text-muted-foreground">Pick end date</span>}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-white" align="start" side="bottom">
                        <Calendar
                          mode="single"
                          selected={dateRange.to}
                          onSelect={(date) => setDateRange({ ...dateRange, to: date })}
                          disabled={(date) => dateRange.from ? date < dateRange.from : false}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {!effectiveTeamId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No team selected. Please select a team to view employee performance.</p>
            </CardContent>
          </Card>
        ) : loadingProductivity || loadingOrders ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !productivity ? (
          <Card>
            <CardContent className="py-12 text-center">
              <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-lg font-medium text-slate-900 mb-2">No productivity data found</p>
              <p className="text-sm text-muted-foreground">
                This employee may not be part of the selected team or has no data for the selected period.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Team ID: {effectiveTeamId} • Employee ID: {employeeUserId} • Period: {startDate} to {endDate}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Productivity
                  </CardTitle>
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${getProductivityColor(productivity?.productivityPercent ?? null)}`}>
                    {productivity?.productivityPercent !== null && productivity?.productivityPercent !== undefined
                      ? `${Math.round(productivity.productivityPercent)}%`
                      : 'N/A'
                    }
                  </div>
                  {productivity?.productivityPercent !== null && productivity?.productivityPercent !== undefined ? (
                    <Progress 
                      value={Math.min(productivity.productivityPercent, 100)} 
                      className="mt-2 h-2"
                    />
                  ) : (
                    <p className="text-xs text-amber-600 mt-2">No weekly target set</p>
                  )}
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Total Score
                  </CardTitle>
                  <Award className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {productivity?.scores.totalScore?.toFixed(1) || '0'}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Target: {productivity?.expectedTarget?.toFixed(1) || '0'}
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Total Orders
                  </CardTitle>
                  <FileText className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {orders.length}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {completedOrders} completed
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Attendance
                  </CardTitle>
                  <CalendarIcon className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {productivity?.attendance?.daysPresent || 0}/{productivity?.period?.workingDays || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {productivity?.attendance?.attendancePercent?.toFixed(0) || 0}% attendance
                  </p>
                  {productivity?.attendance && productivity.attendance.daysAbsent > 0 && (
                    <Badge variant="outline" className="mt-2 bg-red-50 text-red-700 border-red-200">
                      {productivity.attendance.daysAbsent} absent
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Productivity Breakdown */}
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Productivity Breakdown</CardTitle>
                  <CardDescription>Score by completion type</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Single Seat Completions</p>
                        <p className="text-xs text-muted-foreground">Both steps by same user</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-blue-600">{productivity?.completions.singleSeat || 0}</p>
                        <p className="text-xs text-muted-foreground">Score: {productivity?.scores.singleSeatScore?.toFixed(1) || '0'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Step 1 Only</p>
                        <p className="text-xs text-muted-foreground">Step 1 completions</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-purple-600">{productivity?.completions.step1Only || 0}</p>
                        <p className="text-xs text-muted-foreground">Score: {productivity?.scores.step1Score?.toFixed(1) || '0'}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-slate-700">Step 2 Only</p>
                        <p className="text-xs text-muted-foreground">Step 2 completions</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-600">{productivity?.completions.step2Only || 0}</p>
                        <p className="text-xs text-muted-foreground">Score: {productivity?.scores.step2Score?.toFixed(1) || '0'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Attendance Details</CardTitle>
                  <CardDescription>Days present vs absent</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-8 w-8 text-green-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">Days Present</p>
                          <p className="text-xs text-muted-foreground">Days with order activity</p>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-green-600">{productivity?.attendance?.daysPresent || 0}</div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <XCircle className="h-8 w-8 text-red-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">Days Absent</p>
                          <p className="text-xs text-muted-foreground">No order activity</p>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-red-600">{productivity?.attendance?.daysAbsent || 0}</div>
                    </div>
                    
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CalendarIcon className="h-8 w-8 text-blue-600" />
                        <div>
                          <p className="text-sm font-medium text-slate-700">Total Working Days</p>
                          <p className="text-xs text-muted-foreground">Expected in period</p>
                        </div>
                      </div>
                      <div className="text-2xl font-bold text-blue-600">{productivity?.period?.workingDays || 0}</div>
                    </div>

                    {/* Attendance Progress Bar */}
                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-slate-700">Attendance Rate</span>
                        <span className="text-sm font-bold text-slate-900">{productivity?.attendance?.attendancePercent?.toFixed(1) || 0}%</span>
                      </div>
                      <Progress 
                        value={productivity?.attendance?.attendancePercent || 0} 
                        className="h-3"
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Orders Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Recent Orders</CardTitle>
                    <CardDescription>All orders in selected period</CardDescription>
                  </div>
                  <Badge variant="outline">{orders.length} orders</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Number</TableHead>
                      <TableHead>Product Type</TableHead>
                      <TableHead>Transaction Type</TableHead>
                      <TableHead>Process Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No orders found for this period
                        </TableCell>
                      </TableRow>
                    ) : (
                      orders.slice(0, 20).map((order: OrderSimple) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.fileNumber}</TableCell>
                          <TableCell>{order.productType || 'N/A'}</TableCell>
                          <TableCell>{order.transactionTypeName || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.processTypeName || 'N/A'}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={
                                order.orderStatusName?.toLowerCase() === 'completed' ? 'default' : 
                                order.orderStatusName?.toLowerCase() === 'in progress' ? 'secondary' : 
                                'outline'
                              }
                            >
                              {order.orderStatusName || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>{order.createdAt ? format(new Date(order.createdAt), 'MMM dd, yyyy') : 'N/A'}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                {orders.length > 20 && (
                  <div className="mt-4 text-center text-sm text-muted-foreground">
                    Showing 20 of {orders.length} orders
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

export default EmployeePerformancePage
