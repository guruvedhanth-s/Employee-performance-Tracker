import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useDashboardFilterStore, getMonthOptions, getYearOptions } from '../../store/dashboardFilterStore'
import { metricsApi, authApi, organizationsApi } from '../../services/api'
import { getInitials, handleLogoutFlow } from '../../utils/helpers'
import type { PasswordResetRequestItem } from '../../types'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { AdminNav } from '../../components/layout/AdminNav'
import { ChangePasswordDialog } from '../../components/common/ChangePasswordDialog'
import { 
  Users, 
  Target, 
  TrendingUp, 
  Calendar,
  Settings,
  LogOut,
  Activity,
  ClipboardList,
  Clock,
  FileText,
  Key,
  Loader2,
  X,
  Check,
  Lock,
  Filter
} from 'lucide-react'

export const AdminDashboard = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  
  // Get filter state from store
  const { filterMonth, filterYear, filterOrgId, setFilterMonth, setFilterYear, setFilterOrgId } = useDashboardFilterStore()
  
  // Determine which orgId to use:
  // - For admin: always use their own orgId
  // - For superadmin: use filterOrgId if set, otherwise undefined (all orgs)
  const effectiveOrgId = user?.userRole === 'superadmin'
    ? (filterOrgId ? parseInt(filterOrgId) : undefined)
    : (user?.orgId || undefined)

  const isSuperadmin = user?.userRole === 'superadmin'

  // Use React Query for caching dashboard data
  const { data: stats, isLoading: loading } = useQuery({
    queryKey: ['dashboard', 'admin', effectiveOrgId, filterMonth, filterYear],
    queryFn: () => metricsApi.getDashboardStats({
      orgId: effectiveOrgId,
      month: parseInt(filterMonth),
      year: parseInt(filterYear),
    }),
    enabled: !!user && ['admin', 'superadmin'].includes(user.userRole),
    staleTime: 1 * 60 * 1000, // 1 minute - refetch more frequently for accurate data,
  })

  // Fetch organizations for superadmin filter
  const { data: orgsData } = useQuery({
    queryKey: ['organizations', 'list', 'active'],
    queryFn: () => organizationsApi.list({ isActive: true }),
    enabled: isSuperadmin,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  // Password reset requests query
  const queryClient = useQueryClient()
  const { data: passwordResetRequests } = useQuery({
    queryKey: ['passwordResetRequests', 'pending'],
    queryFn: () => authApi.getPasswordResetRequests({ statusFilter: 'pending' }),
    enabled: !!user && ['admin', 'superadmin'].includes(user.userRole),
    staleTime: 2 * 60 * 1000, // 2 minutes
  })

  const pendingResetRequests = passwordResetRequests?.items || []

  // State for approve/reject dialogs
  const [approveDialogOpen, setApproveDialogOpen] = useState(false)
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<PasswordResetRequestItem | null>(null)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [dialogError, setDialogError] = useState('')
  const [changePasswordOpen, setChangePasswordOpen] = useState(false)

  const handleApproveRequest = async () => {
    if (!selectedRequest) return
    
    if (!newPassword) {
      setDialogError('New password is required')
      return
    }
    if (newPassword.length < 8) {
      setDialogError('Password must be at least 8 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      setDialogError('Passwords do not match')
      return
    }

    setDialogError('')
    setIsProcessing(true)

    try {
      await authApi.approvePasswordResetRequest(selectedRequest.id, newPassword)
      toast.success(`Password reset approved for ${selectedRequest.userName}`)
      setApproveDialogOpen(false)
      setSelectedRequest(null)
      setNewPassword('')
      setConfirmPassword('')
      queryClient.invalidateQueries({ queryKey: ['passwordResetRequests'] })
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to approve request'
      setDialogError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRejectRequest = async () => {
    if (!selectedRequest) return

    setDialogError('')
    setIsProcessing(true)

    try {
      await authApi.rejectPasswordResetRequest(selectedRequest.id, rejectionReason || undefined)
      toast.success('Password reset request rejected')
      setRejectDialogOpen(false)
      setSelectedRequest(null)
      setRejectionReason('')
      queryClient.invalidateQueries({ queryKey: ['passwordResetRequests'] })
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to reject request'
      setDialogError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsProcessing(false)
    }
  }

  useEffect(() => {
    if (!user || !['admin', 'superadmin'].includes(user.userRole)) {
      navigate('/login')
    }
  }, [user, navigate])

  const handleLogout = () => {
    handleLogoutFlow(logout, navigate)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
              <p className="text-sm text-slate-600 mt-1">Welcome back, {user?.userName}!</p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Filter Controls */}
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-slate-500" />
                
                {/* Organization Filter - Only for Superadmin */}
                {isSuperadmin && orgsData?.items && (
                  <Select 
                    value={filterOrgId || 'all'} 
                    onValueChange={(value) => setFilterOrgId(value === 'all' ? null : value)}
                  >
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue placeholder="Organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Organizations</SelectItem>
                      {orgsData.items.map((org) => (
                        <SelectItem key={org.id} value={String(org.id)}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                
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

      {/* Navigation Bar */}
      <AdminNav />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
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
            <Card 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/admin/employees')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Active Employees
                </CardTitle>
                <Users className="h-5 w-5 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats?.activeEmployees || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats?.totalEmployees || 0} total
                </p>
              </CardContent>
            </Card>

            <Card 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/admin/teams')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Active Teams
                </CardTitle>
                <Target className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats?.totalTeams || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Teams in organization
                </p>
              </CardContent>
            </Card>

            <Card 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/admin/orders')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Completed Orders
                </CardTitle>
                <TrendingUp className="h-5 w-5 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats?.ordersCompleted || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  This period
                </p>
              </CardContent>
            </Card>

            <Card 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => navigate('/admin/orders')}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Total Orders
                </CardTitle>
                <Calendar className="h-5 w-5 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-slate-900">{stats?.totalOrders || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  All time
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Additional Stats Row */}
        {!loading && stats && (
          <div className="grid gap-6 md:grid-cols-3 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Orders On Hold
                </CardTitle>
                <Clock className="h-5 w-5 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600">{stats.ordersOnHold || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  BP/RTI Orders
                </CardTitle>
                <FileText className="h-5 w-5 text-cyan-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-cyan-600">{stats.ordersBpRti || 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-slate-600">
                  Pending Billing
                </CardTitle>
                <ClipboardList className="h-5 w-5 text-rose-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-600">{stats.ordersPendingBilling || 0}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2"
                onClick={() => navigate('/admin/teams')}
              >
                <Target className="h-6 w-6" />
                <span>View Teams</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2"
                onClick={() => navigate('/admin/employees')}
              >
                <Users className="h-6 w-6" />
                <span>View Employees</span>
              </Button>
              <Button 
                variant="outline" 
                className="h-20 flex flex-col gap-2"
                onClick={() => navigate('/admin/orders')}
              >
                <ClipboardList className="h-6 w-6" />
                <span>View Orders</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Password Reset Requests */}
        {pendingResetRequests.length > 0 && (
          <Card className="mt-8 border-orange-200 bg-orange-50/50">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-orange-600" />
                  Password Reset Requests
                  <Badge variant="destructive" className="ml-2">{pendingResetRequests.length}</Badge>
                </CardTitle>
                <CardDescription>
                  {user?.userRole === 'superadmin' 
                    ? 'Users requesting password resets (including Admin requests)' 
                    : 'Employees and Team Leads requesting password resets'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {pendingResetRequests.map((request) => (
                  <div 
                    key={request.id} 
                    className="flex items-center justify-between p-4 bg-white rounded-lg border"
                  >
                    <div className="flex items-center gap-4">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>{getInitials('')}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{request.userName || request.userName}</p>
                          {request.userRole && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {request.userRole.replace('_', ' ')}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {request.reason || 'No reason provided'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Requested: {request.createdAt ? new Date(request.createdAt).toLocaleString() : 'Unknown'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        onClick={() => {
                          setSelectedRequest(request)
                          setRejectDialogOpen(true)
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button 
                        size="sm"
                        className="bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          setSelectedRequest(request)
                          setApproveDialogOpen(true)
                        }}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Approve Password Reset Dialog */}
      <Dialog open={approveDialogOpen} onOpenChange={(open) => {
        setApproveDialogOpen(open)
        if (!open) {
          setSelectedRequest(null)
          setNewPassword('')
          setConfirmPassword('')
          setDialogError('')
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Approve Password Reset</DialogTitle>
            <DialogDescription>
              Set a new password for {selectedRequest?.userName || selectedRequest?.userName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {dialogError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{dialogError}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Enter new password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setApproveDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApproveRequest}
              disabled={isProcessing}
              className="bg-green-600 hover:bg-green-700"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Approving...
                </>
              ) : (
                'Approve & Set Password'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Password Reset Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={(open) => {
        setRejectDialogOpen(open)
        if (!open) {
          setSelectedRequest(null)
          setRejectionReason('')
          setDialogError('')
        }
      }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reject Password Reset</DialogTitle>
            <DialogDescription>
              Reject the password reset request from {selectedRequest?.userName || selectedRequest?.userName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {dialogError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{dialogError}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rejectionReason">Reason (Optional)</Label>
              <Input
                id="rejectionReason"
                placeholder="Why are you rejecting this request?"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
              disabled={isProcessing}
            >
              Cancel
            </Button>
            <Button
              onClick={handleRejectRequest}
              disabled={isProcessing}
              variant="destructive"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Rejecting...
                </>
              ) : (
                'Reject Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <ChangePasswordDialog
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
    </div>
  )
}

export default AdminDashboard
