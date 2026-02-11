import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { teamsApi, usersApi, organizationsApi, faNamesApi } from '../../services/api'
import { getInitials, handleLogoutFlow, parseApiError } from '../../utils/helpers'
import type { Team, TeamWithMembers, User, Organization, TeamCreate, TeamUpdate, FAName } from '../../types'
import { Button } from '../../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Badge } from '../../components/ui/badge'
import { MultiSelect } from '../../components/ui/multi-select'
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
  Users, 
  Pencil, 
  Trash2, 
  Plus, 
  Loader2, 
  AlertCircle,
  Eye,
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



export const TeamManagementPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  
  const [teams, setTeams] = useState<Team[]>([])
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [allFANames, setAllFANames] = useState<FAName[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTeam, setSelectedTeam] = useState<TeamWithMembers | null>(null)
  
  // For superadmin: selected org for filtering (default to 'all' / null)
  const [selectedOrgId, setSelectedOrgId] = useState<number | null>(
    user?.userRole === 'superadmin' ? null : (user?.orgId || null)
  )
  const [loadingUsers, setLoadingUsers] = useState(false)
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [viewDialogOpen, setViewDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  
  // Form states
  const [formData, setFormData] = useState<TeamCreate & { isActive?: boolean }>({
    name: '',
    orgId: user?.orgId || 0,
    teamLeadId: undefined,
    states: [],
    products: [],
    faNames: [],
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
  const [filterStatus, setFilterStatus] = useState<string>('all')

  useEffect(() => {
    if (!user || !['admin', 'superadmin'].includes(user.userRole)) {
      navigate('/login')
      return
    }
    fetchData()
  }, [user, navigate])

  // Re-fetch when selectedOrgId changes (for superadmin)
  useEffect(() => {
    if (user?.userRole === 'superadmin') {
      fetchData()
    }
  }, [selectedOrgId])

  const fetchData = async () => {
    try {
      setLoading(true)
      // For admin, use their orgId; for superadmin, use selectedOrgId or fetch all
      // Convert null to undefined for API compatibility
      const orgIdToFetch = user?.userRole === 'superadmin' 
        ? (selectedOrgId ?? undefined) 
        : (user?.orgId ?? undefined)
      
      const [teamsRes, usersRes, faNamesRes] = await Promise.all([
        teamsApi.list({ orgId: orgIdToFetch, isActive: true }),
        usersApi.list({ orgId: orgIdToFetch, isActive: true }),
        faNamesApi.list({ activeOnly: true, limit: 500 })
      ])
      
      setTeams(teamsRes.items || [])
      setUsers(usersRes.items || [])
      setAllFANames(faNamesRes.items || [])

      if (user?.userRole === 'superadmin') {
        const orgsRes = await organizationsApi.list({ isActive: true })
        setOrganizations(orgsRes.items || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
      toast.error('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  // Fetch users when form org changes (for superadmin)
  const fetchUsersForOrg = async (orgId: number) => {
    try {
      setLoadingUsers(true)
      const usersRes = await usersApi.list({ orgId, isActive: true })
      setUsers(usersRes.items || [])
    } catch (error) {
      console.error('Failed to fetch users:', error)
      toast.error('Failed to load users for organization')
    } finally {
      setLoadingUsers(false)
    }
  }

  // When form org changes, fetch users for that org
  const handleFormOrgChange = (orgId: number) => {
    setFormData(prev => ({
      ...prev,
      orgId,
      teamLeadId: undefined // Clear team lead when org changes
    }))
    fetchUsersForOrg(orgId)
  }

  const handleCreateTeam = async () => {
    setError('')
    
    if (!formData.name.trim()) {
      setError('Team name is required')
      return
    }

    if (!formData.orgId) {
      setError('Organization is required')
      return
    }

    setIsSubmitting(true)
    try {
      await teamsApi.create(formData)
      toast.success('Team created successfully!')
      setCreateDialogOpen(false)
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
        faNames: formData.faNames || [],
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

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return

    setIsSubmitting(true)
    try {
      await teamsApi.delete(selectedTeam.id)
      toast.success('Team deleted successfully!')
      setDeleteDialogOpen(false)
      setSelectedTeam(null)
      fetchData()
    } catch (error: any) {
      const errorMsg = parseApiError(error)
      toast.error(errorMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleViewTeam = async (team: Team) => {
    try {
      const teamWithMembers = await teamsApi.get(team.id)
      setSelectedTeam(teamWithMembers)
      setViewDialogOpen(true)
    } catch (error) {
      toast.error('Failed to load team details')
    }
  }

  const handleEditTeam = async (team: Team) => {
    try {
      setLoadingUsers(true)
      
      // Load users from team's organization
      const usersRes = await usersApi.list({ orgId: team.orgId, isActive: true })
      setUsers(usersRes.items || [])
      
      // Load full team details with members
      const teamWithMembers = await teamsApi.get(team.id)
      setSelectedTeam(teamWithMembers)
      
      // Convert FA name strings to IDs for the form
      const faNameIds = teamWithMembers.faNames
        ?.map(fnObj => {
          // fnObj might be a string (from old data) or an object with faName property
          const faNameString = typeof fnObj === 'string' ? fnObj : fnObj.faName
          const foundFaName = allFANames.find(fn => fn.name === faNameString)
          return foundFaName?.id
        })
        .filter((id): id is number => id !== undefined) || []
      
      setFormData({
        name: teamWithMembers.name,
        orgId: teamWithMembers.orgId,
        teamLeadId: teamWithMembers.teamLeadId || undefined,
        states: teamWithMembers.states?.map(s => s.state) || [],
        products: teamWithMembers.products?.map(p => p.productType) || [],
        faNames: faNameIds,  // Now using IDs
        isActive: teamWithMembers.isActive,
        dailyTarget: teamWithMembers.dailyTarget ?? 10,
        singleSeatScore: teamWithMembers.singleSeatScore ?? 1.0,
        step1Score: teamWithMembers.step1Score ?? 0.5,
        step2Score: teamWithMembers.step2Score ?? 0.5,
      })
      
      setEditDialogOpen(true)
    } catch (error) {
      console.error('Error loading team details:', error)
      toast.error('Failed to load team details')
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleDeleteClick = (team: Team) => {
    setSelectedTeam(team as TeamWithMembers)
    setDeleteDialogOpen(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      orgId: user?.orgId || 0,
      teamLeadId: undefined,
      states: [],
      products: [],
      faNames: [],
      isActive: true,
      dailyTarget: 10,
      singleSeatScore: 1.0,
      step1Score: 0.5,
      step2Score: 0.5,
    })
    setSelectedTeam(null)
    setError('')
    
    // Refetch users for current org filter (in case we loaded users from another org for editing)
    if (user?.userRole === 'superadmin') {
      const orgIdToFetch = selectedOrgId || undefined
      usersApi.list({ orgId: orgIdToFetch, isActive: true }).then(res => {
        setUsers(res.items || [])
      }).catch(console.error)
    }
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
    
    // Filter by status
    if (filterStatus !== 'all') {
      const isActive = filterStatus === 'active'
      if (team.isActive !== isActive) {
        return false
      }
    }
    
    return true
  })

  // Check if any filter is active
  const hasActiveFilters = filterName || filterProduct !== 'all' || filterState !== 'all' || filterStatus !== 'all'

  // Clear all filters
  const clearFilters = () => {
    setFilterName('')
    setFilterProduct('all')
    setFilterState('all')
    setFilterStatus('all')
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <Toaster position="top-right" />
      
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Team Management</h1>
              <p className="text-sm text-slate-600">Create and manage teams</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline"
                onClick={() => navigate('/admin/score-management')}
              >
                <Target className="h-4 w-4 mr-2" />
                Score Management
              </Button>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => { resetForm(); setCreateDialogOpen(true); }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Team
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Create New Team</DialogTitle>
                  <DialogDescription>Set up a new team with states and products</DialogDescription>
                </DialogHeader>
                
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Team Name *</Label>
                    <Input
                      id="name"
                      placeholder="e.g., Alpha Team"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>

                  {user?.userRole === 'superadmin' && (
                    <div className="space-y-2">
                      <Label>Organization *</Label>
                      <Select
                        value={formData.orgId ? formData.orgId.toString() : undefined}
                        onValueChange={(value) => handleFormOrgChange(parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id.toString()}>
                              {org.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Team Lead (Optional)</Label>
                    <Select
                      value={formData.teamLeadId?.toString() || 'none'}
                      onValueChange={(value) => setFormData({...formData, teamLeadId: value === 'none' ? undefined : parseInt(value)})}
                      disabled={loadingUsers || (user?.userRole === 'superadmin' && !formData.orgId)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingUsers ? "Loading users..." : "Select team lead"} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No team lead</SelectItem>
                        {teamLeads.map((lead) => (
                          <SelectItem key={lead.id} value={lead.id.toString()}>
                            {lead.userName} ({lead.userRole})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {user?.userRole === 'superadmin' && !formData.orgId && (
                      <p className="text-xs text-orange-600">Select an organization first</p>
                    )}
                  </div>

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

                  {/* FA Names Selection - MultiSelect Dropdown */}
                  <div className="space-y-2">
                    <Label>FA Names (File Alias Names)</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Select FA names that can be used when creating orders for this team
                    </p>
                    <MultiSelect
                      options={allFANames.map(fn => fn.name)}
                      selected={formData.faNames?.map(id => {
                        const faName = allFANames.find(fn => fn.id === id)
                        return faName?.name || ''
                      }).filter(name => name !== '') || []}
                      onChange={(selectedNames) => {
                        const selectedIds = selectedNames
                          .map(name => allFANames.find(fn => fn.name === name)?.id)
                          .filter((id): id is number => id !== undefined)
                        setFormData(prev => ({
                          ...prev,
                          faNames: selectedIds
                        }))
                      }}
                      placeholder="Select FA names..."
                      maxDisplayed={5}
                    />
                    {formData.faNames && formData.faNames.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.faNames.length} FA name(s) selected
                      </p>
                    )}
                  </div>

                  {/* Productivity Settings */}
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium text-slate-700 mb-3">Productivity Settings</h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dailyTarget">Daily Target *</Label>
                        <Input
                          id="dailyTarget"
                          type="number"
                          min={1}
                          max={100}
                          value={formData.dailyTarget ?? 10}
                          onChange={(e) => setFormData({...formData, dailyTarget: parseInt(e.target.value) || 10})}
                        />
                        <p className="text-xs text-muted-foreground">Orders per day per employee</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="singleSeatScore">Single Seat Score *</Label>
                        <Input
                          id="singleSeatScore"
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
                        <Label htmlFor="step1Score">Step 1 Score *</Label>
                        <Input
                          id="step1Score"
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
                        <Label htmlFor="step2Score">Step 2 Score *</Label>
                        <Input
                          id="step2Score"
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
                  <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTeam} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Create Team'
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            </div>
          </div>
        </div>
      </header>
      
      <AdminNav />
      
      <main className="container mx-auto px-4 py-8">
        {/* Organization Filter for Superadmin */}
        {user?.userRole === 'superadmin' && (
          <Card className="mb-6">
            <CardContent className="py-4">
              <div className="flex items-center gap-4">
                <Label className="whitespace-nowrap">Filter by Organization:</Label>
                <Select
                  value={selectedOrgId ? selectedOrgId.toString() : 'all'}
                  onValueChange={(value) => {
                    const orgId = value === 'all' ? null : parseInt(value)
                    setSelectedOrgId(orgId)
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="All Organizations" />
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
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Refresh
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : teams.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground">No teams found</p>
              <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Your First Team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Filters Section - Outside Card */}
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
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
                  
                  {/* Status Filter */}
                  <div className="space-y-1">
                    <Label className="text-xs text-slate-500">Status</Label>
                    <Select value={filterStatus} onValueChange={setFilterStatus}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Teams Table Card */}
            <Card>
              <CardHeader>
                <CardTitle>Teams ({filteredTeams.length}{filteredTeams.length !== teams.length ? ` of ${teams.length}` : ''})</CardTitle>
                <CardDescription>Manage your organization's teams</CardDescription>
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
                      <TableHead className="w-[100px]">Status</TableHead>
                      <TableHead className="text-right w-[180px]">Actions</TableHead>
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
                          <Badge variant={team.isActive ? 'default' : 'secondary'}>
                            {team.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="View Team"
                              onClick={() => handleViewTeam(team)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Manage Members"
                              onClick={() => navigate(`/admin/teams/${team.id}/members`)}
                            >
                              <UserCog className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit Team"
                              onClick={() => handleEditTeam(team)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="text-destructive hover:text-destructive"
                              title="Delete Team"
                              onClick={() => handleDeleteClick(team)}
                            >
                              <Trash2 className="h-4 w-4" />
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

        {/* View Team Dialog */}
        <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
          <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden [&>button]:hidden">
            {selectedTeam && (
              <>
                {/* Header */}
                <DialogHeader className="px-6 py-5 border-b">
                  <div className="flex items-center gap-3">
                    <DialogTitle className="text-lg font-semibold">{selectedTeam.name}</DialogTitle>
                    <span className={`text-xs px-2 py-1 rounded ${selectedTeam.isActive ? 'bg-slate-100 text-slate-700' : 'bg-slate-100 text-slate-500'}`}>
                      {selectedTeam.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <DialogDescription className="text-sm text-slate-500 mt-1">
                    Lead: {selectedTeam.members?.find(m => m.teamRole === 'lead')?.userName || 
                           selectedTeam.members?.find(m => m.userId === selectedTeam.teamLeadId)?.userName ||
                           'Not assigned'}
                  </DialogDescription>
                </DialogHeader>

                {/* Content */}
                <div className="px-6 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
                  {/* States */}
                  <div>
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                      States ({selectedTeam.states?.length || 0})
                    </h3>
                    {selectedTeam.states && selectedTeam.states.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTeam.states.map(s => (
                          <span key={s.id} className="text-sm px-2 py-0.5 bg-slate-100 rounded">
                            {s.state}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">None</p>
                    )}
                  </div>

                  {/* Products */}
                  <div>
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                      Products ({selectedTeam.products?.length || 0})
                    </h3>
                    {selectedTeam.products && selectedTeam.products.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTeam.products.map(p => (
                          <span key={p.id} className="text-sm px-2 py-0.5 bg-slate-100 rounded">
                            {p.productType}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">None</p>
                    )}
                  </div>

                  {/* FA Names */}
                  <div>
                    <h4 className="text-sm font-medium text-slate-700 mb-2">
                      FA Names ({selectedTeam.faNames?.length || 0})
                    </h4>
                    {selectedTeam.faNames && selectedTeam.faNames.length > 0 ? (
                      <div className="flex flex-wrap gap-1.5">
                        {selectedTeam.faNames.map((fnObj, idx) => {
                          // fnObj might be string or object with faName property
                          const displayName = typeof fnObj === 'string' ? fnObj : fnObj.faName || fnObj
                          return (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {displayName}
                            </Badge>
                          )
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No FA names assigned</p>
                    )}
                  </div>

                  {/* Productivity Settings */}
                  <div>
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                      Productivity Settings
                    </h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-slate-50 rounded-md p-3">
                        <p className="text-xs text-slate-500">Daily Target</p>
                        <p className="text-lg font-semibold">{selectedTeam.dailyTarget ?? 10}</p>
                        <p className="text-xs text-slate-400">orders/day</p>
                      </div>
                      <div className="bg-slate-50 rounded-md p-3">
                        <p className="text-xs text-slate-500">Single Seat Score</p>
                        <p className="text-lg font-semibold">{selectedTeam.singleSeatScore ?? 1.0}</p>
                        <p className="text-xs text-slate-400">both steps</p>
                      </div>
                      <div className="bg-slate-50 rounded-md p-3">
                        <p className="text-xs text-slate-500">Step 1 Score</p>
                        <p className="text-lg font-semibold">{selectedTeam.step1Score ?? 0.5}</p>
                        <p className="text-xs text-slate-400">step 1 only</p>
                      </div>
                      <div className="bg-slate-50 rounded-md p-3">
                        <p className="text-xs text-slate-500">Step 2 Score</p>
                        <p className="text-lg font-semibold">{selectedTeam.step2Score ?? 0.5}</p>
                        <p className="text-xs text-slate-400">step 2 only</p>
                      </div>
                    </div>
                  </div>

                  {/* Members */}
                  <div>
                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                      Members ({selectedTeam.members?.length || 0})
                    </h3>
                    {selectedTeam.members && selectedTeam.members.length > 0 ? (
                      <div className="border rounded-md divide-y">
                        {selectedTeam.members.map((member) => (
                          <div key={member.id} className="px-3 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium">{member.userName}</p>
                              <p className="text-xs text-slate-500">@{member.userName}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-slate-600 capitalize">{member.userRole.replace('_', ' ')}</p>
                              <p className="text-xs text-slate-400 capitalize">{member.teamRole}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400">No members</p>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-3 border-t bg-slate-50">
                  <Button variant="outline" size="sm" onClick={() => setViewDialogOpen(false)} className="w-full">
                    Close
                  </Button>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

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

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.isActive ? 'active' : 'inactive'}
                  onValueChange={(value) => setFormData({...formData, isActive: value === 'active'})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Inactive teams won't be available for assignment
                </p>
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

              {/* FA Names Selection - MultiSelect Dropdown */}
              <div className="space-y-2">
                <Label>FA Names (File Alias Names)</Label>
                <p className="text-xs text-muted-foreground mb-2">
                  Select FA names that can be used when creating orders for this team
                </p>
                <MultiSelect
                  options={allFANames.map(fn => fn.name)}
                  selected={formData.faNames?.map(id => {
                    const faName = allFANames.find(fn => fn.id === id)
                    return faName?.name || ''
                  }).filter(name => name !== '') || []}
                  onChange={(selectedNames) => {
                    const selectedIds = selectedNames
                      .map(name => allFANames.find(fn => fn.name === name)?.id)
                      .filter((id): id is number => id !== undefined)
                    setFormData(prev => ({
                      ...prev,
                      faNames: selectedIds
                    }))
                  }}
                  placeholder="Select FA names..."
                  maxDisplayed={5}
                />
                {formData.faNames && formData.faNames.length > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {formData.faNames.length} FA name(s) selected
                  </p>
                )}
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

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Team</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedTeam?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDeleteTeam} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  'Delete'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}

export default TeamManagementPage
