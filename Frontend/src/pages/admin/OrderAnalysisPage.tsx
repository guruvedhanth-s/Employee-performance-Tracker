import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card'
import { AdminNav } from '../../components/layout/AdminNav'
import { Input } from '../../components/ui/input'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  Plus,
  RefreshCw,
  DollarSign,
  Eye,
  Pencil,
  Filter
} from 'lucide-react'
import { ordersApi, teamsApi, referenceApi, metricsApi } from '../../services/api'
import { useAuthStore } from '../../store/authStore'
import { useDashboardFilterStore, getMonthOptions, getYearOptions } from '../../store/dashboardFilterStore'
import toast from 'react-hot-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog'

export const OrderAnalysisPage = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  
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
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState<string>('')
  const [selectedStatusId, setSelectedStatusId] = useState<string>('')
  const [billingStatusFilter, setBillingStatusFilter] = useState<string>('')
  const [stateFilter, setStateFilter] = useState<string>('')
  const [countyFilter, setCountyFilter] = useState<string>('')
  const [productFilter, setProductFilter] = useState<string>('')
  const [processTypeFilter, setProcessTypeFilter] = useState<string>('')
  const [startDateFilter, setStartDateFilter] = useState<string>('')
  const [endDateFilter, setEndDateFilter] = useState<string>('')
  
  // Pagination
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Selected orders for bulk actions
  const [selectedOrders, setSelectedOrders] = useState<number[]>([])
  const [orderDetailId, setOrderDetailId] = useState<number | null>(null)

  // Fetch dashboard stats
  const { data: stats } = useQuery({
    queryKey: ['dashboardStats', user?.orgId, selectedTeamId, filterMonth, filterYear],
    queryFn: () => metricsApi.getDashboardStats({ 
      orgId: user?.orgId || undefined,
      teamId: selectedTeamId ? parseInt(selectedTeamId) : undefined,
      month: parseInt(filterMonth),
      year: parseInt(filterYear),
    }),
  })

  // Fetch orders
  const { data: ordersData, isLoading: loadingOrders, refetch: refetchOrders } = useQuery({
    queryKey: ['orders', page, selectedTeamId, selectedStatusId, billingStatusFilter, stateFilter, startDateFilter, endDateFilter, user?.orgId],
    queryFn: () => ordersApi.list({
      orgId: user?.orgId || undefined,
      teamId: selectedTeamId ? parseInt(selectedTeamId) : undefined,
      orderStatusId: selectedStatusId ? parseInt(selectedStatusId) : undefined,
      billingStatus: billingStatusFilter as 'pending' | 'done' | undefined,
      state: stateFilter || undefined,
      startDate: startDateFilter || undefined,
      endDate: endDateFilter || undefined,
      page,
      pageSize,
    }),
  })

  // Fetch teams for filter
  // For superadmin, don't pass orgId to get all teams
  const { data: teamsData } = useQuery({
    queryKey: ['teams', user?.userRole === 'superadmin' ? 'all' : user?.orgId],
    queryFn: () => teamsApi.list({ 
      orgId: user?.userRole === 'superadmin' ? undefined : user?.orgId || undefined,
      isActive: true
    }),
  })

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

  // Fetch single order details
  const { data: orderDetail, isLoading: loadingOrderDetail } = useQuery({
    queryKey: ['order', orderDetailId],
    queryFn: () => ordersApi.get(orderDetailId!),
    enabled: !!orderDetailId,
  })

  // Bulk billing status update
  const bulkBillingMutation = useMutation({
    mutationFn: ({ orderIds, status }: { orderIds: number[]; status: 'pending' | 'done' }) =>
      ordersApi.bulkUpdateBillingStatus(orderIds, status),
    onSuccess: () => {
      toast.success('Billing status updated')
      setSelectedOrders([])
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update billing status')
    },
  })

  const orders = ordersData?.items || []
  const totalOrders = ordersData?.total || 0
  const totalPages = Math.ceil(totalOrders / pageSize)

  // Extract unique values for filter dropdowns
  const uniqueStates = [...new Set(orders.map(o => o.state))].filter(Boolean).sort()
  const uniqueCounties = [...new Set(orders.map(o => o.county))].filter(Boolean).sort()
  const uniqueProducts = [...new Set(orders.map(o => o.productType))].filter(Boolean).sort()

  // Filter orders by search query and client-side filters
  const filteredOrders = orders.filter(order => {
    // Search filter
    if (searchQuery) {
      const searchLower = searchQuery.toLowerCase()
      const matchesSearch = (
        order.fileNumber.toLowerCase().includes(searchLower) ||
        order.state.toLowerCase().includes(searchLower) ||
        order.county.toLowerCase().includes(searchLower) ||
        (order.orderStatusName?.toLowerCase().includes(searchLower)) ||
        order.productType.toLowerCase().includes(searchLower)
      )
      if (!matchesSearch) return false
    }
    
    // County filter (client-side)
    if (countyFilter && order.county !== countyFilter) return false
    
    // Product filter (client-side)
    if (productFilter && order.productType !== productFilter) return false
    
    // Process Type filter (client-side)
    if (processTypeFilter && order.processTypeName !== processTypeFilter) return false
    
    return true
  })

  const getStatusBadge = (status: string | null) => {
    if (!status) return 'bg-gray-100 text-gray-800 border-gray-300'
    const statusStyles: { [key: string]: string } = {
      'Completed': 'bg-green-100 text-green-800 border-green-300',
      'On-hold': 'bg-orange-100 text-orange-800 border-orange-300',
      'BP and RTI': 'bg-purple-100 text-purple-800 border-purple-300',
    }
    return statusStyles[status] || 'bg-gray-100 text-gray-800 border-gray-300'
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const toggleOrderSelection = (orderId: number) => {
    setSelectedOrders(prev =>
      prev.includes(orderId)
        ? prev.filter(id => id !== orderId)
        : [...prev, orderId]
    )
  }

  const toggleAllOrders = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([])
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id))
    }
  }

  const handleBulkBillingUpdate = (status: 'pending' | 'done') => {
    if (selectedOrders.length === 0) {
      toast.error('Please select orders first')
      return
    }
    bulkBillingMutation.mutate({ orderIds: selectedOrders, status })
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Order Management</h1>
              <p className="text-sm text-slate-600">View and manage all orders</p>
            </div>
            {user?.userRole !== 'superadmin' && (
              <Button onClick={() => navigate('/employee/new-order')}>
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Button>
            )}
          </div>
        </div>
      </header>
      
      <AdminNav />
      
      <main className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid gap-6 md:grid-cols-5 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Total Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-blue-500" />
                {stats?.totalOrders || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Completed</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                {stats?.ordersCompleted || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">On Hold</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 flex items-center gap-2">
                <Clock className="h-5 w-5" />
                {stats?.ordersOnHold || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">BP & RTI</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                {stats?.ordersBpRti || 0}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">Pending Billing</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600 flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {stats?.ordersPendingBilling || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Filters</CardTitle>
              {/* Month/Year filters */}
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
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Row 1: Search and primary filters */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="relative md:col-span-2">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by file number, state, county..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              <Select value={selectedTeamId || 'all'} onValueChange={(val) => setSelectedTeamId(val === 'all' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teamsData?.items?.map(team => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatusId || 'all'} onValueChange={(val) => setSelectedStatusId(val === 'all' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {orderStatuses?.filter(s => s.isActive).map(status => (
                    <SelectItem key={status.id} value={status.id.toString()}>
                      {status.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={billingStatusFilter || 'all'} onValueChange={(val) => setBillingStatusFilter(val === 'all' ? '' : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Billing Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Billing</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="done">Done</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Row 2: Column-specific filters */}
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
              {/* Entry Date Range */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">Start Date</label>
                <Input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => setStartDateFilter(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">End Date</label>
                <Input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => setEndDateFilter(e.target.value)}
                  className="h-9"
                />
              </div>

              {/* State Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">State</label>
                <Select value={stateFilter || 'all'} onValueChange={(val) => setStateFilter(val === 'all' ? '' : val)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All States" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All States</SelectItem>
                    {uniqueStates.map(state => (
                      <SelectItem key={state} value={state}>
                        {state}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* County Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">County</label>
                <Select value={countyFilter || 'all'} onValueChange={(val) => setCountyFilter(val === 'all' ? '' : val)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Counties" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Counties</SelectItem>
                    {uniqueCounties.map(county => (
                      <SelectItem key={county} value={county}>
                        {county}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Product Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">Product</label>
                <Select value={productFilter || 'all'} onValueChange={(val) => setProductFilter(val === 'all' ? '' : val)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Products" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Products</SelectItem>
                    {uniqueProducts.map(product => (
                      <SelectItem key={product} value={product}>
                        {product}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Process Type Filter */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-slate-500 font-medium">Process</label>
                <Select value={processTypeFilter || 'all'} onValueChange={(val) => setProcessTypeFilter(val === 'all' ? '' : val)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Process" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Process</SelectItem>
                    {processTypes?.filter(p => p.isActive).map(process => (
                      <SelectItem key={process.id} value={process.name}>
                        {process.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Clear Filters Button */}
            {(searchQuery || selectedTeamId || selectedStatusId || billingStatusFilter || stateFilter || countyFilter || productFilter || processTypeFilter || startDateFilter || endDateFilter) && (
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSearchQuery('')
                    setSelectedTeamId('')
                    setSelectedStatusId('')
                    setBillingStatusFilter('')
                    setStateFilter('')
                    setCountyFilter('')
                    setProductFilter('')
                    setProcessTypeFilter('')
                    setStartDateFilter('')
                    setEndDateFilter('')
                  }}
                >
                  Clear All Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedOrders.length > 0 && (
          <Card className="mb-4 border-blue-200 bg-blue-50">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {selectedOrders.length} order(s) selected
                </span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkBillingUpdate('done')}
                    disabled={bulkBillingMutation.isPending}
                  >
                    <DollarSign className="mr-1 h-4 w-4" />
                    Mark Billing Done
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkBillingUpdate('pending')}
                    disabled={bulkBillingMutation.isPending}
                  >
                    Mark Billing Pending
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedOrders([])}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Orders Table */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Orders</CardTitle>
              <CardDescription>
                Showing {filteredOrders.length} of {totalOrders} orders
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchOrders()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {loadingOrders ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                          onChange={toggleAllOrders}
                          className="rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>File Number</TableHead>
                      <TableHead>Entry Date</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>County</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Division</TableHead>
                      <TableHead>Process</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={11} className="text-center py-8 text-gray-500">
                          No orders found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              checked={selectedOrders.includes(order.id)}
                              onChange={() => toggleOrderSelection(order.id)}
                              className="rounded border-gray-300"
                            />
                          </TableCell>
                          <TableCell className="font-medium">{order.fileNumber}</TableCell>
                          <TableCell>{formatDate(order.entryDate)}</TableCell>
                          <TableCell>{order.state}</TableCell>
                          <TableCell>{order.county}</TableCell>
                          <TableCell className="text-xs">{order.productType}</TableCell>
                          <TableCell className="text-xs">{order.divisionName || '-'}</TableCell>
                          <TableCell className="text-xs">{order.processTypeName || '-'}</TableCell>
                          <TableCell>
                            <Badge className={getStatusBadge(order.orderStatusName)}>
                              {order.orderStatusName || 'Unknown'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={order.billingStatus === 'done' ? 'default' : 'secondary'}>
                              {order.billingStatus}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => navigate(`/employee/edit-order/${order.id}`)}
                                title="Edit Order"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Dialog>
                                <DialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setOrderDetailId(order.id)}
                                    title="View Details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </DialogTrigger>
                                <DialogContent className="max-w-2xl">
                                  <DialogHeader>
                                    <DialogTitle>Order Details - {order.fileNumber}</DialogTitle>
                                    <DialogDescription>
                                      View order details and step information
                                    </DialogDescription>
                                  </DialogHeader>
                                  {loadingOrderDetail ? (
                                    <div className="flex items-center justify-center py-8">
                                      <Loader2 className="h-6 w-6 animate-spin" />
                                    </div>
                                  ) : orderDetail ? (
                                    <div className="space-y-6">
                                      {/* Order Info */}
                                      <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                          <span className="text-gray-500">File Number:</span>
                                          <span className="ml-2 font-medium">{orderDetail.fileNumber}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Entry Date:</span>
                                          <span className="ml-2">{formatDate(orderDetail.entryDate)}</span>
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
                                          <span className="text-gray-500">Division:</span>
                                          <span className="ml-2">{orderDetail.division?.name || '-'}</span>
                                        </div>
                                        <div>
                                          <span className="text-gray-500">Status:</span>
                                          <Badge className={`ml-2 ${getStatusBadge(orderDetail.orderStatus?.name || null)}`}>
                                            {orderDetail.orderStatus?.name || 'Unknown'}
                                          </Badge>
                                        </div>
                                      </div>

                                      {/* Step 1 Info */}
                                      <div className="border rounded-lg p-4 bg-blue-50/50">
                                        <h4 className="font-medium text-blue-900 mb-3">Step 1</h4>
                                        <div className="grid grid-cols-1 gap-2 text-sm">
                                          <div>
                                            <span className="text-gray-500">User:</span>
                                            <span className="ml-2">{orderDetail.step1?.userName || 'Not assigned'}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Start:</span>
                                            <span className="ml-2">{orderDetail.step1?.startTime ? formatDate(orderDetail.step1.startTime) : '-'}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">End:</span>
                                            <span className="ml-2">{orderDetail.step1?.endTime ? formatDate(orderDetail.step1.endTime) : '-'}</span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Step 2 Info */}
                                      <div className="border rounded-lg p-4 bg-green-50/50">
                                        <h4 className="font-medium text-green-900 mb-3">Step 2</h4>
                                        <div className="grid grid-cols-1 gap-2 text-sm">
                                          <div>
                                            <span className="text-gray-500">User:</span>
                                            <span className="ml-2">{orderDetail.step2?.userName || 'Not assigned'}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">Start:</span>
                                            <span className="ml-2">{orderDetail.step2?.startTime ? formatDate(orderDetail.step2.startTime) : '-'}</span>
                                          </div>
                                          <div>
                                            <span className="text-gray-500">End:</span>
                                            <span className="ml-2">{orderDetail.step2?.endTime ? formatDate(orderDetail.step2.endTime) : '-'}</span>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ) : null}
                                </DialogContent>
                              </Dialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-sm text-gray-500">
                      Page {page} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default OrderAnalysisPage
