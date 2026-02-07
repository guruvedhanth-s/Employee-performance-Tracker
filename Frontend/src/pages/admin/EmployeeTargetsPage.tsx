import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { teamsApi, weeklyTargetsApi } from '../../services/api'
import type { Team, TeamWeeklyTargetsResponse, TeamMemberTargetEntry, CurrentWeekInfo } from '../../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Badge } from '../../components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import { AdminNav } from '../../components/layout/AdminNav'
import { TeamLeadNav } from '../../components/layout/TeamLeadNav'
import { 
  Target, 
  Users, 
  Save, 
  ChevronLeft, 
  ChevronRight,
  Copy,
  Loader2,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react'
import toast from 'react-hot-toast'

interface TargetEditState {
  [userId: number]: string
}

export const EmployeeTargetsPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { teamId: urlTeamId } = useParams<{ teamId: string }>()
  
  // Determine if user is team lead
  const isTeamLead = user?.userRole === 'team_lead'
  
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(
    urlTeamId ? parseInt(urlTeamId) : null
  )
  const [weekOffset, setWeekOffset] = useState(0) // 0 = current week, -1 = previous, 1 = next
  const [targetEdits, setTargetEdits] = useState<TargetEditState>({})
  const [hasChanges, setHasChanges] = useState(false)

  // Redirect if not admin or team lead
  useEffect(() => {
    if (!user || !['admin', 'superadmin', 'team_lead'].includes(user.userRole)) {
      navigate('/login')
    }
  }, [user, navigate])

  // Update selectedTeamId when URL param changes
  useEffect(() => {
    if (urlTeamId) {
      setSelectedTeamId(parseInt(urlTeamId))
    }
  }, [urlTeamId])

  // Fetch teams - use myTeams for team leads, list for admins
  const { data: teamsData, isLoading: loadingTeams } = useQuery({
    queryKey: ['teams', isTeamLead ? 'my-teams' : 'list', user?.orgId],
    queryFn: () => isTeamLead ? teamsApi.myTeams() : teamsApi.list({ isActive: true }),
    enabled: !!user,
  })

  const teams = teamsData?.items || []

  // Auto-select first team if none selected
  useEffect(() => {
    if (!selectedTeamId && teams.length > 0) {
      setSelectedTeamId(teams[0].id)
    }
  }, [teams, selectedTeamId])

  // Fetch current week info
  const { data: currentWeekInfo } = useQuery<CurrentWeekInfo>({
    queryKey: ['weekly-targets', 'current-week'],
    queryFn: () => weeklyTargetsApi.getCurrentWeek(),
    enabled: !!user,
  })

  // Calculate week start date based on offset
  const getWeekStartDate = (): string | undefined => {
    if (!currentWeekInfo) return undefined
    
    const baseDate = new Date(currentWeekInfo.weekStartDate)
    baseDate.setDate(baseDate.getDate() + (weekOffset * 7))
    return baseDate.toISOString().split('T')[0]
  }

  const weekStartDate = getWeekStartDate()

  // Fetch team targets for selected week
  const { 
    data: teamTargets, 
    isLoading: loadingTargets,
    refetch: refetchTargets 
  } = useQuery<TeamWeeklyTargetsResponse>({
    queryKey: ['weekly-targets', 'team', selectedTeamId, weekStartDate],
    queryFn: () => weeklyTargetsApi.getTeamTargets({
      teamId: selectedTeamId!,
      weekStartDate,
    }),
    enabled: !!selectedTeamId && !!weekStartDate,
  })

  // Reset edits when team or week changes
  useEffect(() => {
    setTargetEdits({})
    setHasChanges(false)
  }, [selectedTeamId, weekStartDate])

  // Initialize target edits from fetched data
  useEffect(() => {
    if (teamTargets?.members) {
      const initialEdits: TargetEditState = {}
      teamTargets.members.forEach(member => {
        // Default to "0" if no target is set
        initialEdits[member.userId] = member.currentTarget?.toString() || '0'
      })
      setTargetEdits(initialEdits)
      setHasChanges(false)
    }
  }, [teamTargets])

  // Save targets mutation
  const saveTargetsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeamId || !weekStartDate) throw new Error('No team or week selected')
      
      const targets = Object.entries(targetEdits)
        .filter(([, value]) => value !== '')
        .map(([userId, value]) => ({
          userId: parseInt(userId),
          target: parseFloat(value),
        }))

      return weeklyTargetsApi.setTeamTargets(selectedTeamId, {
        weekStartDate,
        targets,
      })
    },
    onSuccess: (data) => {
      toast.success(`Saved ${data.createdCount + data.updatedCount} targets`)
      setHasChanges(false)
      queryClient.invalidateQueries({ queryKey: ['weekly-targets'] })
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to save targets')
    },
  })

  // Copy from previous week mutation
  const copyFromPreviousMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTeamId || !weekStartDate) throw new Error('No team or week selected')
      return weeklyTargetsApi.copyFromPreviousWeek({
        teamId: selectedTeamId,
        weekStartDate,
      })
    },
    onSuccess: (data) => {
      toast.success(`Copied ${data.createdCount + data.updatedCount} targets from previous week`)
      refetchTargets()
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to copy targets')
    },
  })

  const handleTargetChange = (userId: number, value: string) => {
    // Only allow numbers and decimal point
    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return
    
    setTargetEdits(prev => ({
      ...prev,
      [userId]: value,
    }))
    setHasChanges(true)
  }

  const handleSave = () => {
    saveTargetsMutation.mutate()
  }

  const handleCopyFromPrevious = () => {
    copyFromPreviousMutation.mutate()
  }

  const handlePreviousWeek = () => {
    setWeekOffset(prev => prev - 1)
  }

  const handleNextWeek = () => {
    setWeekOffset(prev => prev + 1)
  }

  const handleCurrentWeek = () => {
    setWeekOffset(0)
  }

  const formatWeekRange = (startDate: string, endDate: string): string => {
    const start = new Date(startDate)
    const end = new Date(endDate)
    const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${start.getFullYear()}`
  }

  const isCurrentWeek = weekOffset === 0
  const isPastWeek = weekOffset < 0
  const canEdit = teamTargets?.weekInfo?.canEdit ?? true
  
  // Back navigation path based on user role
  const backPath = isTeamLead ? '/teamlead/team-management' : '/admin/employee-targets'

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {isTeamLead && urlTeamId && (
                <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              )}
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Employee Weekly Targets</h1>
                <p className="text-sm text-slate-600">
                  Set and manage weekly productivity targets for employees
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      {isTeamLead ? <TeamLeadNav /> : <AdminNav />}

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Controls Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-blue-600" />
              Target Settings
            </CardTitle>
            <CardDescription>
              Select a team and week to view or modify employee targets
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              {/* Team Selector */}
              <div className="space-y-2">
                <Label htmlFor="team-select">Team</Label>
                <Select
                  value={selectedTeamId?.toString() || ''}
                  onValueChange={(value) => setSelectedTeamId(parseInt(value))}
                  disabled={loadingTeams}
                >
                  <SelectTrigger className="w-[220px]" id="team-select">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team: Team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Week Navigation */}
              <div className="space-y-2">
                <Label>Week</Label>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handlePreviousWeek}
                    title="Previous Week"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <div className="min-w-[200px] text-center">
                    {teamTargets?.weekInfo ? (
                      <div>
                        <div className="font-medium">
                          {formatWeekRange(teamTargets.weekInfo.weekStartDate, teamTargets.weekInfo.weekEndDate)}
                        </div>
                        <div className="flex items-center justify-center gap-2 mt-1">
                          {isCurrentWeek && (
                            <Badge variant="default" className="text-xs">Current Week</Badge>
                          )}
                          {isPastWeek && (
                            <Badge variant="secondary" className="text-xs">Past Week</Badge>
                          )}
                          {!canEdit && (
                            <Badge variant="destructive" className="text-xs">Locked</Badge>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Select a team</span>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleNextWeek}
                    title="Next Week"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  
                  {!isCurrentWeek && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleCurrentWeek}
                      className="ml-2"
                    >
                      Today
                    </Button>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={handleCopyFromPrevious}
                  disabled={!selectedTeamId || !canEdit || copyFromPreviousMutation.isPending}
                >
                  {copyFromPreviousMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  Copy from Previous Week
                </Button>
                
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || !canEdit || saveTargetsMutation.isPending}
                >
                  {saveTargetsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Targets
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Targets Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              Team Members
              {teamTargets && (
                <Badge variant="outline" className="ml-2">
                  {teamTargets.members?.length || 0} members
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              {teamTargets?.teamName || 'Select a team to view members'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingTargets ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !selectedTeamId ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select a team to view and manage employee targets</p>
              </div>
            ) : teamTargets?.members && teamTargets.members.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Employee</TableHead>
                    <TableHead className="w-[150px]">Previous Target</TableHead>
                    <TableHead className="w-[200px]">Current Target</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamTargets.members.map((member: TeamMemberTargetEntry) => {
                    const currentValue = targetEdits[member.userId] ?? ''
                    const originalValue = member.currentTarget?.toString() || ''
                    const hasChanged = currentValue !== originalValue
                    
                    return (
                      <TableRow key={member.userId}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{member.userName || member.userName}</div>
                            <div className="text-sm text-muted-foreground">@{member.userName}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {member.previousTarget !== null ? (
                            <span className="text-muted-foreground">{member.previousTarget}</span>
                          ) : (
                            <span className="text-muted-foreground italic">Not set</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="text"
                            value={currentValue}
                            onChange={(e) => handleTargetChange(member.userId, e.target.value)}
                            placeholder="0"
                            className={`w-24 text-center ${hasChanged ? 'border-blue-500' : ''}`}
                            disabled={!canEdit}
                          />
                        </TableCell>
                        <TableCell>
                          {hasChanged ? (
                            <Badge variant="outline" className="bg-blue-50 text-blue-700">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Modified
                            </Badge>
                          ) : currentValue && currentValue !== '0' ? (
                            <Badge variant="outline" className="bg-green-50 text-green-700">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Set
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-gray-50 text-gray-500">
                              Default
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No team members found</p>
              </div>
            )}

            {/* Save reminder */}
            {hasChanges && canEdit && (
              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-800">
                  <AlertCircle className="h-5 w-5" />
                  <span>You have unsaved changes</span>
                </div>
                <Button onClick={handleSave} disabled={saveTargetsMutation.isPending}>
                  {saveTargetsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save Changes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default EmployeeTargetsPage
