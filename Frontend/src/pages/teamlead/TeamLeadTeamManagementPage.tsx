import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { teamsApi, usersApi } from '../../services/api'
import type { Team, TeamWithMembers, User, TeamUpdate } from '../../types'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import { MultiSelect } from '../../components/ui/multi-select'
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
  Loader2, 
  AlertCircle,
  RefreshCw,
  UserCog,
  Search,
  X,
  Target
} from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

// Available states and products (can be configured)
const AVAILABLE_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming'
]

const AVAILABLE_PRODUCTS = [
  'Full Search', 'Current Owner', 'Two Owner', 'Update', 'Refinance',
  'Commercial', 'Construction', 'Foreclosure', 'REO', 'Short Sale'
]

// Helper function to parse API error responses
const parseApiError = (error: any, defaultMsg: string = 'An error occurred'): string => {
  const detail = error.response?.data?.detail
  if (!detail) return defaultMsg
  
  if (typeof detail === 'string') {
    return detail
  } else if (Array.isArray(detail)) {
    // Handle Pydantic validation errors (422)
    return detail.map((err: any) => err.msg || err.message || JSON.stringify(err)).join(', ')
  } else if (typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail)
  }
  return defaultMsg
}

export const TeamLeadTeamManagementPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  
  const [teams, setTeams] = useState<Team[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | null>(null)
  
  // Dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState<TeamUpdate & { isActive?: boolean }>({
    name: '',
    teamLeadId: undefined,
    states: [],
    products: [],
    isActive: true,
    dailyTarget: 10,
    singleSeatScore: 1.0,
    step1Score: 0.5,
    step2Score: 0.5,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  // Filter states
  const [filterName, setFilterName] = useState('')
  const [filterProduct, setFilterProduct] = useState<string>('all')
  const [filterState, setFilterState] = useState<string>('all')

  useEffect(() => {
    if (user) {
      fetchData()
    }
  }, [user])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Fetch teams where the current user is the team lead
      const teamsRes = await teamsApi.myTeams()
      
      // Fetch users from the same organization for team lead assignment
      const usersRes = await usersApi.list({ orgId: user?.orgId ?? undefined, isActive: true })
      
      setTeams(teamsRes.items || [])
      setUsers(usersRes.items || [])
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast.error('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateTeam = async () => {
    if (!selectedTeam) return
    setError('')

    if (!formData.name?.trim()) {
      setError('Team name is required')
      return
    }

    setIsSubmitting(true)
    try {
      const updateData: TeamUpdate = {
        name: formData.name,
        teamLeadId: formData.teamLeadId || null,
        isActive: formData.isActive ?? true,
        dailyTarget: formData.dailyTarget,
        singleSeatScore: formData.singleSeatScore,
        step1Score: formData.step1Score,
        step2Score: formData.step2Score,
        states: formData.states || [],
        products: formData.products || [],
      }
      await teamsApi.update(selectedTeam.id, updateData)
      
      toast.success('Team updated successfully!')
      setEditDialogOpen(false)
      resetForm()
      fetchData()
    } catch (error: any) {
      const errorMsg = parseApiError(error)
      setError(errorMsg)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  // NOTE: handleEditTeam is kept for future use when team editing UI is needed
  // const handleEditTeam = async (team: Team) => {
  //   setFormData({
  //     name: team.name,
  //     teamLeadId: team.teamLeadId || undefined,
  //     states: team.states?.map(s => s.state) || [],
  //     products: team.products?.map(p => p.productType) || [],
  //     isActive: team.isActive,
  //     dailyTarget: team.dailyTarget ?? 10,
  //     singleSeatScore: team.singleSeatScore ?? 1.0,
  //     step1Score: team.step1Score ?? 0.5,
  //     step2Score: team.step2Score ?? 0.5,
  //   })
  //   setSelectedTeam(team as TeamWithMembers)
  //   setEditDialogOpen(true)
  // }

  const handleManageMembers = (team: Team) => {
    navigate(`/teamlead/teams/${team.id}/members`)
  }

  const handleSetTargets = (team: Team) => {
    navigate(`/teamlead/teams/${team.id}/targets`)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      teamLeadId: undefined,
      states: [],
      products: [],
      isActive: true,
      dailyTarget: 10,
      singleSeatScore: 1.0,
      step1Score: 0.5,
      step2Score: 0.5,
    })
    setSelectedTeam(null)
    setError('')
  }

  const teamLeads = users.filter(u => u.userRole === 'team_lead' || u.userRole === 'admin')

  // Get unique states and products from all teams for filter dropdowns
  const allStatesInTeams = [...new Set(teams.flatMap(t => t.states?.map(s => s.state) || []))].sort()
  const allProductsInTeams = [...new Set(teams.flatMap(t => t.products?.map(p => p.productType) || []))].sort()

  // Filter teams based on filter criteria
  const filteredTeams = teams.filter(team => {
    // Filter by name
    if (filterName && !team.name.toLowerCase().includes(filterName.toLowerCase())) {
      return false
    }
    
    // Filter by product
    if (filterProduct !== 'all') {
      const teamProducts = team.products?.map(p => p.productType) || []
      if (!teamProducts.includes(filterProduct)) {
        return false
      }
    }
    
    // Filter by state
    if (filterState !== 'all') {
      const teamStates = team.states?.map(s => s.state) || []
      if (!teamStates.includes(filterState)) {
        return false
      }
    }
    
    return true
  })

  // Check if any filter is active
  const hasActiveFilters = filterName || filterProduct !== 'all' || filterState !== 'all'

  // Clear all filters
  const clearFilters = () => {
    setFilterName('')
    setFilterProduct('all')
    setFilterState('all')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />
      
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">My Teams Management</h1>
              <p className="text-sm text-slate-600">Manage your teams' settings and members</p>
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </header>
      
      <TeamLeadNav />
      
      <main className="container mx-auto px-4 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No teams assigned to you yet</p>
              <p className="text-sm text-slate-500 mt-2">Contact your administrator to get assigned as a team lead</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Filters Section */}
            <Card className="mb-6">
              <CardContent className="py-4">
                <div className="flex items-center gap-2 mb-3">
                  <Search className="h-4 w-4 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">Filter Teams</span>
                  {hasActiveFilters && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={clearFilters}
                      className="ml-auto text-xs h-7"
                    >
                      <X className="h-3 w-3 mr-1" />
                      Clear Filters
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Team Name Filter */}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Team Name</Label>
                    <Input
                      placeholder="Search by name..."
                      value={filterName}
                      onChange={(e) => setFilterName(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  
                  {/* State Filter */}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">State</Label>
                    <Select value={filterState} onValueChange={setFilterState}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All States" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All States</SelectItem>
                        {allStatesInTeams.map(state => (
                          <SelectItem key={state} value={state}>{state}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Product Filter */}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Product</Label>
                    <Select value={filterProduct} onValueChange={setFilterProduct}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Products" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Products</SelectItem>
                        {allProductsInTeams.map(product => (
                          <SelectItem key={product} value={product}>{product}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Teams Table Card */}
            <Card>
              <CardHeader>
                <CardTitle>Your Teams ({filteredTeams.length}{filteredTeams.length !== teams.length ? ` of ${teams.length}` : ''})</CardTitle>
                <CardDescription>Manage the teams you lead</CardDescription>
              </CardHeader>
              <CardContent>
                {/* Table */}
                {filteredTeams.length === 0 ? (
                  <div className="py-8 text-center">
                    <Search className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-50" />
                    <p className="text-muted-foreground">No teams match your filters</p>
                    <Button variant="link" onClick={clearFilters} className="mt-2">
                      Clear filters
                    </Button>
                  </div>
                ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Team Name</TableHead>
                      <TableHead className="w-[200px]">States</TableHead>
                      <TableHead className="w-[250px]">Products</TableHead>
                      <TableHead className="w-[100px]">Members</TableHead>
                      <TableHead className="text-right w-[150px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTeams.map((team) => (
                      <TableRow key={team.id}>
                        <TableCell className="font-medium py-3">{team.name}</TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {(team.states || []).slice(0, 3).map((s) => (
                              <Badge key={s.id} variant="secondary" className="text-xs">
                                {s.state}
                              </Badge>
                            ))}
                            {(team.states || []).length > 3 && (
                              <Badge variant="outline" className="text-xs">
                                +{team.states.length - 3}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {(team.products || []).slice(0, 2).map((p) => (
                              <Badge key={p.id} variant="secondary" className="text-xs">
                                {p.productType}
                              </Badge>
                            ))}
                            {(team.products || []).length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{team.products.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="outline">
                            {/* This would show member count if available in the Team type */}
                            <Users className="h-3 w-3 mr-1" />
                            Team
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Manage Members"
                              onClick={() => handleManageMembers(team)}
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Set Employee Targets"
                              onClick={() => handleSetTargets(team)}
                            >
                              <Target className="h-4 w-4" />
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
          </>
        )}

        {/* Edit Team Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={(open) => { if (!open) resetForm(); setEditDialogOpen(open); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Team</DialogTitle>
              <DialogDescription>Update team information, states, and products</DialogDescription>
            </DialogHeader>
            
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-6 py-4">
              {/* Team Name */}
              <div className="space-y-2">
                <Label htmlFor="edit-name">Team Name *</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="Enter team name"
                />
              </div>

              {/* Team Lead */}
              <div className="space-y-2">
                <Label>Team Lead</Label>
                <Select
                  value={formData.teamLeadId?.toString() || 'none'}
                  onValueChange={(value) => setFormData({...formData, teamLeadId: value === 'none' ? undefined : parseInt(value)})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select team lead" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No team lead</SelectItem>
                    {teamLeads.map((lead) => (
                      <SelectItem key={lead.id} value={lead.id.toString()}>
                        {lead.userName} ({lead.userRole.replace('_', ' ')})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* States */}
              <div className="space-y-2">
                <Label>States</Label>
                <MultiSelect
                  options={AVAILABLE_STATES}
                  selected={formData.states || []}
                  onChange={(states) => setFormData({...formData, states})}
                  placeholder="Select states..."
                  maxDisplayed={5}
                />
              </div>

              {/* Products */}
              <div className="space-y-2">
                <Label>Products</Label>
                <MultiSelect
                  options={AVAILABLE_PRODUCTS}
                  selected={formData.products || []}
                  onChange={(products) => setFormData({...formData, products})}
                  placeholder="Select products..."
                  maxDisplayed={5}
                />
              </div>

              {/* Productivity Settings */}
              <div className="pt-4 border-t">
                <h4 className="text-sm font-medium text-slate-700 mb-3">Productivity Settings</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-dailyTarget">Daily Target *</Label>
                    <Input
                      id="edit-dailyTarget"
                      type="number"
                      min={1}
                      max={100}
                      value={formData.dailyTarget ?? 10}
                      onChange={(e) => setFormData({...formData, dailyTarget: parseInt(e.target.value) || 10})}
                    />
                    <p className="text-xs text-muted-foreground">Orders per day per employee</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-singleSeatScore">Single Seat Score *</Label>
                    <Input
                      id="edit-singleSeatScore"
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={formData.singleSeatScore ?? 1.0}
                      onChange={(e) => setFormData({...formData, singleSeatScore: parseFloat(e.target.value) || 1.0})}
                    />
                    <p className="text-xs text-muted-foreground">Score for both steps by same user</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-step1Score">Step 1 Score *</Label>
                    <Input
                      id="edit-step1Score"
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={formData.step1Score ?? 0.5}
                      onChange={(e) => setFormData({...formData, step1Score: parseFloat(e.target.value) || 0.5})}
                    />
                    <p className="text-xs text-muted-foreground">Score for Step 1 only</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-step2Score">Step 2 Score *</Label>
                    <Input
                      id="edit-step2Score"
                      type="number"
                      min={0.1}
                      max={10}
                      step={0.1}
                      value={formData.step2Score ?? 0.5}
                      onChange={(e) => setFormData({...formData, step2Score: parseFloat(e.target.value) || 0.5})}
                    />
                    <p className="text-xs text-muted-foreground">Score for Step 2 only</p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { resetForm(); setEditDialogOpen(false); }}>
                Cancel
              </Button>
              <Button onClick={handleUpdateTeam} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

export default TeamLeadTeamManagementPage
