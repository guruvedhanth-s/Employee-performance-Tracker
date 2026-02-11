import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '../../store/authStore'
import { teamsApi } from '../../services/api'
import { getInitials, handleLogoutFlow } from '../../utils/helpers'
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
import { AdminNav } from '../../components/layout/AdminNav'
import { 
  Settings,
  LogOut,
  Shield,
  Loader2,
  Save,
  Target,
  TrendingUp,
  Award,
  Info,
  CheckCircle2
} from 'lucide-react'
import toast from 'react-hot-toast'

export const ScoreManagementPage = () => {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)

  // Redirect if not admin
  if (!user || !['admin', 'superadmin'].includes(user.userRole)) {
    navigate('/login')
    return null
  }

  // Get all teams
  const { data: teamsData, isLoading: loadingTeams } = useQuery({
    queryKey: ['teams', user.orgId],
    queryFn: () => teamsApi.list({ orgId: user.orgId ?? undefined, isActive: true }),
    enabled: !!user,
  })

  const teams = teamsData?.items || []

  // Auto-select first team if none selected
  const teamId = selectedTeamId || teams[0]?.id || null
  if (teamId && teamId !== selectedTeamId) {
    setSelectedTeamId(teamId)
  }

  const currentTeam = teams.find(t => t.id === teamId)

  // Form state - store as strings to allow typing decimals
  const [monthlyTarget, setMonthlyTarget] = useState<string>('')
  const [step1Score, setStep1Score] = useState<string>('0.5')
  const [step2Score, setStep2Score] = useState<string>('0.5')
  const [singleSeatScore, setSingleSeatScore] = useState<string>('1.0')

  // Update form when team changes
  useEffect(() => {
    if (currentTeam) {
      setMonthlyTarget(currentTeam.monthlyTarget ? String(currentTeam.monthlyTarget) : '')
      setStep1Score(String(currentTeam.step1Score))
      setStep2Score(String(currentTeam.step2Score))
      setSingleSeatScore(String(currentTeam.singleSeatScore))
    }
  }, [currentTeam?.id])

  // Update team scores mutation
  const updateScores = useMutation({
    mutationFn: async () => {
      if (!teamId) throw new Error('No team selected')
      return teamsApi.update(teamId, {
        monthlyTarget: monthlyTarget ? parseInt(monthlyTarget) : null,
        step1Score: parseFloat(step1Score),
        step2Score: parseFloat(step2Score),
        singleSeatScore: parseFloat(singleSeatScore),
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teams'] })
      queryClient.invalidateQueries({ queryKey: ['productivity'] })
      toast.success('Score configuration updated successfully!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.detail || 'Failed to update scores')
    },
  })

  const handleLogout = () => {
    handleLogoutFlow(logout, navigate)
  }

  const handleSave = () => {
    updateScores.mutate()
  }

  const hasChanges = currentTeam && (
    (monthlyTarget ? parseInt(monthlyTarget) : null) !== (currentTeam.monthlyTarget ?? null) ||
    parseFloat(step1Score) !== currentTeam.step1Score ||
    parseFloat(step2Score) !== currentTeam.step2Score ||
    parseFloat(singleSeatScore) !== currentTeam.singleSeatScore
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Score Management</h1>
              <p className="text-sm text-slate-600">
                Configure productivity scoring for teams
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge variant="outline" className="px-3 py-1">
                <Shield className="w-3 h-3 mr-1" />
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
      <AdminNav />

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {loadingTeams ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : teams.length === 0 ? (
          <Card className="max-w-2xl mx-auto">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="h-16 w-16 text-slate-400 mb-4" />
              <h2 className="text-xl font-semibold text-slate-900 mb-2">No Teams Found</h2>
              <p className="text-slate-600 text-center">
                Create teams first before configuring scores.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {/* Info Banner */}
            <Card className="bg-blue-50 border-blue-200">
              <CardContent className="flex items-start gap-4 p-4">
                <Info className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-900">
                  <p className="font-semibold mb-1">About Score Configuration</p>
                  <p>
                    Configure scoring rules for each team to customize productivity calculations. 
                    Changes will affect all future productivity reports and employee performance metrics.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Team Selector */}
            <Card>
              <CardHeader>
                <CardTitle>Select Team</CardTitle>
                <CardDescription>Choose a team to configure its scoring rules</CardDescription>
              </CardHeader>
              <CardContent>
                <Select 
                  value={teamId?.toString() || ''} 
                  onValueChange={(value) => setSelectedTeamId(parseInt(value))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span>{team.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {team.states?.length || 0} states
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Score Configuration */}
            {currentTeam && (
              <>
                {/* Current Configuration Summary */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                      Current Configuration
                    </CardTitle>
                    <CardDescription>Active scoring rules for {currentTeam.name}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Target className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-slate-600">Monthly Target</span>
                        </div>
                        <div className="text-2xl font-bold">{currentTeam.monthlyTarget ?? '-'}</div>
                        <div className="text-xs text-muted-foreground">team score/month</div>
                      </div>
                      
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-slate-600">Step 1 Score</span>
                        </div>
                        <div className="text-2xl font-bold">{currentTeam.step1Score}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                      
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-orange-600" />
                          <span className="text-sm font-medium text-slate-600">Step 2 Score</span>
                        </div>
                        <div className="text-2xl font-bold">{currentTeam.step2Score}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                      
                      <div className="p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <Award className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-slate-600">Single Seat</span>
                        </div>
                        <div className="text-2xl font-bold">{currentTeam.singleSeatScore}</div>
                        <div className="text-xs text-muted-foreground">points</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Edit Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Update Scoring Configuration</CardTitle>
                    <CardDescription>
                      Modify the scoring rules for this team
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Monthly Team Target */}
                    <div className="space-y-2">
                      <Label htmlFor="monthlyTarget" className="flex items-center gap-2">
                        <Target className="h-4 w-4 text-green-600" />
                        Monthly Team Target
                      </Label>
                      <Input
                        id="monthlyTarget"
                        type="text"
                        value={monthlyTarget}
                        onChange={(e) => {
                          const value = e.target.value
                          // Only allow digits
                          if (value === '' || /^\d+$/.test(value)) {
                            setMonthlyTarget(value)
                          }
                        }}
                        placeholder="Enter monthly target"
                        className="max-w-xs"
                      />
                      <p className="text-xs text-muted-foreground">
                        Total target score for the entire team per month (shown on Team Lead dashboard)
                      </p>
                    </div>

                    {/* Score Multipliers */}
                    <div className="grid gap-6 md:grid-cols-3">
                      {/* Step 1 Score */}
                      <div className="space-y-2">
                        <Label htmlFor="step1Score" className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-purple-600" />
                          Step 1 Score
                        </Label>
                        <Input
                          id="step1Score"
                          type="text"
                          value={step1Score}
                          onChange={(e) => {
                            const value = e.target.value
                            // Only allow digits, decimal point, and max 2 decimal places
                            if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                              setStep1Score(value)
                            }
                          }}
                          placeholder="0.5"
                        />
                        <p className="text-xs text-muted-foreground">
                          Points for completing Step 1 only (0.1-10.0)
                        </p>
                      </div>

                      {/* Step 2 Score */}
                      <div className="space-y-2">
                        <Label htmlFor="step2Score" className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-orange-600" />
                          Step 2 Score
                        </Label>
                        <Input
                          id="step2Score"
                          type="text"
                          value={step2Score}
                          onChange={(e) => {
                            const value = e.target.value
                            // Only allow digits, decimal point, and max 2 decimal places
                            if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                              setStep2Score(value)
                            }
                          }}
                          placeholder="0.5"
                        />
                        <p className="text-xs text-muted-foreground">
                          Points for completing Step 2 only (0.1-10.0)
                        </p>
                      </div>

                      {/* Single Seat Score */}
                      <div className="space-y-2">
                        <Label htmlFor="singleSeatScore" className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-green-600" />
                          Single Seat Score
                        </Label>
                        <Input
                          id="singleSeatScore"
                          type="text"
                          value={singleSeatScore}
                          onChange={(e) => {
                            const value = e.target.value
                            // Only allow digits, decimal point, and max 2 decimal places
                            if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                              setSingleSeatScore(value)
                            }
                          }}
                          placeholder="1.0"
                        />
                        <p className="text-xs text-muted-foreground">
                          Points for completing both steps (0.1-10.0)
                        </p>
                      </div>
                    </div>

                    {/* Example Calculation */}
                    <div className="p-4 bg-slate-100 rounded-lg border border-slate-200">
                      <h4 className="font-semibold text-sm mb-3">Example Calculation</h4>
                      <div className="text-sm space-y-1 text-slate-700">
                        <p>If an employee completes in one day:</p>
                        <ul className="list-disc list-inside ml-2 space-y-1">
                          <li>2 Step 1 completions = 2 × {step1Score} = {(2 * parseFloat(step1Score || '0')).toFixed(1)} points</li>
                          <li>3 Step 2 completions = 3 × {step2Score} = {(3 * parseFloat(step2Score || '0')).toFixed(1)} points</li>
                          <li>5 Single Seat completions = 5 × {singleSeatScore} = {(5 * parseFloat(singleSeatScore || '0')).toFixed(1)} points</li>
                        </ul>
                        <p className="font-semibold mt-2">
                          Total Score: {((2 * parseFloat(step1Score || '0')) + (3 * parseFloat(step2Score || '0')) + (5 * parseFloat(singleSeatScore || '0'))).toFixed(1)} points
                        </p>
                        {monthlyTarget && (
                          <p>
                            Team Productivity: {((((2 * parseFloat(step1Score || '0')) + (3 * parseFloat(step2Score || '0')) + (5 * parseFloat(singleSeatScore || '0'))) / parseInt(monthlyTarget || '1')) * 100).toFixed(2)}% of monthly target
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex items-center gap-4 pt-4">
                      <Button
                        onClick={handleSave}
                        disabled={!hasChanges || updateScores.isPending}
                        size="lg"
                      >
                        {updateScores.isPending ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="mr-2 h-4 w-4" />
                            Save Configuration
                          </>
                        )}
                      </Button>
                      {hasChanges && (
                        <Badge variant="secondary" className="text-yellow-700 bg-yellow-100">
                          Unsaved changes
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default ScoreManagementPage
