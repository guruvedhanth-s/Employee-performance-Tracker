import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { ArrowLeft, Download, Users, Loader2 } from 'lucide-react'
import { attendanceApi, teamsApi } from '../../services/api'
import { TeamSimple, TeamAttendanceReport } from '../../types'
import { useAuthStore } from '../../store/authStore'
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns'
import toast from 'react-hot-toast'

export const TeamAttendanceReportsPage: React.FC = () => {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [teams, setTeams] = useState<TeamSimple[]>([])
  const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null)
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'))
  const [report, setReport] = useState<TeamAttendanceReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingReport, setLoadingReport] = useState(false)

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    if (selectedTeamId) {
      loadReport()
    }
  }, [selectedTeamId, selectedMonth])

  const loadTeams = async () => {
    setLoading(true)
    try {
      const response = await teamsApi.myTeams()
      const userTeams = response.items.filter(
        (team) => team.teamLeadId === user?.id && team.isActive
      )
      setTeams(userTeams)

      if (userTeams.length === 1) {
        setSelectedTeamId(userTeams[0].id)
      }
    } catch (error) {
      console.error('Failed to load teams:', error)
      toast.error('Failed to load teams')
    } finally {
      setLoading(false)
    }
  }

  const loadReport = async () => {
    if (!selectedTeamId) return

    setLoadingReport(true)
    try {
      const startDate = format(startOfMonth(new Date(selectedMonth)), 'yyyy-MM-dd')
      const endDate = format(endOfMonth(new Date(selectedMonth)), 'yyyy-MM-dd')
      
      const data = await attendanceApi.getTeamAttendanceReport(selectedTeamId, startDate, endDate)
      setReport(data)
    } catch (error: any) {
      console.error('Failed to load report:', error)
      toast.error(error.response?.data?.detail || 'Failed to load attendance report')
    } finally {
      setLoadingReport(false)
    }
  }

  const handleExportCSV = () => {
    if (!report) return

    const headers = ['Employee ID', 'Employee Name', 'Working Days', 'Days Present', 'Days Absent', 'Days Leave', 'Attendance %']
    const rows = report.employees.map(emp => [
      emp.employeeId || 'N/A',
      emp.userName || 'N/A',
      emp.workingDays,
      emp.daysPresent,
      emp.daysAbsent,
      emp.daysLeave,
      emp.attendancePercent.toFixed(2)
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-report-${report.teamName}-${selectedMonth}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
    toast.success('Report exported successfully')
  }

  // Generate month options (current month and past 11 months)
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const date = subMonths(new Date(), i)
    return {
      value: format(date, 'yyyy-MM'),
      label: format(date, 'MMMM yyyy')
    }
  })

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="container mx-auto px-4 py-8">
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
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
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/teamlead/attendance')}
              >
                Mark Attendance
              </Button>
              <div className="border-l border-slate-300 h-6"></div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Attendance Reports</h1>
                <p className="text-sm text-slate-600 mt-1">View attendance statistics and export data</p>
              </div>
            </div>
            <Button
              onClick={handleExportCSV}
              disabled={!report}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          {/* Filters */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-slate-600">Filter Options</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Team Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block text-slate-700">Select Team</label>
                  <Select
                    value={selectedTeamId?.toString() || ''}
                    onValueChange={(value) => setSelectedTeamId(parseInt(value))}
                  >
                    <SelectTrigger>
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
                </div>

                {/* Month Selection */}
                <div>
                  <label className="text-sm font-medium mb-2 block text-slate-700">Select Month</label>
                  <Select
                    value={selectedMonth}
                    onValueChange={setSelectedMonth}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {monthOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Loading State */}
          {loadingReport && (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-500 mx-auto mb-3" />
                  <p className="text-sm text-slate-600">Loading report...</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Report Content */}
          {!loadingReport && report && (
            <>
              {/* Summary Cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      Total Employees
                    </CardTitle>
                    <Users className="h-5 w-5 text-slate-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">
                      {report.teamSummary.employee_count}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      In team
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      Total Present
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">
                      {report.teamSummary.total_present}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Days marked
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      Total Absent
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">
                      {report.teamSummary.total_absent}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Days unmarked/absent
                    </p>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-lg transition-shadow">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-slate-600">
                      Total Leave
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-3xl font-bold text-slate-900">
                      {report.teamSummary.total_leave}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Days on leave
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Employee Attendance Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium text-slate-600">
                    Employee Attendance Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-4 font-medium text-sm text-slate-600">Employee</th>
                          <th className="text-center p-4 font-medium text-sm text-slate-600">Working Days</th>
                          <th className="text-center p-4 font-medium text-sm text-slate-600">Present</th>
                          <th className="text-center p-4 font-medium text-sm text-slate-600">Absent</th>
                          <th className="text-center p-4 font-medium text-sm text-slate-600">Leave</th>
                          <th className="text-center p-4 font-medium text-sm text-slate-600">Attendance %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.employees.map((employee, index) => (
                          <tr
                            key={employee.userId}
                            className={`border-b last:border-b-0 hover:bg-slate-50 transition-colors ${
                              index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                            }`}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-medium text-slate-700 text-sm">
                                  {employee.userName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                </div>
                                <div>
                                  <div className="font-medium text-sm text-slate-900">{employee.userName}</div>
                                  <div className="text-xs text-slate-500">
                                    ID: {employee.employeeId}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 text-center font-medium text-slate-900">{employee.workingDays}</td>
                            <td className="p-4 text-center">
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 text-slate-900 font-medium text-sm">
                                {employee.daysPresent}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 text-slate-900 font-medium text-sm">
                                {employee.daysAbsent}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-slate-100 text-slate-900 font-medium text-sm">
                                {employee.daysLeave}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="text-lg font-bold text-slate-900">
                                {employee.attendancePercent.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {report.employees.length === 0 && (
                    <div className="py-12 text-center">
                      <Users className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                      <p className="text-slate-600">No attendance data available for this period</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* No Team Selected */}
          {!selectedTeamId && !loadingReport && (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-slate-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-slate-900">Select a Team</h3>
                <p className="text-slate-600">
                  Please select a team from the dropdown above to view attendance reports.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}

export default TeamAttendanceReportsPage
