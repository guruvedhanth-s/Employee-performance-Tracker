import { useState, useEffect } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { usersApi, teamsApi, organizationsApi } from '../../services/api'
import type { UserWithTeams, Team, TeamMembership, Organization } from '../../types'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import { AdminNav } from '../../components/layout/AdminNav'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { 
  User as UserIcon,
  ArrowLeft,
  Loader2, 
  AlertCircle,
  Edit,
  Key,
  Users,
  UserPlus,
  Trash2,
  Save,
  RefreshCw,
  Shield,
  Calendar,
  Clock,
  Building2
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

// Helper function to extract error message from API response
const getErrorMessage = (error: any): string => {
  const detail = error.response?.data?.detail
  if (!detail) return 'An unexpected error occurred'
  
  // If detail is a string, return it directly
  if (typeof detail === 'string') return detail
  
  // If detail is an array (FastAPI validation errors), extract messages
  if (Array.isArray(detail)) {
    return detail.map((err: any) => err.msg || err.message || String(err)).join(', ')
  }
  
  // If detail is an object with a message property
  if (typeof detail === 'object' && detail.msg) return detail.msg
  if (typeof detail === 'object' && detail.message) return detail.message
  
  // Fallback: stringify the object
  return JSON.stringify(detail)
}

export const EmployeeDetailPage = () => {
  const { user: currentUser } = useAuthStore()
  const navigate = useNavigate()
  const { userId } = useParams<{ userId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  
  const [employee, setEmployee] = useState<UserWithTeams | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [availableTeams, setAvailableTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingTeams, setLoadingTeams] = useState(false)
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false)
  const [addToTeamDialogOpen, setAddToTeamDialogOpen] = useState(false)
  const [removeFromTeamDialogOpen, setRemoveFromTeamDialogOpen] = useState(false)
  
  // Selected team for removal
  const [selectedTeam, setSelectedTeam] = useState<TeamMembership | null>(null)
  
  // Form states for edit
  const [editForm, setEditForm] = useState({
    userName: '',
    userRole: '' as 'admin' | 'team_lead' | 'employee',
    isActive: true
  })
  
  // Form states for password reset
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  
  // Form states for add to team
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [selectedTeamRole, setSelectedTeamRole] = useState<string>('member')
  
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!currentUser || !['admin', 'superadmin'].includes(currentUser.userRole)) {
      navigate('/login')
      return
    }
    if (userId) {
      fetchEmployeeData()
    }
  }, [currentUser, navigate, userId])

  // Handle edit query parameter to auto-open edit dialog
  useEffect(() => {
    if (searchParams.get('edit') === 'true' && employee && !loading) {
      setEditDialogOpen(true)
      // Remove the query parameter from URL
      searchParams.delete('edit')
      setSearchParams(searchParams, { replace: true })
    }
  }, [searchParams, employee, loading, setSearchParams])

  const fetchEmployeeData = async () => {
    if (!userId) return
    
    try {
      setLoading(true)
      const userData = await usersApi.get(parseInt(userId))
      setEmployee(userData)
      
      // Initialize edit form
      setEditForm({
        userName: userData.userName,
        userRole: userData.userRole as 'admin' | 'team_lead' | 'employee',
        isActive: userData.isActive
      })
      
      // Fetch available teams for the same organization
      if (userData.orgId) {
        await fetchAvailableTeams(userData.orgId)
        // Fetch organization details
        try {
          const orgData = await organizationsApi.get(userData.orgId)
          setOrganization(orgData)
        } catch (error) {
          console.error('Failed to fetch organization:', error)
        }
      }
    } catch (error) {
      console.error('Failed to fetch employee:', error)
      toast.error('Failed to load employee details')
      navigate('/admin/employees')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableTeams = async (orgId: number) => {
    try {
      setLoadingTeams(true)
      const teamsRes = await teamsApi.list({ orgId, isActive: true })
      setAvailableTeams(teamsRes.items || [])
    } catch (error) {
      console.error('Failed to fetch teams:', error)
    } finally {
      setLoadingTeams(false)
    }
  }

  // Filter out teams the employee is already an active member of
  // (teams with inactive memberships will show, allowing re-adding)
  const teamsNotJoined = availableTeams.filter(t => {
    const isActiveMember = employee?.teams?.some(m => m.teamId === t.id && m.isActive)
    return !isActiveMember
  })

  const handleUpdateEmployee = async () => {
    if (!userId) return

    setError('')
    setIsSubmitting(true)
    
    // Check if user is being deactivated
    const isBeingDeactivated = employee?.isActive && !editForm.isActive
    
    try {
      await usersApi.update(parseInt(userId), {
        userName: editForm.userName,
        userRole: editForm.userRole,
        isActive: editForm.isActive
      })
      
      if (isBeingDeactivated) {
        toast.success('Employee deactivated and removed from all teams')
      } else {
        toast.success('Employee updated successfully!')
      }
      
      setEditDialogOpen(false)
      fetchEmployeeData()
    } catch (error: any) {
      const errorMsg = getErrorMessage(error)
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    if (!userId) return

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }
    
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    setError('')
    setIsSubmitting(true)
    
    try {
      await usersApi.resetPassword(parseInt(userId), newPassword)
      toast.success('Temporary password set. User must change password on next login.')
      setResetPasswordDialogOpen(false)
      setNewPassword('')
      setConfirmPassword('')
    } catch (error: any) {
      const errorMsg = getErrorMessage(error)
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddToTeam = async () => {
    if (!userId || !selectedTeamId) {
      setError('Please select a team')
      return
    }

    setError('')
    setIsSubmitting(true)
    
    try {
      await usersApi.addToTeam(parseInt(userId), {
        userId: parseInt(userId),
        teamId: selectedTeamId,
        role: selectedTeamRole
      })
      toast.success('Added to team successfully!')
      setAddToTeamDialogOpen(false)
      setSelectedTeamId(null)
      setSelectedTeamRole('member')
      fetchEmployeeData()
    } catch (error: any) {
      const errorMsg = getErrorMessage(error)
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveFromTeam = async () => {
    if (!userId || !selectedTeam) return

    setIsSubmitting(true)
    try {
      await usersApi.removeFromTeam(parseInt(userId), selectedTeam.teamId)
      toast.success('Removed from team successfully!')
      setRemoveFromTeamDialogOpen(false)
      setSelectedTeam(null)
      fetchEmployeeData()
    } catch (error: any) {
      const errorMsg = getErrorMessage(error)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openRemoveFromTeamDialog = (team: TeamMembership) => {
    setSelectedTeam(team)
    setRemoveFromTeamDialogOpen(true)
  }

  const handleReactivateTeamMembership = async (team: TeamMembership) => {
    if (!userId) return

    setIsSubmitting(true)
    try {
      // Re-add user to the team (this will reactivate the membership)
      await usersApi.addToTeam(parseInt(userId), {
        userId: parseInt(userId),
        teamId: team.teamId,
        role: team.role
      })
      toast.success(`Reactivated membership in ${team.teamName}`)
      fetchEmployeeData()
    } catch (error: any) {
      const errorMsg = getErrorMessage(error)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin':
        return 'bg-red-100 text-red-700 border-red-200'
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

  const getTeamRoleBadgeVariant = (role: string) => {
    return role === 'lead' ? 'default' : 'secondary'
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading employee...</span>
            </div>
          </div>
        </header>
        <AdminNav />
      </div>
    )
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="container mx-auto px-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Employee not found</AlertDescription>
            </Alert>
          </div>
        </header>
        <AdminNav />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />
      
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/admin/employees')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{employee.userName}</h1>
                <p className="text-sm text-slate-600">Employee Details</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchEmployeeData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              {employee.userRole !== 'superadmin' && (
                <Button variant="outline" onClick={() => setResetPasswordDialogOpen(true)}>
                  <Key className="h-4 w-4 mr-2" />
                  Reset Password
                </Button>
              )}
              <Button onClick={() => setEditDialogOpen(true)}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      <AdminNav />
      
      <main className="container mx-auto px-4 py-8">
        {/* Inactive Employee Warning */}
        {!employee.isActive && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800">
              This employee is <strong>inactive</strong>. Team management actions are disabled until the employee is reactivated.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          {/* Employee Info Card */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserIcon className="h-5 w-5" />
                Employee Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-4">
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
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Organization</Label>
                    <p className="font-medium flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      {organization?.name || (employee.orgId ? 'Unknown Organization' : 'No Organization')}
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Role</Label>
                    <div className="mt-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${getRoleBadgeColor(employee.userRole)}`}>
                        <Shield className="h-3 w-3" />
                        {employee.userRole.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide">Status</Label>
                    <div className="mt-1">
                      <Badge variant={employee.isActive ? 'default' : 'secondary'}>
                        {employee.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Last Login
                    </Label>
                    <p className="font-medium text-sm">{formatDate(employee.lastLogin)}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
                      <Key className="h-3 w-3" />
                      Password Changed
                    </Label>
                    <p className="font-medium text-sm">{formatDate(employee.passwordLastChanged)}</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t grid gap-4 md:grid-cols-2">
                <div>
                  <Label className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Created
                  </Label>
                  <p className="font-medium text-sm">{formatDate(employee.createdAt)}</p>
                </div>
                <div>
                  <Label className="text-xs text-slate-500 uppercase tracking-wide flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Last Modified
                  </Label>
                  <p className="font-medium text-sm">{formatDate(employee.modifiedAt)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start" 
                onClick={() => setEditDialogOpen(true)}
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Details
              </Button>
              {employee.userRole !== 'superadmin' && (
                <Button 
                  variant="outline" 
                  className="w-full justify-start"
                  onClick={() => setResetPasswordDialogOpen(true)}
                >
                  <Key className="h-4 w-4 mr-2" />
                  Reset Password
                </Button>
              )}
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setAddToTeamDialogOpen(true)}
                disabled={!employee.isActive}
                title={!employee.isActive ? 'Cannot add inactive employee to teams' : undefined}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add to Team
              </Button>
              {employee.isActive ? (
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                  onClick={() => {
                    setEditForm({ ...editForm, isActive: false })
                    setEditDialogOpen(true)
                  }}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Deactivate
                </Button>
              ) : (
                <Button 
                  variant="outline" 
                  className="w-full justify-start text-green-600 hover:text-green-700 hover:bg-green-50"
                  onClick={() => {
                    setEditForm({ ...editForm, isActive: true })
                    setEditDialogOpen(true)
                  }}
                >
                  <AlertCircle className="h-4 w-4 mr-2" />
                  Reactivate
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Team Memberships */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team Memberships
                  {employee.teams && employee.teams.length > 0 && (
                    <span className="text-sm font-normal text-muted-foreground ml-1">
                      ({employee.teams.filter(t => t.isActive).length} active
                      {employee.teams.filter(t => !t.isActive).length > 0 && 
                        `, ${employee.teams.filter(t => !t.isActive).length} inactive`})
                    </span>
                  )}
                </CardTitle>
                <CardDescription>
                  Teams this employee belongs to (including historical)
                </CardDescription>
              </div>
              <Button 
                onClick={() => setAddToTeamDialogOpen(true)}
                disabled={!employee.isActive}
                title={!employee.isActive ? 'Cannot add inactive employee to teams' : undefined}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add to Team
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!employee.teams || employee.teams.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">Not a member of any team</p>
                {employee.isActive ? (
                  <Button onClick={() => setAddToTeamDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add to First Team
                  </Button>
                ) : (
                  <p className="text-sm text-amber-600">Activate this employee to add them to a team</p>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Name</TableHead>
                    <TableHead>Team Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Left</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employee.teams.map((team) => (
                    <TableRow 
                      key={team.teamId}
                      className={!team.isActive ? 'opacity-60 bg-slate-50' : ''}
                    >
                      <TableCell className="font-medium">{team.teamName}</TableCell>
                      <TableCell>
                        <Badge variant={getTeamRoleBadgeVariant(team.role)}>
                          {team.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={team.isActive ? 'default' : 'secondary'}>
                          {team.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {new Date(team.joinedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {team.leftAt ? new Date(team.leftAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {team.isActive ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => openRemoveFromTeamDialog(team)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : employee.isActive ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleReactivateTeamMembership(team)}
                            disabled={isSubmitting}
                          >
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Reactivate
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Edit Employee Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>
              Update employee details
            </DialogDescription>
          </DialogHeader>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Username *</Label>
              <Input
                value={editForm.userName}
                onChange={(e) => setEditForm({ ...editForm, userName: e.target.value })}
                placeholder="Enter username"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Role *</Label>
              <Select 
                value={editForm.userRole} 
                onValueChange={(value) => setEditForm({ ...editForm, userRole: value as 'admin' | 'team_lead' | 'employee' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee">Employee</SelectItem>
                  <SelectItem value="team_lead">Team Lead</SelectItem>
                  {currentUser?.userRole === 'superadmin' && (
                    <SelectItem value="admin">Admin</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={editForm.isActive ? 'active' : 'inactive'} 
                onValueChange={(value) => setEditForm({ ...editForm, isActive: value === 'active' })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setEditDialogOpen(false)
              setError('')
              // Reset form to original values
              if (employee) {
                setEditForm({
                  userName: employee.userName,
                  userRole: employee.userRole as 'admin' | 'team_lead' | 'employee',
                  isActive: employee.isActive
                })
              }
            }}>
              Cancel
            </Button>
            <Button onClick={handleUpdateEmployee} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={resetPasswordDialogOpen} onOpenChange={setResetPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for {employee.userName}
            </DialogDescription>
          </DialogHeader>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Password *</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Confirm Password *</Label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
              />
            </div>
            
            <p className="text-xs text-slate-500">
              Password must be at least 8 characters
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setResetPasswordDialogOpen(false)
              setNewPassword('')
              setConfirmPassword('')
              setError('')
            }}>
              Cancel
            </Button>
            <Button onClick={handleResetPassword} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resetting...
                </>
              ) : (
                <>
                  <Key className="h-4 w-4 mr-2" />
                  Reset Password
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add to Team Dialog */}
      <Dialog open={addToTeamDialogOpen} onOpenChange={setAddToTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add to Team</DialogTitle>
            <DialogDescription>
              Add {employee.userName} to a team
            </DialogDescription>
          </DialogHeader>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Select Team *</Label>
              {loadingTeams ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-slate-600">Loading teams...</span>
                </div>
              ) : teamsNotJoined.length === 0 ? (
                <div className="text-center py-4 text-slate-500">
                  {availableTeams.length === 0 
                    ? 'No teams available in this organization'
                    : 'Already a member of all available teams'
                  }
                </div>
              ) : (
                <Select 
                  value={selectedTeamId?.toString() || ''} 
                  onValueChange={(value) => setSelectedTeamId(parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamsNotJoined.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            
            <div className="space-y-2">
              <Label>Team Role</Label>
              <Select value={selectedTeamRole} onValueChange={setSelectedTeamRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddToTeamDialogOpen(false)
              setSelectedTeamId(null)
              setSelectedTeamRole('member')
              setError('')
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddToTeam} disabled={isSubmitting || !selectedTeamId}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add to Team
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove from Team Dialog */}
      <Dialog open={removeFromTeamDialogOpen} onOpenChange={setRemoveFromTeamDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove from Team</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {employee.userName} from {selectedTeam?.teamName}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveFromTeamDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveFromTeam} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Removing...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Remove
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default EmployeeDetailPage
