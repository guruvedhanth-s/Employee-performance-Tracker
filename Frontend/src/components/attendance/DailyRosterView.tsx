import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Button } from '../ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Textarea } from '../ui/textarea'
import { Badge } from '../ui/badge'
import { ChevronLeft, ChevronRight, Save, UserCheck, UserX, Loader2, Calendar as CalendarIcon, CheckCircle2, XCircle, Clock, Coffee } from 'lucide-react'
import { attendanceApi } from '../../services/api'
import { AttendanceStatus, DailyRosterEmployee, DailyRosterResponse } from '../../types'
import { format, startOfMonth, endOfMonth, addDays, subDays, isSameMonth } from 'date-fns'
import toast from 'react-hot-toast'

interface DailyRosterViewProps {
  teamId: number
  teamName: string
  onDateChange?: (date: Date) => void
}

interface EmployeeAttendanceState {
  userId: number
  status: AttendanceStatus | 'not_marked'
  notes: string
  attendanceId?: number
}

export const DailyRosterView: React.FC<DailyRosterViewProps> = ({
  teamId,
  teamName,
  onDateChange,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [roster, setRoster] = useState<DailyRosterResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [attendanceStates, setAttendanceStates] = useState<Record<number, EmployeeAttendanceState>>({})

  const currentMonth = new Date()
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)

  // Load roster data
  useEffect(() => {
    loadRoster()
  }, [teamId, selectedDate])

  const loadRoster = async () => {
    setLoading(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      const data = await attendanceApi.getDailyRoster(teamId, dateStr)
      setRoster(data)

      // Initialize attendance states from roster
      const states: Record<number, EmployeeAttendanceState> = {}
      data.employees.forEach((emp) => {
        states[emp.userId] = {
          userId: emp.userId,
          status: emp.status || 'not_marked',
          notes: emp.notes || '',
          attendanceId: emp.attendanceId,
        }
      })
      setAttendanceStates(states)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to load roster')
    } finally {
      setLoading(false)
    }
  }

  const handlePrevDay = () => {
    const prevDay = subDays(selectedDate, 1)
    if (isSameMonth(prevDay, currentMonth)) {
      setSelectedDate(prevDay)
      onDateChange?.(prevDay)
    }
  }

  const handleNextDay = () => {
    const nextDay = addDays(selectedDate, 1)
    if (isSameMonth(nextDay, currentMonth) && nextDay <= new Date()) {
      setSelectedDate(nextDay)
      onDateChange?.(nextDay)
    }
  }

  const updateEmployeeStatus = (userId: number, status: AttendanceStatus | 'not_marked') => {
    setAttendanceStates((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        status,
      },
    }))
  }

  const updateEmployeeNotes = (userId: number, notes: string) => {
    setAttendanceStates((prev) => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        notes,
      },
    }))
  }

  const handleMarkAllPresent = () => {
    const newStates = { ...attendanceStates }
    Object.keys(newStates).forEach((key) => {
      newStates[parseInt(key)].status = AttendanceStatus.PRESENT
    })
    setAttendanceStates(newStates)
  }

  const handleMarkAllAbsent = () => {
    const newStates = { ...attendanceStates }
    Object.keys(newStates).forEach((key) => {
      newStates[parseInt(key)].status = AttendanceStatus.ABSENT
    })
    setAttendanceStates(newStates)
  }

  const handleClearAll = () => {
    const newStates = { ...attendanceStates }
    Object.keys(newStates).forEach((key) => {
      newStates[parseInt(key)].status = 'not_marked'
      newStates[parseInt(key)].notes = ''
    })
    setAttendanceStates(newStates)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const dateStr = format(selectedDate, 'yyyy-MM-dd')
      
      // Save each employee's attendance
      const promises = Object.values(attendanceStates).map(async (state) => {
        if (state.status === 'not_marked') {
          return // Skip unmarked
        }

        await attendanceApi.markAttendance({
          userId: state.userId,
          teamId: teamId,
          date: dateStr,
          status: state.status as AttendanceStatus,
          notes: state.notes || undefined,
        })
      })

      await Promise.all(promises)

      toast.success('Attendance saved successfully')

      // Reload roster to get updated data
      await loadRoster()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Failed to save attendance')
    } finally {
      setSaving(false)
    }
  }

  const canNavigatePrev = isSameMonth(subDays(selectedDate, 1), currentMonth)
  const canNavigateNext = isSameMonth(addDays(selectedDate, 1), currentMonth) && addDays(selectedDate, 1) <= new Date()

  const getStatusBadge = (status: AttendanceStatus | 'not_marked') => {
    switch (status) {
      case AttendanceStatus.PRESENT:
        return (
          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Present
          </Badge>
        )
      case AttendanceStatus.ABSENT:
        return (
          <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100">
            <XCircle className="h-3 w-3 mr-1" />
            Absent
          </Badge>
        )
      case AttendanceStatus.LEAVE:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
            <Coffee className="h-3 w-3 mr-1" />
            Leave
          </Badge>
        )
      case AttendanceStatus.HALF_DAY:
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 hover:bg-blue-100">
            <Clock className="h-3 w-3 mr-1" />
            Half Day
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="text-gray-500">
            Not Marked
          </Badge>
        )
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-slate-500 mx-auto mb-3" />
            <p className="text-sm text-slate-600">Loading roster...</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header Card with Date Navigation */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <CardTitle className="text-sm font-medium text-slate-600">
              Daily Attendance - {teamName}
            </CardTitle>
            
            {/* Date Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevDay}
                disabled={!canNavigatePrev}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="min-w-[180px] text-center">
                <div className="font-medium text-sm text-slate-900">
                  {format(selectedDate, 'EEEE, MMMM dd, yyyy')}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextDay}
                disabled={!canNavigateNext}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Statistics Bar */}
        {roster && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-600 font-medium">Present</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{roster.summary.present}</p>
              </div>
              
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-600 font-medium">Absent</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{roster.summary.absent}</p>
              </div>
              
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-600 font-medium">Leave</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{roster.summary.leave}</p>
              </div>
              
              <div className="text-center p-3 bg-slate-50 rounded-lg">
                <p className="text-xs text-slate-600 font-medium">Not Marked</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{roster.summary.not_marked}</p>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2 pb-4 border-b">
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllPresent}
                className="flex items-center gap-2"
              >
                <UserCheck className="h-4 w-4" />
                Mark All Present
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAbsent}
                className="flex items-center gap-2"
              >
                <UserX className="h-4 w-4" />
                Mark All Absent
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearAll}
              >
                Clear All
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Employee Attendance Table */}
      {roster && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="text-left p-4 font-medium text-sm text-slate-600">Employee</th>
                    <th className="text-left p-4 font-medium text-sm text-slate-600">Status</th>
                    <th className="text-left p-4 font-medium text-sm text-slate-600">Quick Actions</th>
                    <th className="text-left p-4 font-medium text-sm text-slate-600">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {roster.employees.map((employee, index) => (
                    <tr
                      key={employee.userId}
                      className={`border-b last:border-b-0 hover:bg-slate-50 transition-colors ${
                        index % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                      }`}
                    >
                      {/* Employee Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-medium text-slate-700 text-sm">
                            {employee.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium text-sm text-slate-900">{employee.userName}</div>
                            <div className="text-xs text-slate-500">
                              ID: {employee.employeeId}
                            </div>
                            {employee.markedByName && (
                              <div className="text-xs text-slate-500 mt-1">
                                Marked by {employee.markedByName}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status Dropdown */}
                      <td className="p-4">
                        <Select
                          value={attendanceStates[employee.userId]?.status || 'not_marked'}
                          onValueChange={(value) =>
                            updateEmployeeStatus(
                              employee.userId,
                              value as AttendanceStatus | 'not_marked'
                            )
                          }
                        >
                          <SelectTrigger className="w-[150px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="not_marked">Not Marked</SelectItem>
                            <SelectItem value={AttendanceStatus.PRESENT}>Present</SelectItem>
                            <SelectItem value={AttendanceStatus.ABSENT}>Absent</SelectItem>
                            <SelectItem value={AttendanceStatus.LEAVE}>Leave</SelectItem>
                            <SelectItem value={AttendanceStatus.HALF_DAY}>Half Day</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Quick Action Buttons */}
                      <td className="p-4">
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateEmployeeStatus(employee.userId, AttendanceStatus.PRESENT)}
                            className="h-8 w-8 p-0"
                            title="Mark Present"
                          >
                            <CheckCircle2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateEmployeeStatus(employee.userId, AttendanceStatus.ABSENT)}
                            className="h-8 w-8 p-0"
                            title="Mark Absent"
                          >
                            <XCircle className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateEmployeeStatus(employee.userId, AttendanceStatus.LEAVE)}
                            className="h-8 w-8 p-0"
                            title="Mark Leave"
                          >
                            <Coffee className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => updateEmployeeStatus(employee.userId, AttendanceStatus.HALF_DAY)}
                            className="h-8 w-8 p-0"
                            title="Mark Half Day"
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>

                      {/* Notes */}
                      <td className="p-4">
                        <Textarea
                          placeholder="Add notes..."
                          value={attendanceStates[employee.userId]?.notes || ''}
                          onChange={(e) =>
                            updateEmployeeNotes(employee.userId, e.target.value)
                          }
                          rows={1}
                          className="text-sm min-w-[200px] resize-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Save Button Footer */}
            <div className="border-t bg-slate-50 p-4 flex justify-between items-center">
              <p className="text-sm text-slate-600">
                {roster.employees.length} employee{roster.employees.length !== 1 ? 's' : ''} in roster
              </p>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save All Changes
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
