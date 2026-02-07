import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapPin, Package, Users, Loader2, AlertCircle } from 'lucide-react'
import { AdminNav } from '@/components/layout/AdminNav'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import api, { organizationsApi } from '@/services/api'
import type { Organization } from '@/types'

// Interfaces matching the backend API response
interface TeamState {
  id: number
  teamId: number
  state: string
}

interface TeamProduct {
  id: number
  teamId: number
  productType: string
}

interface TeamMember {
  id: number
  userId: number
  userName: string
  employeeId: string
  userRole: string
  teamRole: string
  isActive: boolean
}

interface Team {
  id: number
  name: string
  orgId: number
  teamLeadId: number | null
  isActive: boolean
  states: TeamState[]
  products: TeamProduct[]
  members?: TeamMember[]
}

const TeamReportDetailPage = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [team, setTeam] = useState<Team | null>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchTeamDetails()
  }, [id])

  const fetchTeamDetails = async () => {
    try {
      setLoading(true)
      
      // Fetch team details with members from the API
      const teamResponse = await api.get(`/teams/${id}`)
      
      // The team endpoint already includes members
      setTeam(teamResponse.data)
      
      // Fetch organization details
      if (teamResponse.data.orgId) {
        try {
          const orgData = await organizationsApi.get(teamResponse.data.orgId)
          setOrganization(orgData)
        } catch (error) {
          console.error('Error fetching organization:', error)
        }
      }
    } catch (error) {
      console.error('Error fetching team details:', error)
    } finally {
      setLoading(false)
    }
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

  const getTeamRoleBadgeVariant = (role: string) => {
    return role === 'lead' ? 'default' : 'secondary'
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
        <AdminNav />
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
        <AdminNav />
        <main className="container mx-auto px-4 py-8">
          <Button onClick={() => navigate('/admin/teams')}>
            Back to Teams
          </Button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                {team.name.charAt(0)}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">{team.name}</h1>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={team.isActive ? 'default' : 'secondary'}>
                    {team.isActive ? 'Active' : 'Inactive'}
                  </Badge>
                  <span className="text-sm text-slate-600">{organization?.name || 'Unknown Organization'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <AdminNav />

      <main className="container mx-auto px-4 py-8">
        {/* Summary Cards */}
        <div className="grid gap-6 md:grid-cols-3 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">States Coverage</CardTitle>
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{team.states.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Product Types</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{team.products.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Team Members</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{team.members?.length || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mb-6">
          {/* States Coverage */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                States Coverage
              </CardTitle>
              <CardDescription>States this team handles</CardDescription>
            </CardHeader>
            <CardContent>
              {team.states.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No states assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {team.states.map((stateObj) => (
                    <Badge key={stateObj.id} variant="outline">
                      {stateObj.state}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Product Types */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Product Types
              </CardTitle>
              <CardDescription>Products this team works on</CardDescription>
            </CardHeader>
            <CardContent>
              {team.products.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No products assigned</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {team.products.map((product) => (
                    <Badge key={product.id} variant="secondary">
                      {product.productType}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Team Members */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team Members ({team.members?.length || 0})
            </CardTitle>
            <CardDescription>All members assigned to this team</CardDescription>
          </CardHeader>
          <CardContent>
            {!team.members || team.members.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No members assigned to this team</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Username</TableHead>
                    <TableHead>System Role</TableHead>
                    <TableHead>Team Role</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {team.members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>{getInitials(member.userName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{member.userName}</div>
                            <div className="text-xs text-muted-foreground">{member.employeeId}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">@{member.userName}</TableCell>
                      <TableCell>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${getRoleBadgeColor(member.userRole)}`}>
                          {member.userRole === 'team_lead' ? 'Team Lead' : 
                           member.userRole === 'admin' ? 'Admin' : 
                           member.userRole === 'superadmin' ? 'Super Admin' : 'Employee'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getTeamRoleBadgeVariant(member.teamRole)}>
                          {member.teamRole}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={member.isActive ? 'default' : 'secondary'}>
                          {member.isActive ? 'Active' : 'Inactive'}
                        </Badge>
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

export default TeamReportDetailPage
