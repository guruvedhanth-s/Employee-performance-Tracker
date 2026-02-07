import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { useTeamLeadFilterStore } from '../../store/teamLeadFilterStore'
import { teamsApi, ordersApi, referenceApi } from '../../services/api'
import type { OrderSimple, ProcessType, Division, OrderStatus } from '../../types'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { TeamLeadNav } from '../../components/layout/TeamLeadNav'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu'
import { 
  FileText, 
  CheckCircle2,
  Clock,
  AlertCircle,
  Settings,
  LogOut,
  Loader2,
  Users,
  Shield,
  Plus,
  Edit,
  Filter,
  Calendar,
  RotateCcw,
  Download
} from 'lucide-react'

export const TeamOrdersPage = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { selectedTeamId, setSelectedTeamId } = useTeamLeadFilterStore()
  
  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [billingFilter, setBillingFilter] = useState<string>('all')
  const [stateFilter, setStateFilter] = useState<string>('all')
  const [processTypeFilter, setProcessTypeFilter] = useState<string>('all')
  const [divisionFilter, setDivisionFilter] = useState<string>('all')
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all')
  const [faNameFilter, setFaNameFilter] = useState<string>('all')
  
  // Date range - default to current month
  const today = new Date()
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  const [startDate, setStartDate] = useState<string>(firstDayOfMonth.toISOString().split('T')[0])
  const [endDate, setEndDate] = useState<string>(lastDayOfMonth.toISOString().split('T')[0])
  
  // Show/hide filter panel
  const [showFilters, setShowFilters] = useState<boolean>(true)

  // Redirect if not team lead
  if (!user || user.userRole !== 'team_lead') {
    navigate('/login')
    return null
  }

  // Get all teams the team lead manages
  const { data: teamsData, isLoading: _loadingTeams } = useQuery({
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

  // Fetch reference data for filters
  const { data: processTypes = [] } = useQuery<ProcessType[]>({
    queryKey: ['process-types'],
    queryFn: referenceApi.getProcessTypes,
  })

  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ['divisions'],
    queryFn: referenceApi.getDivisions,
  })

  const { data: orderStatuses = [] } = useQuery<OrderStatus[]>({
    queryKey: ['order-statuses'],
    queryFn: referenceApi.getOrderStatuses,
  })

  // Get unique states from current team
  const availableStates = currentTeam?.states || []

  // Fetch fake names for the team
  const { data: faNamesData, isLoading: faNamesLoading } = useQuery({
    queryKey: ['faNames', teamId],
    queryFn: () => teamsApi.getFakeNames(teamId!),
    enabled: !!teamId,
    staleTime: 10 * 60 * 1000, // 10 minutes
  })

  const faNames = faNamesData?.items || []

  // Fetch team orders
  const { data: ordersData, isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', 'team', teamId, startDate, endDate, statusFilter, billingFilter, stateFilter, processTypeFilter, divisionFilter, orderStatusFilter, faNameFilter],
    queryFn: () => ordersApi.list({
      teamId: teamId!,
      startDate,
      endDate,
      billingStatus: billingFilter !== 'all' ? (billingFilter as 'pending' | 'done') : undefined,
      state: stateFilter !== 'all' ? stateFilter : undefined,
      processTypeId: processTypeFilter !== 'all' ? parseInt(processTypeFilter) : undefined,
      divisionId: divisionFilter !== 'all' ? parseInt(divisionFilter) : undefined,
      orderStatusId: orderStatusFilter !== 'all' ? parseInt(orderStatusFilter) : undefined,
      faName: faNameFilter !== 'all' ? faNameFilter : undefined,
      pageSize: 10000, // Increased to fetch more orders
    }),
    enabled: !!teamId,
  })

  const orders = ordersData?.items || []

  // Filter orders based on work status (completed/in-progress/pending based on step assignments)
  const filteredOrders = orders.filter(order => {
    if (statusFilter === 'all') return true
    if (statusFilter === 'completed') return order.step1UserId && order.step2UserId
    if (statusFilter === 'in_progress') return (order.step1UserId && !order.step2UserId) || (!order.step1UserId && order.step2UserId)
    if (statusFilter === 'pending') return !order.step1UserId && !order.step2UserId
    return true
  })

  // Stats
  const completedOrders = orders.filter(o => o.step1UserId && o.step2UserId).length
  const inProgressOrders = orders.filter(o => (o.step1UserId && !o.step2UserId) || (!o.step1UserId && o.step2UserId)).length
  const pendingBilling = orders.filter(o => o.billingStatus === 'pending').length

  const handleLogout = () => {
    logout()
    navigate('/login')
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

  const getOrderStatusBadge = (order: OrderSimple) => {
    if (order.step1UserId && order.step2UserId) {
      return <Badge className="bg-green-100 text-green-800">Completed</Badge>
    } else if (order.step1UserId || order.step2UserId) {
      return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>
    }
    return <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
  }

  const getBillingBadge = (status: string) => {
    if (status === 'done') {
      return <Badge className="bg-green-100 text-green-800">Done</Badge>
    }
    return <Badge variant="outline" className="text-orange-600 border-orange-300">Pending</Badge>
  }

  // Reset all filters
  const resetFilters = () => {
    const now = new Date()
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    setStatusFilter('all')
    setBillingFilter('all')
    setStateFilter('all')
    setProcessTypeFilter('all')
    setDivisionFilter('all')
    setOrderStatusFilter('all')
    setFaNameFilter('all')
    setStartDate(firstDay.toISOString().split('T')[0])
    setEndDate(lastDay.toISOString().split('T')[0])
  }

  // Export to Excel with full order details
  const handleExportToExcel = async () => {
    if (filteredOrders.length === 0) {
      toast.error('No orders to export')
      return
    }

    const loadingToast = toast.loading(`Fetching detailed order information for ${filteredOrders.length} orders...`)

    try {
      // Fetch full order details for all filtered orders
      const orderDetailsPromises = filteredOrders.map(order => ordersApi.get(order.id))
      const fullOrders = await Promise.all(orderDetailsPromises)

      // Prepare data for export with complete details
      const exportData = fullOrders.map((order) => {
        // Format timestamps
        const formatDateTime = (dateStr: string | null) => {
          if (!dateStr) return '-'
          const date = new Date(dateStr)
          return date.toLocaleString('en-US', { 
            month: 'short', 
            day: 'numeric', 
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })
        }

        return {
          'File Number': order.fileNumber,
          'Entry Date': new Date(order.entryDate).toLocaleDateString(),
          'State': order.state,
          'County': order.county,
          'Product Type': order.productType,
          'Transaction Type': order.transactionType?.name || '-',
          'Process Type': order.processType?.name || '-',
          'Division': order.division?.name || '-',
          'Order Status': order.orderStatus?.name || '-',
          'Billing Status': order.billingStatus === 'done' ? 'Done' : 'Pending',
          'Work Status': order.step1?.userId && order.step2?.userId ? 'Completed' : 
                         (order.step1?.userId || order.step2?.userId) ? 'In Progress' : 'Pending',
          'Step 1 User': order.step1?.userName || '-',
          'Step 1 Fake Name': order.step1?.faName || '-',
          'Step 1 Start Time': formatDateTime(order.step1?.startTime || null),
          'Step 1 End Time': formatDateTime(order.step1?.endTime || null),
          'Step 2 User': order.step2?.userName || '-',
          'Step 2 Fake Name': order.step2?.faName || '-',
          'Step 2 Start Time': formatDateTime(order.step2?.startTime || null),
          'Step 2 End Time': formatDateTime(order.step2?.endTime || null),
          'Created At': formatDateTime(order.createdAt),
          'Modified At': formatDateTime(order.modifiedAt),
        }
      })

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(exportData)

      // Set column widths
      const colWidths = [
        { wch: 15 }, // File Number
        { wch: 12 }, // Entry Date
        { wch: 10 }, // State
        { wch: 15 }, // County
        { wch: 20 }, // Product Type
        { wch: 18 }, // Transaction Type
        { wch: 15 }, // Process Type
        { wch: 15 }, // Division
        { wch: 15 }, // Order Status
        { wch: 15 }, // Billing Status
        { wch: 15 }, // Work Status
        { wch: 15 }, // Step 1 User
        { wch: 15 }, // Step 1 Fake Name
        { wch: 20 }, // Step 1 Start Time
        { wch: 20 }, // Step 1 End Time
        { wch: 15 }, // Step 2 User
        { wch: 15 }, // Step 2 Fake Name
        { wch: 20 }, // Step 2 Start Time
        { wch: 20 }, // Step 2 End Time
        { wch: 20 }, // Created At
        { wch: 20 }, // Modified At
      ]
      ws['!cols'] = colWidths

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Orders')

      // Generate filename
      const teamName = currentTeam?.name || 'Team'
      const dateRange = `${startDate}_to_${endDate}`
      const filename = `${teamName}_Orders_${dateRange}.xlsx`

      // Save file
      XLSX.writeFile(wb, filename)
      
      toast.dismiss(loadingToast)
      toast.success(`Exported ${fullOrders.length} orders with complete details to Excel`)
    } catch (error) {
      console.error('Export error:', error)
      toast.dismiss(loadingToast)
      toast.error('Failed to export orders. Please try again.')
    }
  }

  // Format date range for display
  const formatDateRange = () => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
  }

  // Count active filters
  const activeFilterCount = [
    statusFilter !== 'all',
    billingFilter !== 'all',
    stateFilter !== 'all',
    processTypeFilter !== 'all',
    divisionFilter !== 'all',
    orderStatusFilter !== 'all',
    faNameFilter !== 'all',
  ].filter(Boolean).length

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Team Orders</h1>
              <p className="text-sm text-slate-600">
                {formatDateRange()}
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
              
              <Button onClick={() => navigate('/employee/new-order')}>
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
              
              <Badge variant="outline" className="px-3 py-1">
                <Shield className="w-3 h-3 mr-1" />
                Team Lead
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
        {loadingOrders ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !teamId ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">You are not currently leading any team.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Total Orders
                  </CardTitle>
                  <FileText className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{orders.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Completed
                  </CardTitle>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{completedOrders}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    In Progress
                  </CardTitle>
                  <Clock className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{inProgressOrders}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Pending Billing
                  </CardTitle>
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{pendingBilling}</div>
                </CardContent>
              </Card>
            </div>

            {/* Filters and Orders Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Orders</CardTitle>
                    <CardDescription>Showing {filteredOrders.length} of {ordersData?.total || orders.length} orders</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => refetchOrders()}
                      disabled={loadingOrders}
                    >
                      <RotateCcw className={`h-4 w-4 mr-2 ${loadingOrders ? 'animate-spin' : ''}`} />
                      Refresh
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleExportToExcel}
                      disabled={filteredOrders.length === 0}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export to Excel
                    </Button>
                    <Button
                      variant={showFilters ? "default" : "outline"}
                      size="sm"
                      onClick={() => setShowFilters(!showFilters)}
                    >
                      <Filter className="h-4 w-4 mr-2" />
                      Filters
                      {activeFilterCount > 0 && (
                        <Badge variant="secondary" className="ml-2 bg-white text-primary">
                          {activeFilterCount}
                        </Badge>
                      )}
                    </Button>
                    {activeFilterCount > 0 && (
                      <Button variant="ghost" size="sm" onClick={resetFilters}>
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Reset
                      </Button>
                    )}
                  </div>
                </div>

                {/* Comprehensive Filters Panel */}
                {showFilters && (
                  <div className="mt-4 pt-4 border-t">
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                      {/* Date Range */}
                      <div className="space-y-2">
                        <Label htmlFor="startDate" className="text-xs font-medium text-slate-600">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          From Date
                        </Label>
                        <Input
                          id="startDate"
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="h-9"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="endDate" className="text-xs font-medium text-slate-600">
                          <Calendar className="h-3 w-3 inline mr-1" />
                          To Date
                        </Label>
                        <Input
                          id="endDate"
                          type="date"
                          value={endDate}
                          onChange={(e) => setEndDate(e.target.value)}
                          className="h-9"
                        />
                      </div>

                      {/* Work Status Filter */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Work Status</Label>
                        <Select value={statusFilter} onValueChange={setStatusFilter}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Billing Filter */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Billing Status</Label>
                        <Select value={billingFilter} onValueChange={setBillingFilter}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All Billing" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Billing</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* State Filter */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">State</Label>
                        <Select value={stateFilter} onValueChange={setStateFilter}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All States" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All States</SelectItem>
                            {availableStates.map((stateObj) => (
                              <SelectItem key={stateObj.id} value={stateObj.state}>
                                {stateObj.state}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Process Type Filter */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Process Type</Label>
                        <Select value={processTypeFilter} onValueChange={setProcessTypeFilter}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All Process Types" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Process Types</SelectItem>
                            {processTypes.filter(pt => pt.isActive).map((pt) => (
                              <SelectItem key={pt.id} value={pt.id.toString()}>
                                {pt.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Division Filter */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Division</Label>
                        <Select value={divisionFilter} onValueChange={setDivisionFilter}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All Divisions" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Divisions</SelectItem>
                            {divisions.map((div) => (
                              <SelectItem key={div.id} value={div.id.toString()}>
                                {div.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Order Status Filter */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">Order Status</Label>
                        <Select value={orderStatusFilter} onValueChange={setOrderStatusFilter}>
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All Order Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Order Status</SelectItem>
                            {orderStatuses.filter(os => os.isActive).map((os) => (
                              <SelectItem key={os.id} value={os.id.toString()}>
                                {os.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* FA Name Filter */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-600">FA Name</Label>
                        <Select 
                          value={faNameFilter} 
                          onValueChange={setFaNameFilter}
                          disabled={faNamesLoading}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="All FA Names" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All FA Names</SelectItem>
                            {faNames.map((fn) => (
                              <SelectItem key={fn.id} value={fn.faName}>
                                {fn.faName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>File Number</TableHead>
                      <TableHead>Entry Date</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>County</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No orders found for the selected filters</p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((order: OrderSimple) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium font-mono">
                            {order.fileNumber}
                          </TableCell>
                          <TableCell>
                            {new Date(order.entryDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.state}</Badge>
                          </TableCell>
                          <TableCell>{order.county}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">{order.productType}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{order.divisionName || '-'}</Badge>
                          </TableCell>
                          <TableCell>
                            {getOrderStatusBadge(order)}
                          </TableCell>
                          <TableCell>
                            {getBillingBadge(order.billingStatus)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/employee/edit-order/${order.id}`)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
                
                {/* Pagination info */}
                {ordersData && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <p className="text-sm text-muted-foreground">
                      Showing {filteredOrders.length} of {orders.length} orders
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Total: {ordersData.total} orders
                    </p>
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

export default TeamOrdersPage
