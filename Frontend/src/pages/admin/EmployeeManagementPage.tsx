import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { usersApi, organizationsApi, teamsApi } from '../../services/api'
import type { Organization, Team, UserRole } from '../../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { Input } from '../../components/ui/input'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { AdminNav } from '../../components/layout/AdminNav'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose
} from '../../components/ui/dialog'
import { 
  Users, 
  UserCheck, 
  UserX, 
  Search, 
  UserPlus, 
  Eye, 
  Edit, 
  Filter, 
  X,
  Loader2,
  AlertCircle,
  ArrowLeft,
  BarChart3
} from 'lucide-react'
import toast from 'react-hot-toast'

// Interface matching the backend API response
interface UserData {
  id: number
  userName: string
  employeeId: string
  userRole: string
  orgId: number | null
  isActive: boolean
}

export const EmployeeManagementPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [employees, setEmployees] = useState<UserData[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Filter states
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [orgFilter, setOrgFilter] = useState<string>('all')

  // Onboarding modal states
  const [showOnboardingModal, setShowOnboardingModal] = useState(false)
  const [formData, setFormData] = useState({
    userName: '',
    password: '',
    confirmPassword: '',
    userRole: 'employee' as UserRole,
    orgId: user?.orgId || null as number | null,
  })
  const [selectedTeams, setSelectedTeams] = useState<number[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!user || !['admin', 'superadmin'].includes(user.userRole)) {
      navigate('/login')
    } else {
      fetchData()
    }
  }, [user, navigate, location.key])

  // Refetch data when page becomes visible (e.g., switching browser tabs)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user) {
        fetchData()
      }
    }

    const handleFocus = () => {
      if (user) {
        fetchData()
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('focus', handleFocus)
    }
  }, [user])

  // Fetch teams when organization changes in form
  useEffect(() => {
    if (formData.orgId && showOnboardingModal) {
      fetchTeamsForOrg(formData.orgId)
    } else {
      setTeams([])
    }
    setSelectedTeams([])
  }, [formData.orgId, showOnboardingModal])

  const fetchData = async () => {
    try {
      setLoading(true)
      
      // Fetch employees and organizations in parallel
      const [usersRes, orgsRes] = await Promise.all([
        usersApi.list(),
        organizationsApi.list({ isActive: true })
      ])
      
      // Filter out superadmin and the currently logged-in user from the list
      const filteredEmployees = (usersRes.items || []).filter((u: UserData) => 
        u.userRole !== 'superadmin' && u.id !== user?.id
      )
      setEmployees(filteredEmployees)
      setOrganizations(orgsRes.items || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchTeamsForOrg = async (orgId: number) => {
    try {
      setLoadingTeams(true)
      const teamsRes = await teamsApi.list({ 
        orgId: orgId,
        isActive: true 
      })
      setTeams(teamsRes.items || [])
    } catch (error) {
      console.error('Failed to fetch teams:', error)
      setTeams([])
    } finally {
      setLoadingTeams(false)
    }
  }

  const getInitials = (userName: string) => {
    const parts = userName.split(' ')
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    }
    return userName.substring(0, 2).toUpperCase()
  }

  const getOrgName = (orgId: number | null) => {
    if (!orgId) return 'No Org'
    const org = organizations.find(o => o.id === orgId)
    return org ? org.name : `Org #${orgId}`
  }

  // Filter employees based on all filters
  const filteredEmployees = employees.filter(emp => {
    // Search filter
    const searchLower = searchQuery.toLowerCase()
    const matchesSearch = 
      emp.userName.toLowerCase().includes(searchLower) ||
      emp.userName.toLowerCase().includes(searchLower) ||
      emp.employeeId.toLowerCase().includes(searchLower)
    
    // Role filter
    const matchesRole = roleFilter === 'all' || emp.userRole === roleFilter
    
    // Status filter
    const matchesStatus = 
      statusFilter === 'all' || 
      (statusFilter === 'active' && emp.isActive) ||
      (statusFilter === 'inactive' && !emp.isActive)
    
    // Organization filter
    const matchesOrg = 
      orgFilter === 'all' || 
      emp.orgId?.toString() === orgFilter
    
    return matchesSearch && matchesRole && matchesStatus && matchesOrg
  })

  const activeCount = employees.filter(e => e.isActive).length
  const inactiveCount = employees.length - activeCount

  const hasActiveFilters = roleFilter !== 'all' || statusFilter !== 'all' || orgFilter !== 'all'

  const clearFilters = () => {
    setRoleFilter('all')
    setStatusFilter('all')
    setOrgFilter('all')
    setSearchQuery('')
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700 border-purple-200'
      case 'team_lead':
        return 'bg-blue-100 text-blue-700 border-blue-200'
      case 'employee':
        return 'bg-green-100 text-green-700 border-green-200'
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200'
    }
  }

  // Onboarding form handlers
  const resetForm = () => {
    setFormData({
      userName: '',
      password: '',
      confirmPassword: '',
      userRole: 'employee',
      orgId: user?.orgId || null,
    })
    setSelectedTeams([])
    setFormError('')
  }

  const handleOrgChange = (value: string) => {
    const orgId = parseInt(value)
    setFormData({...formData, orgId})
  }

  const handleTeamToggle = (teamId: number) => {
    setSelectedTeams(prev => 
      prev.includes(teamId) 
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    // Validation
    if (!formData.userName || !formData.password) {
      setFormError('Please fill in all required fields')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setFormError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setFormError('Password must be at least 8 characters long')
      return
    }

    // Non-superadmin users must have an organization
    if (formData.userRole !== 'superadmin' && !formData.orgId) {
      setFormError('Please select an organization')
      return
    }

    setIsSubmitting(true)

    try {
      // Create the user
      const newUser = await usersApi.create({
        userName: formData.userName,
        password: formData.password,
        userRole: formData.userRole,
        orgId: formData.userRole === 'superadmin' ? null : formData.orgId,
      })

      // Add user to selected teams
      for (const teamId of selectedTeams) {
        await usersApi.addToTeam(newUser.id, { 
          userId: newUser.id, 
          teamId,
          role: 'member'
        })
      }

      toast.success('Employee created successfully!')
      setShowOnboardingModal(false)
      resetForm()
      fetchData() // Refresh the list
      
    } catch (error: any) {
      let errorMsg = 'Failed to create employee'
      const detail = error.response?.data?.detail
      
      if (detail) {
        if (typeof detail === 'string') {
          errorMsg = detail
        } else if (Array.isArray(detail)) {
          errorMsg = detail.map((err: any) => err.msg || err.message || JSON.stringify(err)).join(', ')
        } else if (typeof detail === 'object') {
          errorMsg = detail.msg || detail.message || JSON.stringify(detail)
        }
      }
      
      setFormError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Determine if we should show organization selector
  const showOrgSelector = user?.userRole === 'superadmin' && formData.userRole !== 'superadmin'
  const effectiveOrgId = formData.orgId

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon"
                onClick={() => navigate('/admin/employees')}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Employee Management</h1>
                <p className="text-sm text-slate-600">View, manage, and onboard employees</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={() => navigate('/admin/employees')}>
                <BarChart3 className="h-4 w-4 mr-2" />
                View Analytics
              </Button>
              <Dialog open={showOnboardingModal} onOpenChange={(open) => {
                setShowOnboardingModal(open)
                if (!open) resetForm()
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Onboard Employee
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      Onboard New Employee
                    </DialogTitle>
                    <DialogDescription>
                      Fill in the details to add a new team member
                    </DialogDescription>
                  </DialogHeader>

                  {formError && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>{formError}</AlertDescription>
                    </Alert>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Role & Organization */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-sm text-slate-700">Role & Organization</h3>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="role">Role *</Label>
                          <Select 
                            value={formData.userRole} 
                            onValueChange={(value: UserRole) => setFormData({...formData, userRole: value})}
                            disabled={isSubmitting}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="employee">Employee</SelectItem>
                              <SelectItem value="team_lead">Team Lead</SelectItem>
                              <SelectItem value="admin">Admin</SelectItem>
                              {user?.userRole === 'superadmin' && (
                                <SelectItem value="superadmin">Super Admin</SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>

                        {showOrgSelector && (
                          <div className="space-y-2">
                            <Label htmlFor="organization">Organization *</Label>
                            <Select 
                              value={formData.orgId ? formData.orgId.toString() : undefined} 
                              onValueChange={handleOrgChange}
                              disabled={isSubmitting}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select organization" />
                              </SelectTrigger>
                              <SelectContent>
                                {organizations.map((org) => (
                                  <SelectItem key={org.id} value={org.id.toString()}>
                                    {org.name} ({org.code})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Basic Info */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-sm text-slate-700">Basic Information</h3>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="userName">Username *</Label>
                          <Input 
                            id="userName" 
                            placeholder="e.g., john.doe"
                            value={formData.userName} 
                            onChange={(e) => setFormData({...formData, userName: e.target.value})} 
                            required 
                            disabled={isSubmitting}
                          />
                          <p className="text-xs text-muted-foreground">Used for login and display</p>
                        </div>
                      </div>
                    </div>

                    {/* Password */}
                    <div className="space-y-4">
                      <h3 className="font-medium text-sm text-slate-700">Password</h3>
                      
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="password">Password *</Label>
                          <Input 
                            id="password" 
                            type="password" 
                            placeholder="Min 8 characters"
                            value={formData.password} 
                            onChange={(e) => setFormData({...formData, password: e.target.value})} 
                            required 
                            disabled={isSubmitting}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Confirm Password *</Label>
                          <Input 
                            id="confirmPassword" 
                            type="password" 
                            placeholder="Re-enter password"
                            value={formData.confirmPassword} 
                            onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} 
                            required 
                            disabled={isSubmitting}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Team Assignment */}
                    {formData.userRole !== 'superadmin' && effectiveOrgId && (
                      <div className="space-y-4">
                        <h3 className="font-medium text-sm text-slate-700">Team Assignment (Optional)</h3>
                        
                        {loadingTeams ? (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Loading teams...
                          </div>
                        ) : teams.length > 0 ? (
                          <>
                            <p className="text-xs text-muted-foreground">Select teams to assign this employee to</p>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {teams.map((team) => (
                                <Button
                                  key={team.id}
                                  type="button"
                                  variant={selectedTeams.includes(team.id) ? 'default' : 'outline'}
                                  size="sm"
                                  onClick={() => handleTeamToggle(team.id)}
                                  disabled={isSubmitting}
                                  className="justify-start"
                                >
                                  {team.name}
                                </Button>
                              ))}
                            </div>
                            
                            {selectedTeams.length > 0 && (
                              <p className="text-xs text-muted-foreground">
                                Selected: {selectedTeams.length} team(s)
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground">No teams available for this organization</p>
                        )}
                      </div>
                    )}

                    {showOrgSelector && !formData.orgId && formData.userRole !== 'superadmin' && (
                      <p className="text-sm text-amber-600">Please select an organization to see available teams</p>
                    )}

                    <DialogFooter>
                      <DialogClose asChild>
                        <Button type="button" variant="outline" disabled={isSubmitting}>
                          Cancel
                        </Button>
                      </DialogClose>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Create Employee
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <AdminNav />

      <main className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'all' ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
            onClick={() => setStatusFilter('all')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{employees.length}</div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'active' ? 'ring-2 ring-green-500' : 'hover:shadow-md'}`}
            onClick={() => setStatusFilter(statusFilter === 'active' ? 'all' : 'active')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <UserCheck className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{activeCount}</div>
            </CardContent>
          </Card>
          <Card 
            className={`cursor-pointer transition-all ${statusFilter === 'inactive' ? 'ring-2 ring-slate-400' : 'hover:shadow-md'}`}
            onClick={() => setStatusFilter(statusFilter === 'inactive' ? 'all' : 'inactive')}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <UserX className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{inactiveCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Employees Table */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>All Employees</CardTitle>
                <CardDescription>
                  {filteredEmployees.length === employees.length 
                    ? 'Complete employee directory'
                    : `Showing ${filteredEmployees.length} of ${employees.length} employees`
                  }
                </CardDescription>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-1" />
                  Clear Filters
                </Button>
              )}
            </div>
          </CardHeader>
          
          {/* Filters Section */}
          <CardContent className="pt-0 pb-4 border-b">
            <div className="flex flex-col md:flex-row gap-4">
              {/* Search */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Search by name, username, or employee ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Role Filter */}
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="team_lead">Team Lead</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Status Filter */}
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full md:w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              
              {/* Organization Filter */}
              {user?.userRole === 'superadmin' && (
                <Select value={orgFilter} onValueChange={setOrgFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Organization" />
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
            
            {/* Active Filters Display */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-2 mt-3">
                <span className="text-xs text-slate-500 flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  Active filters:
                </span>
                {roleFilter !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    Role: {roleFilter === 'team_lead' ? 'Team Lead' : roleFilter.charAt(0).toUpperCase() + roleFilter.slice(1)}
                    <button 
                      onClick={() => setRoleFilter('all')} 
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {statusFilter !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    Status: {statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
                    <button 
                      onClick={() => setStatusFilter('all')} 
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
                {orgFilter !== 'all' && (
                  <Badge variant="secondary" className="text-xs">
                    Org: {getOrgName(parseInt(orgFilter))}
                    <button 
                      onClick={() => setOrgFilter('all')} 
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                )}
              </div>
            )}
          </CardContent>
          
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : filteredEmployees.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-2">No employees found</p>
                {hasActiveFilters ? (
                  <Button variant="link" onClick={clearFilters}>
                    Clear all filters
                  </Button>
                ) : (
                  <Button variant="link" onClick={() => setShowOnboardingModal(true)}>
                    Onboard your first employee
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Role</TableHead>
                    {user?.userRole === 'superadmin' && <TableHead>Organization</TableHead>}
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEmployees.map((emp) => (
                    <TableRow key={emp.id} className={!emp.isActive ? 'opacity-60' : ''}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={!emp.isActive ? 'bg-slate-200' : ''}>
                              {getInitials(emp.userName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div>{emp.userName}</div>
                            <div className="text-xs text-muted-foreground">{emp.employeeId}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">@{emp.userName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${getRoleBadgeColor(emp.userRole)}`}>
                          {emp.userRole === 'team_lead' ? 'Team Lead' : 
                           emp.userRole === 'admin' ? 'Admin' : 'Employee'}
                        </span>
                      </TableCell>
                      {user?.userRole === 'superadmin' && (
                        <TableCell className="text-sm text-muted-foreground">
                          {getOrgName(emp.orgId)}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge variant={emp.isActive ? 'default' : 'secondary'}>
                          {emp.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                       <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/admin/employees/${emp.id}/performance`)}
                            title="View Performance"
                          >
                            <BarChart3 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/admin/employees/${emp.id}`)}
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/admin/employees/${emp.id}?edit=true`)}
                            title="Edit Employee"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default EmployeeManagementPage
