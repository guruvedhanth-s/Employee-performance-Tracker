import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { teamsApi, usersApi, organizationsApi } from '../../services/api'
import type { TeamWithMembers, TeamMember, User, Organization } from '../../types'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import { AdminNav } from '../../components/layout/AdminNav'
import { TeamLeadNav } from '../../components/layout/TeamLeadNav'
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
  Users, 
  UserPlus,
  Trash2, 
  Loader2, 
  AlertCircle,
  ArrowLeft,
  Search,
  Crown,
  RefreshCw,
  UserCheck
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export const TeamMembersPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { teamId } = useParams<{ teamId: string }>()
  
  const [team, setTeam] = useState<TeamWithMembers | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [availableUsers, setAvailableUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingUsers, setLoadingUsers] = useState(false)
  
  // Dialog states
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false)
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false)
  
  // Selected member for actions
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null)
  
  // Form states
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [selectedRole, setSelectedRole] = useState<string>('member')
  const [searchQuery, setSearchQuery] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  // Determine if user is team lead (vs admin/superadmin)
  const isTeamLead = user?.userRole === 'team_lead'

  useEffect(() => {
    if (!user || !['admin', 'superadmin', 'team_lead'].includes(user.userRole)) {
      navigate('/login')
      return
    }
    if (teamId) {
      fetchTeamData()
    }
  }, [user, navigate, teamId])

  const fetchTeamData = async () => {
    if (!teamId) return
    
    try {
      setLoading(true)
      const teamData = await teamsApi.get(parseInt(teamId))
      setTeam(teamData)
      
      // Fetch users from the same organization as the team
      await fetchAvailableUsers(teamData.orgId)
      
      // Fetch organization details
      if (teamData.orgId) {
        try {
          const orgData = await organizationsApi.get(teamData.orgId)
          setOrganization(orgData)
        } catch (error) {
          console.error('Failed to fetch organization:', error)
        }
      }
    } catch (error) {
      console.error('Failed to fetch team:', error)
      toast.error('Failed to load team details')
      navigate(isTeamLead ? '/teamlead/team-management' : '/admin/team-management')
    } finally {
      setLoading(false)
    }
  }

  const fetchAvailableUsers = async (orgId: number) => {
    try {
      setLoadingUsers(true)
      const usersRes = await usersApi.list({ orgId, isActive: true })
      setAvailableUsers(usersRes.items || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast.error('Failed to load available users')
    } finally {
      setLoadingUsers(false)
    }
  }

  // Filter out users who are already active members (inactive members can be re-added)
  const usersNotInTeam = availableUsers.filter(u => {
    const activeMember = team?.members?.find(m => m.userId === u.id && m.isActive)
    return !activeMember
  })

  // Filter available users by search query
  const filteredAvailableUsers = usersNotInTeam.filter(u => {
    const query = searchQuery.toLowerCase()
    return (
      u.userName.toLowerCase().includes(query) ||
      u.userName.toLowerCase().includes(query) ||
      u.employeeId.toLowerCase().includes(query)
    )
  })

  const handleAddMember = async () => {
    if (!selectedUserId || !teamId) {
      setError('Please select a user')
      return
    }

    setError('')
    setIsSubmitting(true)
    
    try {
      await teamsApi.addMember(parseInt(teamId), selectedUserId, selectedRole)
      toast.success('Member added successfully!')
      setAddMemberDialogOpen(false)
      setSelectedUserId(null)
      setSelectedRole('member')
      setSearchQuery('')
      fetchTeamData()
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to add member'
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveMember = async () => {
    if (!selectedMember || !teamId) return

    setIsSubmitting(true)
    try {
      await teamsApi.removeMember(parseInt(teamId), selectedMember.userId)
      toast.success('Member removed successfully!')
      setRemoveMemberDialogOpen(false)
      setSelectedMember(null)
      fetchTeamData()
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to remove member'
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleChangeRole = async () => {
    if (!selectedMember || !teamId) return

    setIsSubmitting(true)
    try {
      await teamsApi.updateMemberRole(parseInt(teamId), selectedMember.userId, selectedRole)
      toast.success('Role updated successfully!')
      setChangeRoleDialogOpen(false)
      setSelectedMember(null)
      fetchTeamData()
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to update role'
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReactivateMember = async (member: TeamMember) => {
    if (!teamId) return

    setIsSubmitting(true)
    try {
      // Re-add the member to reactivate them (backend handles reactivation)
      await teamsApi.addMember(parseInt(teamId), member.userId, member.teamRole)
      toast.success(`${member.userName} has been reactivated!`)
      fetchTeamData()
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || 'Failed to reactivate member'
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const openChangeRoleDialog = (member: TeamMember) => {
    setSelectedMember(member)
    setSelectedRole(member.teamRole)
    setChangeRoleDialogOpen(true)
  }

  const openRemoveDialog = (member: TeamMember) => {
    setSelectedMember(member)
    setRemoveMemberDialogOpen(true)
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'lead':
        return 'default'
      case 'member':
        return 'secondary'
      default:
        return 'outline'
    }
  }

  const getUserRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-purple-100 text-purple-700'
      case 'team_lead':
        return 'bg-blue-100 text-blue-700'
      case 'employee':
        return 'bg-green-100 text-green-700'
      default:
        return 'bg-gray-100 text-gray-700'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center gap-4">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading team...</span>
            </div>
          </div>
        </header>
        {isTeamLead ? <TeamLeadNav /> : <AdminNav />}
      </div>
    )
  }

  if (!team) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white border-b border-slate-200">
          <div className="container mx-auto px-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>Team not found</AlertDescription>
            </Alert>
          </div>
        </header>
        {isTeamLead ? <TeamLeadNav /> : <AdminNav />}
      </div>
    )
  }

  // Back navigation path based on user role
  const backPath = isTeamLead ? '/teamlead/team-management' : '/admin/team-management'

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />
      
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">{team.name}</h1>
                <p className="text-sm text-slate-600">Manage team members</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={fetchTeamData}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button onClick={() => setAddMemberDialogOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Member
              </Button>
            </div>
          </div>
        </div>
      </header>
      
      {isTeamLead ? <TeamLeadNav /> : <AdminNav />}
      
      <main className="container mx-auto px-4 py-8">
        {/* Team Info Card */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex flex-wrap gap-6">
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wide">Organization</span>
                <p className="font-medium">{organization?.name || 'Unknown Organization'}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wide">Status</span>
                <p>
                  <Badge variant={team.isActive ? 'default' : 'secondary'}>
                    {team.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wide">States</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(team.states || []).slice(0, 5).map((s) => (
                    <Badge key={s.id} variant="outline" className="text-xs">
                      {s.state}
                    </Badge>
                  ))}
                  {(team.states || []).length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{team.states.length - 5}
                    </Badge>
                  )}
                </div>
              </div>
              <div>
                <span className="text-xs text-slate-500 uppercase tracking-wide">Products</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(team.products || []).slice(0, 3).map((p) => (
                    <Badge key={p.id} variant="outline" className="text-xs">
                      {p.productType}
                    </Badge>
                  ))}
                  {(team.products || []).length > 3 && (
                    <Badge variant="outline" className="text-xs">
                      +{team.products.length - 3}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Members Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({team.members?.filter(m => m.isActive).length || 0} active, {team.members?.filter(m => !m.isActive).length || 0} inactive)
            </CardTitle>
            <CardDescription>
              Add, remove, or change roles for team members. Inactive members are shown for historical records.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!team.members || team.members.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground mb-4">No members in this team</p>
                <Button onClick={() => setAddMemberDialogOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add First Member
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>System Role</TableHead>
                    <TableHead>Team Role</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Left</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.members.map((member) => (
                    <TableRow key={member.id} className={!member.isActive ? 'bg-slate-50 opacity-75' : ''}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {member.teamRole === 'lead' && member.isActive && (
                            <Crown className="h-4 w-4 text-yellow-500" />
                          )}
                          <span className={`font-medium ${!member.isActive ? 'text-slate-500' : ''}`}>
                            {member.userName}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-600">@{member.userName}</TableCell>
                      <TableCell>
                        <Badge variant={member.isActive ? 'default' : 'secondary'}>
                          {member.isActive ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded ${getUserRoleBadgeColor(member.userRole)}`}>
                          {member.userRole.replace('_', ' ')}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={getRoleBadgeVariant(member.teamRole)}
                          className={member.isActive ? 'cursor-pointer' : ''}
                          onClick={() => member.isActive && openChangeRoleDialog(member)}
                        >
                          {member.teamRole}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {new Date(member.joinedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-slate-600">
                        {member.leftAt ? new Date(member.leftAt).toLocaleDateString() : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        {member.isActive ? (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openChangeRoleDialog(member)}
                            >
                              Change Role
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              onClick={() => openRemoveDialog(member)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleReactivateMember(member)}
                            disabled={isSubmitting}
                          >
                            <UserCheck className="h-4 w-4 mr-2" />
                            Reactivate
                          </Button>
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

      {/* Add Member Dialog */}
      <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Team Member</DialogTitle>
            <DialogDescription>
              Select an employee from {team.orgId ? `this organization` : 'the organization'} to add to {team.name}
            </DialogDescription>
          </DialogHeader>
          
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4 py-4">
            {/* Search */}
            <div className="space-y-2">
              <Label>Search User</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search by name, username, or employee ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* User Selection */}
            <div className="space-y-2">
              <Label>Select User *</Label>
              {loadingUsers ? (
                <div className="flex items-center gap-2 py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-slate-600">Loading users...</span>
                </div>
              ) : filteredAvailableUsers.length === 0 ? (
                <div className="text-center py-4 text-slate-500">
                  {usersNotInTeam.length === 0 
                    ? 'All users are already members of this team'
                    : 'No users found matching your search'
                  }
                </div>
              ) : (
                <div className="border rounded-md max-h-60 overflow-y-auto">
                  {filteredAvailableUsers.map((u) => (
                    <div
                      key={u.id}
                      className={`px-3 py-2 cursor-pointer hover:bg-slate-50 flex items-center justify-between ${
                        selectedUserId === u.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                      }`}
                      onClick={() => setSelectedUserId(u.id)}
                    >
                      <div>
                        <p className="font-medium text-sm">{u.userName}</p>
                        <p className="text-xs text-slate-500">@{u.userName} &bull; {u.employeeId}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded ${getUserRoleBadgeColor(u.userRole)}`}>
                        {u.userRole.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label>Team Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500">
                Team leads have additional visibility into team performance
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setAddMemberDialogOpen(false)
              setSelectedUserId(null)
              setSearchQuery('')
              setError('')
            }}>
              Cancel
            </Button>
            <Button onClick={handleAddMember} disabled={isSubmitting || !selectedUserId}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Member
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Role Dialog */}
      <Dialog open={changeRoleDialogOpen} onOpenChange={setChangeRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Team Role</DialogTitle>
            <DialogDescription>
              Update the role for {selectedMember?.userName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
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
            <Button variant="outline" onClick={() => setChangeRoleDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleChangeRole} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Role'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Member Dialog */}
      <Dialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Team Member</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove {selectedMember?.userName} from {team.name}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveMemberDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemoveMember} disabled={isSubmitting}>
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

export default TeamMembersPage
