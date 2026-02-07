import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useAuthStore } from '../../store/authStore'
import { useTeamLeadFilterStore } from '../../store/teamLeadFilterStore'
import { teamsApi, usersApi } from '../../services/api'
import type { TeamMember, TeamWithMembers, User } from '../../types'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Avatar, AvatarFallback } from '../../components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { TeamLeadNav } from '../../components/layout/TeamLeadNav'
import { Label } from '../../components/ui/label'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from '../../components/ui/dropdown-menu'
import { 
  Users, 
  UserCheck,
  UserX,
  Shield,
  Settings,
  LogOut,
  Loader2,
  MapPin,
  Package,
  Filter,
  Eye,
  UserPlus,
  MoreHorizontal,
  UserCog,
  Trash2,
} from 'lucide-react'

export const TeamMembersPage = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const { teamId: urlTeamId } = useParams<{ teamId: string }>()
  const { selectedTeamId, setSelectedTeamId } = useTeamLeadFilterStore()

  // Redirect if not team lead
  if (!user || user.userRole !== 'team_lead') {
    navigate('/login')
    return null
  }

  // Get all teams the team lead manages
  const { data: teamsData, isLoading: loadingTeams } = useQuery({
    queryKey: ['teams', 'my-teams', user?.id],
    queryFn: () => teamsApi.myTeams(),
    enabled: !!user && user.userRole === 'team_lead',
  })

  const myTeams = teamsData?.items || []
  
  // Use URL teamId if provided, otherwise use selectedTeamId from store, fallback to first team
  const urlTeamIdNum = urlTeamId ? parseInt(urlTeamId) : null
  
  // Determine which team to display - prioritize URL param, then store, then first team
  const teamId = urlTeamIdNum 
    ? urlTeamIdNum
    : selectedTeamId && myTeams.some(t => t.id === selectedTeamId) 
    ? selectedTeamId 
    : myTeams[0]?.id || null

  // Update selected team in store when it changes (use useEffect to avoid state update during render)
  useEffect(() => {
    if (teamId && teamId !== selectedTeamId) {
      setSelectedTeamId(teamId)
    }
  }, [teamId, selectedTeamId, setSelectedTeamId])

  const currentTeam = myTeams.find(t => t.id === teamId)

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

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">My Team</h1>
              <p className="text-sm text-slate-600">
                View and manage team members
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Team Filter - Always show */}
              {myTeams.length > 0 && (
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
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        )}

        {/* Show team members when team is selected */}
        {!loadingTeams && teamId && (
          <>
            {/* Team Info Banner */}
            <div className="mb-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-4 shadow-md">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">
                    {currentTeam?.name || 'Team Members'}
                  </h2>
                  <p className="text-sm text-blue-100">
                    {myTeams.length === 1 
                      ? 'You are managing this team' 
                      : myTeams.length > 1
                      ? `Managing ${myTeams.length} teams - viewing ${currentTeam?.name || 'selected team'}`
                      : 'Viewing team details'}
                  </p>
                </div>
                {myTeams.length > 0 && (
                  <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                    {myTeams.length} {myTeams.length === 1 ? 'Team' : 'Teams'}
                  </Badge>
                )}
              </div>
            </div>

            <TeamMembersContent teamId={teamId} />
          </>
        )}
      </main>
    </div>
  )
}

// Separate component to load team data
const TeamMembersContent = ({ teamId }: { teamId: number }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  
  // Dialog states
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [selectedRole, setSelectedRole] = useState<string>('member')
  
  // Change role dialog state
  const [changeRoleDialogOpen, setChangeRoleDialogOpen] = useState(false)
  const [memberToChangeRole, setMemberToChangeRole] = useState<TeamMember | null>(null)
  const [newRole, setNewRole] = useState<string>('')
  
  // Remove member dialog state
  const [removeMemberDialogOpen, setRemoveMemberDialogOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null)
  
  // Fetch team details with members
  const { data: teamData, isLoading: loadingTeam } = useQuery<TeamWithMembers>({
    queryKey: ['teams', teamId, 'details'],
    queryFn: () => teamsApi.get(teamId!),
    enabled: !!teamId,
  })

  // Fetch all users for adding members
  const { data: usersData, isLoading: loadingUsers } = useQuery({
    queryKey: ['users', 'all'],
    queryFn: () => usersApi.list({ isActive: true, pageSize: 500 }),
    enabled: addMemberDialogOpen,
  })

  // Get users not already in the team
  const availableUsers = usersData?.items.filter(
    (user: User) => !teamData?.members.some(m => m.userId === user.id)
  ) || []

  // Mutation to add member
  const addMemberMutation = useMutation({
    mutationFn: (data: { teamId: number; userId: number; role: string }) =>
      teamsApi.addMember(data.teamId, data.userId, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'details'] })
      toast.success('Member added successfully')
      setAddMemberDialogOpen(false)
      setSelectedUserId('')
      setSelectedRole('member')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add member')
    },
  })

  // Mutation to update member role
  const updateRoleMutation = useMutation({
    mutationFn: (data: { teamId: number; userId: number; role: string }) =>
      teamsApi.updateMemberRole(data.teamId, data.userId, data.role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'details'] })
      toast.success('Role updated successfully')
      setChangeRoleDialogOpen(false)
      setMemberToChangeRole(null)
      setNewRole('')
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update role')
    },
  })

  // Mutation to remove member
  const removeMemberMutation = useMutation({
    mutationFn: (data: { teamId: number; userId: number }) =>
      teamsApi.removeMember(data.teamId, data.userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams', teamId, 'details'] })
      toast.success('Member removed successfully')
      setRemoveMemberDialogOpen(false)
      setMemberToRemove(null)
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove member')
    },
  })

  // Handlers
  const handleAddMember = () => {
    if (!selectedUserId) {
      toast.error('Please select a user')
      return
    }
    addMemberMutation.mutate({
      teamId,
      userId: parseInt(selectedUserId),
      role: selectedRole,
    })
  }

  const handleOpenChangeRoleDialog = (member: TeamMember) => {
    setMemberToChangeRole(member)
    setNewRole(member.teamRole)
    setChangeRoleDialogOpen(true)
  }

  const handleChangeRole = () => {
    if (!memberToChangeRole || !newRole) return
    updateRoleMutation.mutate({
      teamId,
      userId: memberToChangeRole.userId,
      role: newRole,
    })
  }

  const handleOpenRemoveDialog = (member: TeamMember) => {
    setMemberToRemove(member)
    setRemoveMemberDialogOpen(true)
  }

  const handleRemoveMember = () => {
    if (!memberToRemove) return
    removeMemberMutation.mutate({
      teamId,
      userId: memberToRemove.userId,
    })
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

  const members = teamData?.members || []
  const activeMembers = members.filter(m => m.isActive)
  const inactiveMembers = members.filter(m => !m.isActive)

  if (loadingTeam) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Total Members
                  </CardTitle>
                  <Users className="h-5 w-5 text-blue-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{members.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Active Members
                  </CardTitle>
                  <UserCheck className="h-5 w-5 text-green-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{activeMembers.length}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    States Covered
                  </CardTitle>
                  <MapPin className="h-5 w-5 text-purple-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{teamData?.states?.length || 0}</div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Product Types
                  </CardTitle>
                  <Package className="h-5 w-5 text-orange-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">{teamData?.products?.length || 0}</div>
                </CardContent>
              </Card>
            </div>

            {/* Team Configuration */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* States Coverage */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5" />
                    States Coverage
                  </CardTitle>
                  <CardDescription>States your team handles</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {teamData?.states && teamData.states.length > 0 ? (
                      teamData.states.map((s) => (
                        <Badge key={s.id} variant="outline">
                          {s.state}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No states assigned</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Product Types */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Product Types
                  </CardTitle>
                  <CardDescription>Products your team handles</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {teamData?.products && teamData.products.length > 0 ? (
                      teamData.products.map((p) => (
                        <Badge key={p.id} variant="secondary">
                          {p.productType}
                        </Badge>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No products assigned</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Team Members Table */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Team Members</CardTitle>
                    <CardDescription>All members in your team</CardDescription>
                  </div>
                  <Button onClick={() => setAddMemberDialogOpen(true)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Add Member
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Employee ID</TableHead>
                      <TableHead>System Role</TableHead>
                      <TableHead>Team Role</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No team members found
                        </TableCell>
                      </TableRow>
                    ) : (
                      members.map((member: TeamMember) => (
                        <TableRow key={member.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
                              </Avatar>
                              <div>
                                <div>{member.userName}</div>
                                <div className="text-xs text-muted-foreground">@{member.userName}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-sm">{member.employeeId}</span>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{member.userRole}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getRoleBadgeVariant(member.teamRole)}>
                              {member.teamRole === 'lead' ? 'Team Lead' : 'Member'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {new Date(member.joinedAt).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant={member.isActive ? 'default' : 'secondary'}
                              className={member.isActive ? 'bg-green-100 text-green-800' : ''}
                            >
                              {member.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => navigate(`/teamlead/employee/${member.userId}/performance`)}
                                >
                                  <Eye className="h-4 w-4 mr-2" />
                                  View Performance
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => handleOpenChangeRoleDialog(member)}
                                >
                                  <UserCog className="h-4 w-4 mr-2" />
                                  Change Role
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleOpenRemoveDialog(member)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Remove from Team
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Inactive Members (if any) */}
            {inactiveMembers.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-slate-600">
                    <UserX className="h-5 w-5" />
                    Inactive Members ({inactiveMembers.length})
                  </CardTitle>
                  <CardDescription>Members who have left the team</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-3">
                    {inactiveMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-2 p-2 bg-slate-100 rounded-lg">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-xs">{getInitials(member.userName)}</AvatarFallback>
                        </Avatar>
                        <span className="text-sm text-slate-600">{member.userName}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Add Member Dialog */}
            <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Team Member</DialogTitle>
                  <DialogDescription>
                    Select a user to add to your team
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="user">Select User</Label>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {loadingUsers ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : availableUsers.length === 0 ? (
                          <div className="text-sm text-muted-foreground py-4 text-center">
                            No available users
                          </div>
                        ) : (
                          availableUsers.map((user: User) => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              {user.userName} (@{user.userName})
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Team Role</Label>
                    <Select value={selectedRole} onValueChange={setSelectedRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="lead">Team Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setAddMemberDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddMember}
                    disabled={addMemberMutation.isPending || !selectedUserId}
                  >
                    {addMemberMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Add Member
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
                    Update the role for {memberToChangeRole?.userName}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Current Role</Label>
                    <div>
                      <Badge variant={getRoleBadgeVariant(memberToChangeRole?.teamRole || '')}>
                        {memberToChangeRole?.teamRole === 'lead' ? 'Team Lead' : 'Member'}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="newRole">New Role</Label>
                    <Select value={newRole} onValueChange={setNewRole}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select new role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="member">Member</SelectItem>
                        <SelectItem value="lead">Team Lead</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setChangeRoleDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleChangeRole}
                    disabled={updateRoleMutation.isPending || !newRole || newRole === memberToChangeRole?.teamRole}
                  >
                    {updateRoleMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Update Role
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Remove Member Alert Dialog */}
            <AlertDialog open={removeMemberDialogOpen} onOpenChange={setRemoveMemberDialogOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Remove Team Member</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to remove <strong>{memberToRemove?.userName}</strong> from the team? 
                    This action can be undone by adding them back later.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleRemoveMember}
                    className="bg-red-600 hover:bg-red-700"
                    disabled={removeMemberMutation.isPending}
                  >
                    {removeMemberMutation.isPending && (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    )}
                    Remove Member
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
  )
}

export default TeamMembersPage
