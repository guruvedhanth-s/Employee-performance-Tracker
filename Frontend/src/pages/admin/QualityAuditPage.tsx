import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { qualityAuditApi, usersApi, teamsApi } from '../../services/api'
import type { QualityAudit, QualityAuditCreate, User, Team, ProcessTypeOFE } from '../../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { AdminNav } from '../../components/layout/AdminNav'
import { TeamLeadNav } from '../../components/layout/TeamLeadNav'
import { 
  ClipboardCheck, 
  Plus, 
  RefreshCw,
  Loader2,
  PencilLine,
  Trash2,
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import toast from 'react-hot-toast'

export const QualityAuditPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  
  const [audits, setAudits] = useState<QualityAudit[]>([])
  const [examiners, setExaminers] = useState<User[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [filteredTeams, setFilteredTeams] = useState<Team[]>([])
  const [filteredExaminersForFilter, setFilteredExaminersForFilter] = useState<User[]>([])
  const [processTypes, setProcessTypes] = useState<ProcessTypeOFE[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  
  // Determine if user is team lead based on role
  const isTeamLead = user?.userRole === 'team_lead'
  
  // Form state
  const [formData, setFormData] = useState<QualityAuditCreate>({
    examinerId: 0,
    teamId: 0,
    processType: '',
    totalFilesReviewed: undefined,
    filesWithError: 0,
    totalErrors: 0,
    filesWithCceError: 0,
    auditDate: new Date().toISOString().split('T')[0],
    auditPeriodStart: null,
    auditPeriodEnd: null,
  })
  
  // Filter state
  const [filterTeamId, setFilterTeamId] = useState<number | null>(null)
  const [filterExaminerId, setFilterExaminerId] = useState<number | null>(null)

  useEffect(() => {
    if (!user || !['admin', 'superadmin', 'team_lead'].includes(user.userRole)) {
      navigate('/login')
    } else {
      fetchInitialData()
    }
  }, [user, navigate])

  useEffect(() => {
    if (user) {
      fetchAudits()
    }
  }, [filterTeamId, filterExaminerId])

  // Filter teams based on selected examiner
  useEffect(() => {
    const filterTeamsByExaminer = async () => {
      if (formData.examinerId && formData.examinerId > 0) {
        try {
          const userTeams = await usersApi.getTeams(formData.examinerId)
          const userTeamIds = userTeams.map(ut => ut.teamId)
          const filtered = teams.filter(team => userTeamIds.includes(team.id))
          setFilteredTeams(filtered)
          
          // Reset teamId if it's not in the filtered list
          if (formData.teamId > 0 && !userTeamIds.includes(formData.teamId)) {
            setFormData(prev => ({ ...prev, teamId: 0 }))
          }
        } catch (error) {
          console.error('Failed to fetch user teams:', error)
          setFilteredTeams(teams) // Fallback to all teams
        }
      } else {
        setFilteredTeams(teams)
      }
    }
    
    filterTeamsByExaminer()
  }, [formData.examinerId, teams])

  // Filter examiners based on selected team in filter section
  useEffect(() => {
    const filterExaminersByTeam = async () => {
      if (filterTeamId) {
        try {
          const teamMembers = await teamsApi.getMembers(filterTeamId)
          const memberIds = teamMembers.map(m => m.userId)
          const filtered = examiners.filter(e => memberIds.includes(e.id))
          setFilteredExaminersForFilter(filtered)
          
          // Reset examiner filter if not in the filtered list
          if (filterExaminerId && !memberIds.includes(filterExaminerId)) {
            setFilterExaminerId(null)
          }
        } catch (error) {
          console.error('Failed to fetch team members:', error)
          setFilteredExaminersForFilter(examiners)
        }
      } else {
        setFilteredExaminersForFilter(examiners)
      }
    }
    
    filterExaminersByTeam()
  }, [filterTeamId, examiners, filterExaminerId])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      
      // For team leads, fetch their teams first to filter examiners
      let teamLeadTeamIds: number[] = []
      if (isTeamLead && user) {
        const userProfile = await usersApi.get(user.id)
        teamLeadTeamIds = userProfile.teams
          ?.filter(t => t.isActive && t.teamIsActive)
          .map(t => t.teamId) || []
      }
      
      const [auditsRes, examinersRes, teamsRes, processTypesRes] = await Promise.all([
        qualityAuditApi.list(),
        usersApi.list(),
        teamsApi.list({ isActive: true }),
        qualityAuditApi.getProcessTypes(),
      ])
      
      // Filter teams and examiners for team leads
      let filteredTeamsData = teamsRes.items || []
      let filteredExaminersData = examinersRes.items || []
      
      if (isTeamLead && teamLeadTeamIds.length > 0) {
        // Filter to only team lead's teams
        filteredTeamsData = filteredTeamsData.filter(team => 
          teamLeadTeamIds.includes(team.id)
        )
        
        // Filter examiners to only those in team lead's teams
        // Get all team members from team lead's teams
        const teamMemberIds = new Set<number>()
        for (const team of filteredTeamsData) {
          try {
            const teamMembers = await teamsApi.getMembers(team.id)
            teamMembers.forEach(member => teamMemberIds.add(member.userId))
          } catch (error) {
            console.error(`Failed to fetch members for team ${team.id}:`, error)
          }
        }
        
        // Filter examiners to only team members
        filteredExaminersData = filteredExaminersData.filter(examiner => 
          teamMemberIds.has(examiner.id)
        )
      }
      
      setAudits(auditsRes.items || [])
      setExaminers(filteredExaminersData)
      setFilteredExaminersForFilter(filteredExaminersData)
      setTeams(filteredTeamsData)
      setProcessTypes(processTypesRes)
    } catch (error) {
      console.error('Failed to fetch initial data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const fetchAudits = async () => {
    try {
      const params: any = {}
      if (filterTeamId) params.teamId = filterTeamId
      if (filterExaminerId) params.examinerId = filterExaminerId
      
      const response = await qualityAuditApi.list(params)
      setAudits(response.items || [])
    } catch (error) {
      console.error('Failed to fetch audits:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.examinerId || !formData.teamId || !formData.processType) {
      toast.error('Please fill in all required fields')
      return
    }
    
    try {
      setSaving(true)
      
      if (editingId) {
        // Update existing audit
        const updateData = {
          processType: formData.processType,
          filesWithError: formData.filesWithError,
          totalErrors: formData.totalErrors,
          filesWithCceError: formData.filesWithCceError,
          auditDate: formData.auditDate,
          auditPeriodStart: formData.auditPeriodStart,
          auditPeriodEnd: formData.auditPeriodEnd,
        }
        await qualityAuditApi.update(editingId, updateData)
        toast.success('Quality audit updated successfully')
      } else {
        // Create new audit
        await qualityAuditApi.create(formData)
        toast.success('Quality audit created successfully')
      }
      
      // Reset form and refresh data
      resetForm()
      fetchAudits()
      setShowForm(false)
    } catch (error: any) {
      console.error('Failed to save quality audit:', error)
      toast.error(error.response?.data?.detail || 'Failed to save quality audit')
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (audit: QualityAudit) => {
    setEditingId(audit.id)
    setFormData({
      examinerId: audit.examinerId,
      teamId: audit.teamId,
      processType: audit.processType,
      filesWithError: audit.filesWithError,
      totalErrors: audit.totalErrors,
      filesWithCceError: audit.filesWithCceError,
      auditDate: audit.auditDate,
      auditPeriodStart: audit.auditPeriodStart,
      auditPeriodEnd: audit.auditPeriodEnd,
    })
    setShowForm(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this quality audit record?')) {
      return
    }
    
    try {
      await qualityAuditApi.delete(id)
      toast.success('Quality audit deleted successfully')
      fetchAudits()
    } catch (error) {
      console.error('Failed to delete quality audit:', error)
      toast.error('Failed to delete quality audit')
    }
  }

  const resetForm = () => {
    setEditingId(null)
    setFormData({
      examinerId: 0,
      teamId: 0,
      processType: '',
      filesWithError: 0,
      totalErrors: 0,
      filesWithCceError: 0,
      auditDate: new Date().toISOString().split('T')[0],
      auditPeriodStart: null,
      auditPeriodEnd: null,
    })
  }

  const getQualityBadge = (quality: number) => {
    const percentage = (quality * 100).toFixed(1)
    if (quality >= 0.9) return <span className="text-green-600 font-semibold">{percentage}%</span>
    if (quality >= 0.7) return <span className="text-blue-600 font-semibold">{percentage}%</span>
    if (quality >= 0.5) return <span className="text-yellow-600 font-semibold">{percentage}%</span>
    return <span className="text-red-600 font-semibold">{percentage}%</span>
  }

  const getQualityIcon = (quality: number) => {
    if (quality >= 0.9) return <CheckCircle2 className="h-4 w-4 text-green-600" />
    if (quality >= 0.7) return <AlertCircle className="h-4 w-4 text-blue-600" />
    return <XCircle className="h-4 w-4 text-red-600" />
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Quality Audit</h1>
              <p className="text-sm text-slate-600">Track file review errors and quality metrics</p>
            </div>
            <Button 
              onClick={() => {
                resetForm()
                setShowForm(!showForm)
              }}
            >
              {showForm ? (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  New Audit Entry
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      {isTeamLead ? <TeamLeadNav /> : <AdminNav />}

      <main className="container mx-auto px-4 py-8">
        {/* Data Entry Form */}
        {showForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{editingId ? 'Edit' : 'New'} Quality Audit Entry</CardTitle>
              <CardDescription>
                Enter file review error information. Total files reviewed will be fetched automatically from the database.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Examiner Selection */}
                  <div className="space-y-2">
                    <Label>Examiner Name *</Label>
                    <Select
                      value={formData.examinerId.toString()}
                      onValueChange={(value) => setFormData({ ...formData, examinerId: parseInt(value) })}
                      disabled={!!editingId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select examiner" />
                      </SelectTrigger>
                      <SelectContent>
                        {examiners.map((examiner) => (
                          <SelectItem key={examiner.id} value={examiner.id.toString()}>
                            {examiner.userName} ({examiner.userName})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Team Selection */}
                  <div className="space-y-2">
                    <Label>Team Name *</Label>
                    <Select
                      value={formData.teamId.toString()}
                      onValueChange={(value) => setFormData({ ...formData, teamId: parseInt(value) })}
                      disabled={!!editingId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select team" />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredTeams.map((team) => (
                          <SelectItem key={team.id} value={team.id.toString()}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Process Type */}
                  <div className="space-y-2">
                    <Label>Process *</Label>
                    <Select
                      value={formData.processType}
                      onValueChange={(value) => setFormData({ ...formData, processType: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select process type" />
                      </SelectTrigger>
                      <SelectContent>
                        {processTypes.map((pt) => (
                          <SelectItem key={pt.name} value={pt.name}>
                            {pt.name} (OFE: {pt.ofe})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      OFE is automatically set based on process type
                    </p>
                  </div>

                  {/* Audit Date */}
                  <div className="space-y-2">
                    <Label>Audit Date *</Label>
                    <Input
                      type="date"
                      value={formData.auditDate}
                      onChange={(e) => setFormData({ ...formData, auditDate: e.target.value })}
                      required
                    />
                  </div>

                  {/* Total Files Reviewed */}
                  <div className="space-y-2">
                    <Label>Total Files Reviewed *</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.totalFilesReviewed?.toString() || ''}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        setFormData({ ...formData, totalFilesReviewed: value === '' ? undefined : parseInt(value) })
                      }}
                      placeholder="Enter total files reviewed"
                      required
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Total number of files reviewed by the examiner
                    </p>
                  </div>

                  {/* Files with Error */}
                  <div className="space-y-2">
                    <Label>No. of Files with Error *</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.filesWithError.toString()}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        setFormData({ ...formData, filesWithError: value === '' ? 0 : parseInt(value) })
                      }}
                      placeholder="0"
                      required
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Total Errors */}
                  <div className="space-y-2">
                    <Label>Total No. of Errors *</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.totalErrors.toString()}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        setFormData({ ...formData, totalErrors: value === '' ? 0 : parseInt(value) })
                      }}
                      placeholder="0"
                      required
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>

                  {/* Files with CCE Error */}
                  <div className="space-y-2">
                    <Label>No. of Files with CCE Error *</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={formData.filesWithCceError.toString()}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '')
                        setFormData({ ...formData, filesWithCceError: value === '' ? 0 : parseInt(value) })
                      }}
                      placeholder="0"
                      required
                      className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                {/* Optional: Audit Period */}
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">Optional: Audit Period</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Period Start Date</Label>
                      <Input
                        type="date"
                        value={formData.auditPeriodStart || ''}
                        onChange={(e) => setFormData({ ...formData, auditPeriodStart: e.target.value || null })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Period End Date</Label>
                      <Input
                        type="date"
                        value={formData.auditPeriodEnd || ''}
                        onChange={(e) => setFormData({ ...formData, auditPeriodEnd: e.target.value || null })}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    If specified, total files reviewed will be counted for this date range
                  </p>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <ClipboardCheck className="h-4 w-4 mr-2" />
                        {editingId ? 'Update' : 'Save'} Audit Entry
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      resetForm()
                      setShowForm(false)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Label className="whitespace-nowrap">Filter by:</Label>
              
              <Select
                value={filterTeamId?.toString() || 'all'}
                onValueChange={(value) => setFilterTeamId(value === 'all' ? null : parseInt(value))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map((team) => (
                    <SelectItem key={team.id} value={team.id.toString()}>
                      {team.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterExaminerId?.toString() || 'all'}
                onValueChange={(value) => setFilterExaminerId(value === 'all' ? null : parseInt(value))}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Examiners" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Examiners</SelectItem>
                  {filteredExaminersForFilter.map((examiner) => (
                    <SelectItem key={examiner.id} value={examiner.id.toString()}>
                      {examiner.userName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={fetchAudits}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Audits Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Quality Audit Records
            </CardTitle>
            <CardDescription>
              View and manage file review quality metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : audits.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">S. No.</TableHead>
                      <TableHead className="whitespace-nowrap">Examiner Name</TableHead>
                      <TableHead className="whitespace-nowrap">Team Name</TableHead>
                      <TableHead className="whitespace-nowrap">Process</TableHead>
                      <TableHead className="text-center">OFE</TableHead>
                      <TableHead className="text-center">Files Reviewed</TableHead>
                      <TableHead className="text-center">OFE Count</TableHead>
                      <TableHead className="text-center">Files w/ Error</TableHead>
                      <TableHead className="text-center">Total Errors</TableHead>
                      <TableHead className="text-center">CCE Errors</TableHead>
                      <TableHead className="text-center">FB Quality</TableHead>
                      <TableHead className="text-center">OFE Quality</TableHead>
                      <TableHead className="text-center">CCE Quality</TableHead>
                      <TableHead className="text-center">Audit Date</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {audits.map((audit, index) => (
                      <TableRow key={audit.id}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell className="font-medium">{audit.examinerName}</TableCell>
                        <TableCell>{audit.teamName}</TableCell>
                        <TableCell className="text-sm">{audit.processType}</TableCell>
                        <TableCell className="text-center font-semibold">{audit.ofe}</TableCell>
                        <TableCell className="text-center">{audit.totalFilesReviewed}</TableCell>
                        <TableCell className="text-center font-medium">{audit.ofeCount}</TableCell>
                        <TableCell className="text-center">{audit.filesWithError}</TableCell>
                        <TableCell className="text-center">{audit.totalErrors}</TableCell>
                        <TableCell className="text-center">{audit.filesWithCceError}</TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getQualityIcon(audit.fbQuality)}
                            {getQualityBadge(audit.fbQuality)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getQualityIcon(audit.ofeQuality)}
                            {getQualityBadge(audit.ofeQuality)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex items-center justify-center gap-1">
                            {getQualityIcon(audit.cceQuality)}
                            {getQualityBadge(audit.cceQuality)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center text-sm">
                          {new Date(audit.auditDate).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(audit)}
                            >
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(audit.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <ClipboardCheck className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No quality audit records found</p>
                <p className="text-sm mt-1">Click "New Audit Entry" to create your first record</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legend Card - Only show for admins */}
        {!isTeamLead && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">Quality Metrics Formulas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-6 text-sm">
                <div>
                  <h4 className="font-medium mb-2">FB Quality</h4>
                  <p className="text-muted-foreground">
                    = 1 - (Files with Error / Total Files Reviewed)
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">OFE Quality</h4>
                  <p className="text-muted-foreground">
                    = 1 - (Total Errors / OFE Count)
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-2">CCE Quality</h4>
                  <p className="text-muted-foreground">
                    = 1 - (CCE Errors / Total Files Reviewed)
                  </p>
                </div>
              </div>
              <div className="flex gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  <span className="text-xs">90%+ Excellent</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-blue-600" />
                  <span className="text-xs">70-89% Good</span>
                </div>
                <div className="flex items-center gap-2">
                  <XCircle className="h-3 w-3 text-red-600" />
                  <span className="text-xs">&lt;70% Needs Improvement</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}

export default QualityAuditPage
