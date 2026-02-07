import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { ordersApi, usersApi, referenceApi, qualityAuditApi, productivityApi, teamsApi } from '../../services/api'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { ChangePasswordDialog } from '../../components/common/ChangePasswordDialog'
import { 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  LogOut,
  Plus,
  FileText,
  Activity,
  Pencil,
  Eye,
  Search,
  Filter,
  Loader2,
  Calendar,
  ClipboardCheck,
  Award,
  Lock
} from 'lucide-react'

export const EmployeeDashboard = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [selectedStatusId, setSelectedStatusId] = useState<string>('')
  const [selectedProcessTypeId, setSelectedProcessTypeId] = useState<string>('')
  const [selectedDivisionId, setSelectedDivisionId] = useState<string>('')
  const [selectedFakeName, setSelectedFakeName] = useState<string>('')
  const [fromDate, setFromDate] = useState<string>('')
  const [toDate, setToDate] = useState<string>('')
  const [orderDetailId, setOrderDetailId] = useState<number | null>(null)

  // Productivity week filter state (separate from main date filters)
  const [productivityWeek, setProductivityWeek] = useState<'current' | 'previous'>('current')
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)
  
  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Calculate week boundaries for productivity (Sunday to Saturday)
  const productivityWeekDates = useMemo(() => {
    const today = new Date()
    const dayOfWeek = today.getDay() // 0 = Sunday
    
    // Calculate current week's Sunday
    const currentSunday = new Date(today)
    currentSunday.setDate(today.getDate() - dayOfWeek)
    currentSunday.setHours(0, 0, 0, 0)
    
    // Calculate current week's Saturday
    const currentSaturday = new Date(currentSunday)
    currentSaturday.setDate(currentSunday.getDate() + 6)
    
    // Calculate previous week's Sunday and Saturday
    const previousSunday = new Date(currentSunday)
    previousSunday.setDate(currentSunday.getDate() - 7)
    
    const previousSaturday = new Date(previousSunday)
    previousSaturday.setDate(previousSunday.getDate() + 6)
    
    if (productivityWeek === 'current') {
      return {
        startDate: formatDateLocal(currentSunday),
        endDate: formatDateLocal(currentSaturday),
        label: 'Current Week'
      }
    } else {
      return {
        startDate: formatDateLocal(previousSunday),
        endDate: formatDateLocal(previousSaturday),
        label: 'Previous Week'
      }
    }
  }, [productivityWeek])

  // Use React Query for caching recent orders with filters
  // Now fetches user's orders (where they worked on step1 OR step2)
  const { data: ordersData, isLoading: loadingOrders } = useQuery({
    queryKey: ['orders', 'my', user?.id, selectedTeamId, selectedStatusId, selectedProcessTypeId, selectedDivisionId, selectedFakeName, fromDate, toDate],
    queryFn: () => ordersApi.list({ 
      // Filter by orders where user worked on step1 OR step2
      myOrders: true,
      teamId: selectedTeamId ? parseInt(selectedTeamId) : undefined,
      orderStatusId: selectedStatusId ? parseInt(selectedStatusId) : undefined,
      processTypeId: selectedProcessTypeId ? parseInt(selectedProcessTypeId) : undefined,
      divisionId: selectedDivisionId ? parseInt(selectedDivisionId) : undefined,
      faName: selectedFakeName || undefined,
      startDate: fromDate || undefined,
      endDate: toDate || undefined,
      pageSize: 100 
    }),
    enabled: !!user && user.userRole === 'employee',
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Fetch user profile to get their team memberships
  const { data: userProfile } = useQuery({
    queryKey: ['userProfile', user?.id],
    queryFn: () => usersApi.get(user!.id),
    enabled: !!user,
  })

  // Fetch quality audits for the current user
  const { data: qualityAuditsData } = useQuery({
    queryKey: ['qualityAudits', user?.id, fromDate, toDate],
    queryFn: () => qualityAuditApi.list({
      examinerId: user!.id,
      startDate: fromDate || undefined,
      endDate: toDate || undefined,
    }),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Get user's active teams (where membership is active AND team is active)
  const userTeams = useMemo(() => {
    if (!userProfile?.teams) return []
    return userProfile.teams
      .filter(t => t.isActive && t.teamIsActive)
      .map(t => ({ id: t.teamId, name: t.teamName }))
  }, [userProfile])

  // Fetch order statuses for filter
  const { data: orderStatuses } = useQuery({
    queryKey: ['orderStatuses'],
    queryFn: referenceApi.getOrderStatuses,
  })

  // Fetch process types for filter
  const { data: processTypes } = useQuery({
    queryKey: ['processTypes'],
    queryFn: referenceApi.getProcessTypes,
  })

  // Fetch divisions for filter
  const { data: divisions } = useQuery({
    queryKey: ['divisions'],
    queryFn: referenceApi.getDivisions,
  })

  // Fetch fake names for selected team
  const { data: faNamesData } = useQuery({
    queryKey: ['faNames', selectedTeamId],
    queryFn: () => teamsApi.getFakeNames(parseInt(selectedTeamId)),
    enabled: !!selectedTeamId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  const faNames = faNamesData?.items || []

  // Fetch single order details
  const { data: orderDetail, isLoading: loadingOrderDetail } = useQuery({
    queryKey: ['order', orderDetailId],
    queryFn: () => ordersApi.get(orderDetailId!),
    enabled: !!orderDetailId,
  })

  // Filter orders by search query (client-side)
  const recentOrders = (ordersData?.items || []).filter(order => {
    if (!searchQuery) return true
    const searchLower = searchQuery.toLowerCase()
    return (
      order.fileNumber.toLowerCase().includes(searchLower) ||
      order.state.toLowerCase().includes(searchLower) ||
      order.county.toLowerCase().includes(searchLower) ||
      (order.orderStatusName?.toLowerCase().includes(searchLower))
    )
  })

  // Calculate stats from filtered orders
  const calculatedStats = {
    totalOrders: recentOrders.length,
    ordersCompleted: recentOrders.filter(o => o.orderStatusName === 'Completed').length,
    ordersOnHold: recentOrders.filter(o => o.orderStatusName === 'On-hold').length,
    ordersBpRti: recentOrders.filter(o => o.orderStatusName === 'BP and RTI').length,
  }

  // Fetch productivity data from backend API (aggregated across all teams)
  // Uses the separate week filter for the productivity card
  const { data: productivityData, isLoading: loadingProductivity } = useQuery({
    queryKey: ['myProductivity', productivityWeekDates.startDate, productivityWeekDates.endDate],
    queryFn: () => productivityApi.getMyProductivity({
      startDate: productivityWeekDates.startDate,
      endDate: productivityWeekDates.endDate,
    }),
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Format productivity data for display (with fallback values)
  const formattedProductivityData = useMemo(() => {
    if (!productivityData) {
      return {
        totalMarks: 0,
        step1OnlyCount: 0,
        step2OnlyCount: 0,
        bothStepsCount: 0,
        workingDaysCount: 0,
        weeklyTarget: 0,
        expectedMarks: 0,
        productivityPercent: null as number | null,
        hasWeeklyTarget: false
      }
    }

    return {
      totalMarks: productivityData.scores.totalScore,
      step1OnlyCount: productivityData.completions.step1Only,
      step2OnlyCount: productivityData.completions.step2Only,
      bothStepsCount: productivityData.completions.singleSeat,
      workingDaysCount: productivityData.period.workingDays,
      weeklyTarget: productivityData.weeklyTarget ?? productivityData.expectedTarget,
      expectedMarks: productivityData.expectedTarget,
      productivityPercent: productivityData.productivityPercent,
      hasWeeklyTarget: productivityData.hasWeeklyTarget ?? (productivityData.expectedTarget > 0)
    }
  }, [productivityData])

  // Calculate quality metrics from quality audits
  const qualityMetrics = useMemo(() => {
    if (!qualityAuditsData?.items || qualityAuditsData.items.length === 0) {
      return {
        avgFbQuality: 0,
        avgOfeQuality: 0,
        avgCceQuality: 0,
        totalAudits: 0,
        totalFilesReviewed: 0,
        totalErrors: 0,
        hasData: false
      }
    }

    const audits = qualityAuditsData.items
    const totalAudits = audits.length
    
    let totalFbQuality = 0
    let totalOfeQuality = 0
    let totalCceQuality = 0
    let totalFilesReviewed = 0
    let totalErrors = 0

    audits.forEach(audit => {
      totalFbQuality += Number(audit.fbQuality)
      totalOfeQuality += Number(audit.ofeQuality)
      totalCceQuality += Number(audit.cceQuality)
      totalFilesReviewed += audit.totalFilesReviewed
      totalErrors += audit.totalErrors
    })

    return {
      avgFbQuality: (totalFbQuality / totalAudits) * 100,
      avgOfeQuality: (totalOfeQuality / totalAudits) * 100,
      avgCceQuality: (totalCceQuality / totalAudits) * 100,
      totalAudits,
      totalFilesReviewed,
      totalErrors,
      hasData: true
    }
  }, [qualityAuditsData])

  useEffect(() => {
    if (!user || user.userRole !== 'employee') {
      navigate('/login')
    }
  }, [user, navigate])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const statsCards = [
    { 
      title: 'Total Orders', 
      value: calculatedStats.totalOrders.toString(), 
      icon: FileText,
      color: 'text-blue-600'
    },
    { 
      title: 'Completed', 
      value: calculatedStats.ordersCompleted.toString(), 
      icon: CheckCircle2,
      color: 'text-green-600'
    },
    { 
      title: 'On Hold', 
      value: calculatedStats.ordersOnHold.toString(), 
      icon: Clock,
      color: 'text-orange-600'
    },
    { 
      title: 'BP & RTI', 
      value: calculatedStats.ordersBpRti.toString(), 
      icon: Activity,
      color: 'text-purple-600'
    },
  ]

  const getInitials = (name: string) => {
    if (!name) return '??'
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '-'
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return '-'
    
    // Format as local time (IST)
    return date.toLocaleString('en-IN', { 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatDateOnly = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusBadge = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-300'
    const statusStyles: { [key: string]: string } = {
      'Completed': 'bg-green-100 text-green-800 border-green-300',
      'On-hold': 'bg-orange-100 text-orange-800 border-orange-300',
      'BP and RTI': 'bg-purple-100 text-purple-800 border-purple-300',
    }
    return statusStyles[status] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const clearFilters = () => {
    setSearchQuery('')
    setSelectedTeamId('')
    setSelectedStatusId('')
    setSelectedProcessTypeId('')
    setSelectedDivisionId('')
    setSelectedFakeName('')
    // Reset to empty (no date filter)
    setFromDate('')
    setToDate('')
  }

  // Check if any filters are active (empty string is the default state now)
  const hasActiveFilters = searchQuery || selectedTeamId || selectedStatusId || selectedProcessTypeId || selectedDivisionId || selectedFakeName || fromDate || toDate

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Employee Dashboard</h1>
              <p className="text-sm text-slate-600">Welcome, {user?.userName}!</p>
            </div>
            
            <div className="flex items-center gap-4">
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

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Performance and Quality Reports - Compact Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Productivity Score Card - Compact */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 rounded-lg">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Productivity Score</CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Across all teams
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {/* Week Filter */}
                  <Select value={productivityWeek} onValueChange={(value: 'current' | 'previous') => setProductivityWeek(value)}>
                    <SelectTrigger className="h-7 w-[130px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="current">Current Week</SelectItem>
                      <SelectItem value="previous">Previous Week</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="text-right">
                    {loadingProductivity ? (
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    ) : formattedProductivityData.productivityPercent !== null ? (
                      <div className="text-2xl font-bold text-blue-600">
                        {formattedProductivityData.productivityPercent.toFixed(1)}%
                      </div>
                    ) : (
                      <div className="text-lg font-medium text-gray-500">
                        N/A
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingProductivity ? (
                <div className="space-y-3 animate-pulse">
                  <div className="w-full bg-gray-200 rounded-full h-2"></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-gray-100 rounded h-16"></div>
                    <div className="p-2 bg-gray-100 rounded h-16"></div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {/* Progress Bar or No Target Warning */}
                  {formattedProductivityData.productivityPercent !== null ? (
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          formattedProductivityData.productivityPercent >= 100 ? 'bg-green-500' :
                          formattedProductivityData.productivityPercent >= 80 ? 'bg-blue-500' :
                          formattedProductivityData.productivityPercent >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(formattedProductivityData.productivityPercent, 100)}%` }}
                      />
                    </div>
                  ) : (
                    <div className="text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded inline-block">
                      No target set - contact team lead
                    </div>
                  )}

                  {/* Compact Stats */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">Score Earned</p>
                      <p className="text-lg font-bold text-gray-900">{formattedProductivityData.totalMarks.toFixed(1)}</p>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                      <p className="text-xs text-gray-500">Target</p>
                      <p className="text-lg font-bold text-gray-900">
                        {formattedProductivityData.hasWeeklyTarget ? formattedProductivityData.expectedMarks : 'Not set'}
                      </p>
                    </div>
                  </div>

                  {/* Step Breakdown - Inline */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                      <span className="text-gray-600">Step 1: {formattedProductivityData.step1OnlyCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-gray-600">Step 2: {formattedProductivityData.step2OnlyCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                      <span className="text-gray-600">Both: {formattedProductivityData.bothStepsCount}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3 text-amber-600" />
                      <span className="text-gray-600">{formattedProductivityData.workingDaysCount} days</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quality Metrics Card - Compact */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-emerald-100 rounded-lg">
                  <Award className="h-4 w-4 text-emerald-600" />
                </div>
                <CardTitle className="text-sm font-semibold">Quality Performance</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {qualityMetrics.hasData ? (
                <div className="space-y-3">
                  {/* Quality Scores - Horizontal Layout */}
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 bg-emerald-50 rounded text-center">
                      <p className="text-xs text-emerald-600 font-medium">FB Quality</p>
                      <p className="text-xl font-bold text-emerald-700">{qualityMetrics.avgFbQuality.toFixed(1)}%</p>
                      <div className="w-full bg-emerald-200 rounded-full h-1 mt-1">
                        <div 
                          className="bg-emerald-600 h-1 rounded-full transition-all"
                          style={{ width: `${Math.min(qualityMetrics.avgFbQuality, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-2 bg-blue-50 rounded text-center">
                      <p className="text-xs text-blue-600 font-medium">OFE Quality</p>
                      <p className="text-xl font-bold text-blue-700">{qualityMetrics.avgOfeQuality.toFixed(1)}%</p>
                      <div className="w-full bg-blue-200 rounded-full h-1 mt-1">
                        <div 
                          className="bg-blue-600 h-1 rounded-full transition-all"
                          style={{ width: `${Math.min(qualityMetrics.avgOfeQuality, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="p-2 bg-purple-50 rounded text-center">
                      <p className="text-xs text-purple-600 font-medium">CCE Quality</p>
                      <p className="text-xl font-bold text-purple-700">{qualityMetrics.avgCceQuality.toFixed(1)}%</p>
                      <div className="w-full bg-purple-200 rounded-full h-1 mt-1">
                        <div 
                          className="bg-purple-600 h-1 rounded-full transition-all"
                          style={{ width: `${Math.min(qualityMetrics.avgCceQuality, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quality Stats - Compact */}
                  <div className="flex items-center justify-between text-xs pt-2 border-t">
                    <div className="text-center">
                      <p className="text-gray-500">Audits</p>
                      <p className="text-sm font-bold text-gray-900">{qualityMetrics.totalAudits}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Files</p>
                      <p className="text-sm font-bold text-gray-900">{qualityMetrics.totalFilesReviewed}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-gray-500">Errors</p>
                      <p className="text-sm font-bold text-gray-900">{qualityMetrics.totalErrors}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
                  <ClipboardCheck className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No quality data available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Stats Grid - Compact */}
        {loadingOrders ? (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i} className="animate-pulse shadow-sm">
                <CardContent className="p-3">
                  <div className="h-3 bg-slate-200 rounded w-16 mb-2"></div>
                  <div className="h-6 bg-slate-200 rounded w-10"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4 mb-6">
            {statsCards.map((stat, index) => (
              <Card key={index} className="shadow-sm hover:shadow-md transition-shadow">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-600">{stat.title}</p>
                    <stat.icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                  <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* My Orders Section - No Tabs */}
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold">My Orders</CardTitle>
                <CardDescription className="text-sm">View and manage your orders</CardDescription>
              </div>
              <Button onClick={() => navigate('/employee/new-order')} size="sm">
                <Plus className="mr-1 h-4 w-4" />
                New Order
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
                {/* Filters - Compact */}
                <div className="border rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <Filter className="h-4 w-4 text-gray-600" />
                    <span className="text-sm font-medium text-gray-700">Filters</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-9 gap-2">
                    {/* Search */}
                    <div className="md:col-span-2 relative">
                      <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        type="text"
                        placeholder="Search file number, state, county..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 h-9 text-sm"
                      />
                    </div>

                    {/* From Date */}
                    <div className="relative">
                      <Input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="h-9 text-sm"
                        title="From Date"
                      />
                    </div>

                    {/* To Date */}
                    <div className="relative">
                      <Input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="h-9 text-sm"
                        title="To Date"
                      />
                    </div>

                    {/* Team Filter */}
                    <Select value={selectedTeamId || 'all'} onValueChange={(val) => {
                      setSelectedTeamId(val === 'all' ? '' : val)
                      // Clear fake name filter when team changes
                      if (val === 'all' || val !== selectedTeamId) {
                        setSelectedFakeName('')
                      }
                    }}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All Teams" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-sm">All My Teams</SelectItem>
                        {userTeams.map(team => (
                          <SelectItem key={team.id} value={team.id.toString()} className="text-sm">
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Fake Name Filter - Only shown when team is selected */}
                    <Select 
                      value={selectedFakeName || 'all'} 
                      onValueChange={(val) => setSelectedFakeName(val === 'all' ? '' : val)}
                      disabled={!selectedTeamId}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All Fake Names" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-sm">All Fake Names</SelectItem>
                        {faNames.map((fn) => (
                          <SelectItem key={fn.id} value={fn.faName} className="text-sm">
                            {fn.faName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Status Filter */}
                    <Select value={selectedStatusId || 'all'} onValueChange={(val) => setSelectedStatusId(val === 'all' ? '' : val)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-sm">All Statuses</SelectItem>
                        {orderStatuses?.filter(s => s.isActive).map(status => (
                          <SelectItem key={status.id} value={status.id.toString()} className="text-sm">
                            {status.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Process Type Filter */}
                    <Select value={selectedProcessTypeId || 'all'} onValueChange={(val) => setSelectedProcessTypeId(val === 'all' ? '' : val)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All Process Types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-sm">All Process Types</SelectItem>
                        {processTypes?.filter(p => p.isActive).map(pt => (
                          <SelectItem key={pt.id} value={pt.id.toString()} className="text-sm">
                            {pt.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Division Filter */}
                    <Select value={selectedDivisionId || 'all'} onValueChange={(val) => setSelectedDivisionId(val === 'all' ? '' : val)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All Divisions" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-sm">All Divisions</SelectItem>
                        {divisions?.map(div => (
                          <SelectItem key={div.id} value={div.id.toString()} className="text-sm">
                            {div.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters */}
                  {hasActiveFilters && (
                    <div className="flex justify-end mt-2">
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs h-7">
                        Clear All Filters
                      </Button>
                    </div>
                  )}
                </div>

                {/* Results count */}
                <div className="flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-gray-500" />
                  <span className="text-xs font-medium text-gray-600">
                    Showing {recentOrders.length} orders
                  </span>
                </div>

                {/* Table - Compact */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead className="font-semibold text-xs h-10">File Number</TableHead>
                        <TableHead className="font-semibold text-xs h-10">Product Type</TableHead>
                        <TableHead className="font-semibold text-xs h-10">Division</TableHead>
                        <TableHead className="font-semibold text-xs h-10">County</TableHead>
                        <TableHead className="font-semibold text-xs h-10">State</TableHead>
                        <TableHead className="font-semibold text-xs h-10">Process</TableHead>
                        <TableHead className="font-semibold text-xs h-10">Status</TableHead>
                        <TableHead className="font-semibold text-xs h-10">Last Updated</TableHead>
                        <TableHead className="text-right font-semibold text-xs h-10">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {loadingOrders ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8">
                            <div className="flex items-center justify-center">
                              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : recentOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8">
                            <div className="flex flex-col items-center">
                              <FileText className="h-10 w-10 text-gray-300 mb-2" />
                              <p className="text-sm font-medium text-gray-500">No orders found</p>
                            </div>
                          </TableCell>
                        </TableRow>
                      ) : (
                        recentOrders.map((order) => (
                          <TableRow key={order.id} className="hover:bg-gray-50">
                            <TableCell className="font-medium text-sm py-3">{order.fileNumber}</TableCell>
                            <TableCell className="text-sm py-3">{order.productType || '-'}</TableCell>
                            <TableCell className="text-sm py-3">{order.divisionName || '-'}</TableCell>
                            <TableCell className="text-sm py-3">{order.county}</TableCell>
                            <TableCell className="text-sm py-3">{order.state}</TableCell>
                            <TableCell className="py-3">
                              <Badge variant="outline" className="text-xs px-2 py-0.5">
                                {order.processTypeName || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-3">
                              <Badge className={`${getStatusBadge(order.orderStatusName)} text-xs px-2 py-0.5`}>
                                {order.orderStatusName || 'Unknown'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-gray-600 py-3">{formatDate(order.modifiedAt)}</TableCell>
                            <TableCell className="text-right py-3">
                              <div className="flex justify-end gap-1">
                                <Dialog>
                                  <DialogTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setOrderDetailId(order.id)}
                                      title="View Details"
                                      className="h-7 px-2"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent className="max-w-2xl">
                                    <DialogHeader>
                                      <DialogTitle className="text-lg">Order Details - {order.fileNumber}</DialogTitle>
                                      <DialogDescription className="text-sm">
                                        View order details and step information
                                      </DialogDescription>
                                    </DialogHeader>
                                    {loadingOrderDetail ? (
                                      <div className="flex items-center justify-center py-8">
                                      <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                  ) : orderDetail ? (
                                    <div className="space-y-6">
                                      {/* Edit Permissions Banner */}
                                      {orderDetail.editPermissions && (
                                        <div className={`rounded-lg p-3 ${
                                          orderDetail.editPermissions.canEdit 
                                            ? 'bg-green-50 border border-green-200' 
                                            : 'bg-gray-50 border border-gray-200'
                                        }`}>
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              {orderDetail.editPermissions.canEdit ? (
                                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                                              ) : (
                                                <Clock className="h-4 w-4 text-gray-500" />
                                              )}
                                              <span className={`text-sm font-medium ${
                                                orderDetail.editPermissions.canEdit ? 'text-green-700' : 'text-gray-600'
                                              }`}>
                                                {orderDetail.editPermissions.reason}
                                              </span>
                                            </div>
                                            {orderDetail.editPermissions.canEdit && (
                                              <Button 
                                                size="sm" 
                                                onClick={() => navigate(`/employee/edit-order/${orderDetail.id}`)}
                                              >
                                                <Pencil className="h-3 w-3 mr-1" />
                                                Edit Order
                                              </Button>
                                            )}
                                          </div>
                                          {orderDetail.editPermissions.canEdit && (
                                            <div className="mt-2 flex gap-4 text-xs text-gray-600">
                                              {orderDetail.editPermissions.canEditStep1 && (
                                                <span className="flex items-center gap-1">
                                                  <CheckCircle2 className="h-3 w-3 text-blue-500" />
                                                  Can edit Step 1
                                                </span>
                                              )}
                                              {orderDetail.editPermissions.canEditStep2 && (
                                                <span className="flex items-center gap-1">
                                                  <CheckCircle2 className="h-3 w-3 text-green-500" />
                                                  Can edit Step 2
                                                </span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}

                                      {/* Order Info */}
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <span className="text-gray-500">File Number:</span>
                                          <span className="ml-2 font-medium">{orderDetail.fileNumber}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Entry Date:</span>
                                          <span className="ml-2">{formatDateOnly(orderDetail.entryDate)}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">State:</span>
                                          <span className="ml-2">{orderDetail.state}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">County:</span>
                                          <span className="ml-2">{orderDetail.county}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Product:</span>
                                          <span className="ml-2">{orderDetail.productType}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Status:</span>
                                          <Badge className={`ml-2 ${getStatusBadge(orderDetail.orderStatus?.name || null)}`}>
                                            {orderDetail.orderStatus?.name || 'Unknown'}
                                          </Badge>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Process Type:</span>
                                          <span className="ml-2">{orderDetail.processType?.name || '-'}</span>
                                        </div>
                                      </div>

                                      {/* Step 1 Info */}
                                      <div className={`border rounded-lg p-4 ${
                                        orderDetail.step1?.userId 
                                          ? 'bg-blue-50/50 border-blue-200' 
                                          : 'bg-gray-50/50 border-gray-200'
                                      }`}>
                                        <div className="flex items-center justify-between mb-3">
                                          <h4 className={`font-medium ${orderDetail.step1?.userId ? 'text-blue-900' : 'text-gray-600'}`}>
                                            Step 1
                                          </h4>
                                          {orderDetail.step1?.userId ? (
                                            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                                              <CheckCircle2 className="h-3 w-3 mr-1" />
                                              Completed
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="bg-gray-100 text-gray-600">
                                              Available
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 text-sm">
                                          <div>
                                            <span className="text-gray-500">User:</span>
                                            <span className="ml-2">{orderDetail.step1?.userName || 'Not assigned'}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Start:</span>
                                            <span className="ml-2">{orderDetail.step1?.startTime ? formatDateOnly(orderDetail.step1.startTime) : '-'}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">End:</span>
                                            <span className="ml-2">{orderDetail.step1?.endTime ? formatDateOnly(orderDetail.step1.endTime) : '-'}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Step 2 Info */}
                                      <div className={`border rounded-lg p-4 ${
                                        orderDetail.step2?.userId 
                                          ? 'bg-green-50/50 border-green-200' 
                                          : 'bg-gray-50/50 border-gray-200'
                                      }`}>
                                        <div className="flex items-center justify-between mb-3">
                                          <h4 className={`font-medium ${orderDetail.step2?.userId ? 'text-green-900' : 'text-gray-600'}`}>
                                            Step 2
                                          </h4>
                                          {orderDetail.step2?.userId ? (
                                            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                                              <CheckCircle2 className="h-3 w-3 mr-1" />
                                              Completed
                                            </Badge>
                                          ) : (
                                            <Badge variant="outline" className="bg-gray-100 text-gray-600">
                                              Available
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="grid grid-cols-1 gap-2 text-sm">
                                          <div>
                                            <span className="text-gray-500">User:</span>
                                            <span className="ml-2">{orderDetail.step2?.userName || 'Not assigned'}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Start:</span>
                                            <span className="ml-2">{orderDetail.step2?.startTime ? formatDateOnly(orderDetail.step2.startTime) : '-'}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">End:</span>
                                            <span className="ml-2">{orderDetail.step2?.endTime ? formatDateOnly(orderDetail.step2.endTime) : '-'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                ) : null}
                              </DialogContent>
                            </Dialog>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => navigate(`/employee/edit-order/${order.id}`)}
                              title="Edit Order"
                              className="h-7 px-2"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  )
}

export default EmployeeDashboard
