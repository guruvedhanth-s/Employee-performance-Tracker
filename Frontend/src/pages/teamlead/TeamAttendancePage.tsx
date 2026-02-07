import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Calendar, FileText, Loader2, ArrowLeft } from 'lucide-react'
import { DailyRosterView } from '../../components/attendance/DailyRosterView'
import { teamsApi } from '../../services/api'
import { TeamSimple } from '../../types'
import { useAuthStore } from '../../store/authStore'

export const TeamAttendancePage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [teams, setTeams] = useState<TeamSimple[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTeams()
  }, [])

  const loadTeams = async () => {
    setLoading(true)
    try {
      // Get teams where current user is team lead
      const response = await teamsApi.myTeams()
      const userTeams = response.items.filter(
        (team) => team.teamLeadId === user?.id && team.isActive
      )
      setTeams(userTeams)

      // Auto-select first team if only one
      if (userTeams.length === 1) {
        setSelectedTeamId(userTeams[0].id)
      }
    } catch (error) {
      console.error('Failed to load teams:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedTeam = teams.find((t) => t.id === selectedTeamId)

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-slate-500 mx-auto mb-3" />
                <p className="text-sm text-slate-600">Loading teams...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (teams.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-slate-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-slate-900">No Teams Found</h3>
              <p className="text-slate-600 mb-4">
                You are not assigned as a team lead for any active teams.
              </p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Refresh Page
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/teamlead/dashboard')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
              <div className="border-l border-slate-300 h-6"></div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Team Attendance</h1>
                <p className="text-sm text-slate-600 mt-1">Mark daily attendance for your team members</p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={() => navigate('/teamlead/attendance/reports')}
              className="flex items-center gap-2"
            >
              <FileText className="h-4 w-4" />
              View Reports
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Team Selection */}
          {teams.length > 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-slate-600">Select Team</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={selectedTeamId?.toString() || ''}
                  onValueChange={(value) => setSelectedTeamId(parseInt(value))}
                >
                  <SelectTrigger className="w-full md:w-[400px]">
                    <SelectValue placeholder="Select a team..." />
                  </SelectTrigger>
                  <SelectContent>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id.toString()}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          {/* Daily Roster */}
          {selectedTeam && (
            <DailyRosterView
              teamId={selectedTeam.id}
              teamName={selectedTeam.name}
            />
          )}

          {!selectedTeamId && teams.length > 1 && (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-slate-900">Select a Team</h3>
                <p className="text-slate-600 max-w-md mx-auto">
                  Please select a team from the dropdown above to start marking attendance.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

export default TeamAttendancePage
