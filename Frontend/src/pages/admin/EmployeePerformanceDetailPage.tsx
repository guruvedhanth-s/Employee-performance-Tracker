import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { useDashboardFilterStore, getMonthOptions, getYearOptions } from '../../store/dashboardFilterStore'
import { usersApi, metricsApi, api } from '../../services/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { AdminNav } from '../../components/layout/AdminNav'
import { 
  ArrowLeft,
  Download,
  Loader2,
  AlertCircle,
  Target,
  Award,
  BarChart3,
  Calendar,
  FileCheck
} from 'lucide-react'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

interface EmployeeMetric {
  id: number
  userId: number
  userName: string | null
  teamId: number | null
  teamName: string | null
  metricDate: string
  periodType: string
  totalOrdersAssigned: number
  totalOrdersCompleted: number
  totalStep1Completed: number
  totalStep2Completed: number
  totalSingleSeatCompleted: number
  totalWorkingMinutes: number
  efficiencyScore: number | null
  productivityScore: number | null
  productivityTarget: number | null
  qualityFbScore: number | null
  qualityOfeScore: number | null
  qualityCceScore: number | null
  qualityAuditCount: number
}

interface ProductivityData {
  userId: number
  userName: string
  employeeId: string
  productivityPercent: number | null
  expectedTarget: number
  weeklyTarget: number | null
  completions: {
    step1Only: number
    step2Only: number
    singleSeat: number
    total: number
  }
  scores: {
    step1Score: number
    step2Score: number
    singleSeatScore: number
    totalScore: number
  }
}

interface QualityAudit {
  id: number
  examinerId: number
  examinerName: string
  teamName: string
  processType: string
  ofe: number
  totalFilesReviewed: number
  filesWithError: number
  totalErrors: number
  fbQuality: number
  ofeQuality: number
  cceQuality: number
  auditDate: string
}

export const EmployeePerformanceDetailPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { userId } = useParams<{ userId: string }>()
  const [employee, setEmployee] = useState<any>(null)
  const [metrics, setMetrics] = useState<EmployeeMetric[]>([])
  const [productivityData, setProductivityData] = useState<ProductivityData | null>(null)
  const [qualityAudits, setQualityAudits] = useState<QualityAudit[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingProductivity, setLoadingProductivity] = useState(false)
  const [loadingQuality, setLoadingQuality] = useState(false)
  
  const {
    filterMonth,
    filterYear,
    setFilterMonth,
    setFilterYear,
  } = useDashboardFilterStore()

  useEffect(() => {
    if (!user || !['admin', 'superadmin'].includes(user.userRole)) {
      navigate('/login')
    } else if (userId) {
      fetchEmployee()
      fetchMetrics()
      fetchProductivityData()
      fetchQualityAudits()
    }
  }, [user, navigate, userId, filterMonth, filterYear])

  const fetchEmployee = async () => {
    try {
      console.log('Fetching employee:', userId)
      const response = await usersApi.get(parseInt(userId!))
      console.log('Employee response:', response)
      setEmployee(response)
    } catch (error: any) {
      console.error('Failed to fetch employee:', error)
      console.error('Error details:', error.response?.data)
      toast.error('Failed to load employee details')
    }
  }

  const fetchMetrics = async () => {
    try {
      setLoading(true)
      const startDate = `${filterYear}-${filterMonth.padStart(2, '0')}-01`
      const lastDay = new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate()
      const endDate = `${filterYear}-${filterMonth.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      
      console.log('Fetching metrics with params:', {
        userId: parseInt(userId!),
        periodType: 'daily',
        startDate,
        endDate,
        pageSize: 100,
      })
      
      const response = await metricsApi.listEmployeeMetrics({
        userId: parseInt(userId!),
        periodType: 'daily',
        startDate,
        endDate,
        pageSize: 100,
      })
      
      console.log('Metrics response:', response)
      console.log('Metrics items:', response.items)
      console.log('Number of metrics:', response.items?.length || 0)
      
      setMetrics(response.items || [])
    } catch (error: any) {
      console.error('Failed to fetch metrics:', error)
      console.error('Error details:', error.response?.data)
      toast.error('Failed to load performance metrics')
      setMetrics([])
    } finally {
      setLoading(false)
    }
  }

  const fetchProductivityData = async () => {
    try {
      setLoadingProductivity(true)
      const startDate = `${filterYear}-${filterMonth.padStart(2, '0')}-01`
      const lastDay = new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate()
      const endDate = `${filterYear}-${filterMonth.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      
      const response = await api.get(`/productivity/employee/${userId}`, {
        params: { start_date: startDate, end_date: endDate }
      })
      
      console.log('Productivity data:', response.data)
      setProductivityData(response.data)
    } catch (error: any) {
      console.error('Failed to fetch productivity data:', error)
      console.error('Error response:', error.response?.data)
      setProductivityData(null)
    } finally {
      setLoadingProductivity(false)
    }
  }

  const fetchQualityAudits = async () => {
    try {
      setLoadingQuality(true)
      const startDate = `${filterYear}-${filterMonth.padStart(2, '0')}-01`
      const lastDay = new Date(parseInt(filterYear), parseInt(filterMonth), 0).getDate()
      const endDate = `${filterYear}-${filterMonth.padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
      
      const response = await api.get('/quality-audits', {
        params: {
          examiner_id: userId,
          start_date: startDate,
          end_date: endDate,
          page_size: 100
        }
      })
      
      console.log('Quality audits data:', response.data)
      setQualityAudits(response.data.items || [])
    } catch (error: any) {
      console.error('Failed to fetch quality audits:', error)
      console.error('Error response:', error.response?.data)
      setQualityAudits([])
    } finally {
      setLoadingQuality(false)
    }
  }

  const getScoreColor = (score: number | null) => {
    if (score === null) return 'bg-gray-100 text-gray-700'
    if (score >= 90) return 'bg-green-100 text-green-700'
    if (score >= 75) return 'bg-blue-100 text-blue-700'
    if (score >= 60) return 'bg-yellow-100 text-yellow-700'
    return 'bg-red-100 text-red-700'
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return 'N/A'
    const date = new Date(dateStr)
    return date.toLocaleString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  const formatDuration = (minutes: number | null) => {
    if (minutes === null) return 'N/A'
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    if (hours > 0) {
      return `${hours}h ${mins}m`
    }
    return `${mins}m`
  }

  // Calculate average scores
  const avgProductivity = useMemo(() => {
    const scores = metrics.filter(m => m.productivityScore !== null).map(m => m.productivityScore!)
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  }, [metrics])

  const avgQualityFb = useMemo(() => {
    const scores = metrics.filter(m => m.qualityFbScore !== null).map(m => m.qualityFbScore!)
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  }, [metrics])

  const avgQualityOfe = useMemo(() => {
    const scores = metrics.filter(m => m.qualityOfeScore !== null).map(m => m.qualityOfeScore!)
    return scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null
  }, [metrics])

  const totalOrders = useMemo(() => {
    return metrics.reduce((sum, m) => sum + m.totalOrdersCompleted, 0)
  }, [metrics])

  const exportToExcel = () => {
    // Create a new workbook
    const wb = XLSX.utils.book_new()
    
    // Create Overview sheet
    const overviewData = [
      ['EMPLOYEE PERFORMANCE REPORT'],
      [],
      ['Employee:', employee?.userName || 'Unknown'],
      ['Employee ID:', employee?.employeeId || 'N/A'],
      ['Period:', `${getMonthOptions(filterYear).find(m => m.value === filterMonth)?.label} ${filterYear}`],
      [],
      ['SUMMARY STATISTICS'],
      ['Metric', 'Value'],
      ['Total Orders Completed', totalOrders],
      ['Average Productivity', avgProductivity !== null ? `${avgProductivity.toFixed(1)}%` : 'N/A'],
      ['Average Quality (FB)', avgQualityFb !== null ? `${avgQualityFb.toFixed(1)}%` : 'N/A'],
      ['Average Quality (OFE)', avgQualityOfe !== null ? `${avgQualityOfe.toFixed(1)}%` : 'N/A'],
    ]
    
    const wsOverview = XLSX.utils.aoa_to_sheet(overviewData)
    
    // Set column widths
    wsOverview['!cols'] = [
      { wch: 25 }, // Column A
      { wch: 20 }  // Column B
    ]
    
    // Style the title
    if (wsOverview['A1']) {
      wsOverview['A1'].s = {
        font: { bold: true, sz: 16, color: { rgb: "1F4788" } },
        alignment: { horizontal: "center" }
      }
    }
    
    // Merge title cell
    wsOverview['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } } // Merge A1:B1
    ]
    
    XLSX.utils.book_append_sheet(wb, wsOverview, 'Overview')
    
    // Create Daily Metrics sheet
    const metricsData = [
      ['DAILY PERFORMANCE METRICS'],
      [],
      ['Date', 'Orders Completed', 'Productivity %', 'Quality FB %', 'Quality OFE %']
    ]
    
    metrics
      .sort((a, b) => new Date(a.metricDate).getTime() - new Date(b.metricDate).getTime())
      .forEach(m => {
        metricsData.push([
          formatDate(m.metricDate),
          m.totalOrdersCompleted,
          m.productivityScore !== null ? parseFloat(m.productivityScore.toFixed(1)) : 'N/A',
          m.qualityFbScore !== null ? parseFloat(m.qualityFbScore.toFixed(1)) : 'N/A',
          m.qualityOfeScore !== null ? parseFloat(m.qualityOfeScore.toFixed(1)) : 'N/A'
        ])
      })
    
    const wsMetrics = XLSX.utils.aoa_to_sheet(metricsData)
    
    // Set column widths
    wsMetrics['!cols'] = [
      { wch: 15 }, // Date
      { wch: 18 }, // Orders
      { wch: 16 }, // Productivity
      { wch: 16 }, // Quality FB
      { wch: 16 }  // Quality OFE
    ]
    
    // Merge title cell
    wsMetrics['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } } // Merge title
    ]
    
    XLSX.utils.book_append_sheet(wb, wsMetrics, 'Daily Metrics')
    
    // Create Quality Audits sheet
    if (qualityAudits.length > 0) {
      const auditsData = [
        ['QUALITY AUDITS'],
        [],
        ['Date', 'Team', 'Process Type', 'Files Reviewed', 'FB Quality %', 'OFE Quality %', 'CCE Quality %']
      ]
      
      qualityAudits
        .sort((a, b) => new Date(a.auditDate).getTime() - new Date(b.auditDate).getTime())
        .forEach(qa => {
          auditsData.push([
            formatDate(qa.auditDate),
            qa.teamName,
            qa.processType,
            qa.totalFilesReviewed,
            parseFloat((qa.fbQuality * 100).toFixed(1)),
            parseFloat((qa.ofeQuality * 100).toFixed(1)),
            parseFloat((qa.cceQuality * 100).toFixed(1))
          ])
        })
      
      const wsAudits = XLSX.utils.aoa_to_sheet(auditsData)
      
      // Set column widths
      wsAudits['!cols'] = [
        { wch: 15 }, // Date
        { wch: 20 }, // Team
        { wch: 20 }, // Process Type
        { wch: 16 }, // Files Reviewed
        { wch: 14 }, // FB Quality
        { wch: 14 }, // OFE Quality
        { wch: 14 }  // CCE Quality
      ]
      
      // Merge title cell
      wsAudits['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } } // Merge title
      ]
      
      XLSX.utils.book_append_sheet(wb, wsAudits, 'Quality Audits')
    }
    
    // Generate Excel file
    XLSX.writeFile(wb, `Employee_Performance_${employee?.employeeId}_${filterYear}-${filterMonth}.xlsx`)
    toast.success('Report exported successfully!')
  }

  if (loading && !employee) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AdminNav />
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/admin/employee-management')}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">
                {employee?.userName || 'Employee'} Performance
              </h1>
              <p className="text-slate-600 mt-1">
                Employee ID: {employee?.employeeId || 'N/A'} • 
                {getMonthOptions(filterYear).find(m => m.value === filterMonth)?.label} {filterYear}
              </p>
            </div>
          </div>
          <Button onClick={exportToExcel} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export to Excel
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Period Selection
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Month</label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-40 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getMonthOptions(filterYear).map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Year</label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="w-32 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getYearOptions().map((option) => (
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

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <FileCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{totalOrders}</div>
                  <p className="text-xs text-muted-foreground">
                    Completed this month
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Productivity</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {avgProductivity !== null ? `${avgProductivity.toFixed(1)}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Average productivity
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quality (FB)</CardTitle>
              <Award className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {avgQualityFb !== null ? `${avgQualityFb.toFixed(1)}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Average FB quality
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quality (OFE)</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {avgQualityOfe !== null ? `${avgQualityOfe.toFixed(1)}%` : 'N/A'}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Average OFE quality
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Daily Performance Metrics */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Performance Metrics</CardTitle>
            <CardDescription>
              Day-by-day breakdown of performance indicators
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : metrics.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Metrics Available</h3>
                <p className="text-sm text-slate-600">
                  No performance data found for this period
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Orders</TableHead>
                      <TableHead className="text-right">Productivity</TableHead>
                      <TableHead className="text-right">Quality (FB)</TableHead>
                      <TableHead className="text-right">Quality (OFE)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics
                      .sort((a, b) => new Date(b.metricDate).getTime() - new Date(a.metricDate).getTime())
                      .map((metric) => (
                        <TableRow key={metric.id}>
                          <TableCell className="font-medium">
                            {formatDate(metric.metricDate)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {metric.totalOrdersCompleted}
                          </TableCell>
                          <TableCell className="text-right">
                            {metric.productivityScore !== null ? (
                              <Badge variant="secondary" className={getScoreColor(metric.productivityScore)}>
                                {metric.productivityScore.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {metric.qualityFbScore !== null ? (
                              <Badge variant="secondary" className={getScoreColor(metric.qualityFbScore)}>
                                {metric.qualityFbScore.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {metric.qualityOfeScore !== null ? (
                              <Badge variant="secondary" className={getScoreColor(metric.qualityOfeScore)}>
                                {metric.qualityOfeScore.toFixed(1)}%
                              </Badge>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quality Audits */}
        <Card>
          <CardHeader>
            <CardTitle>Quality Audits</CardTitle>
            <CardDescription>
              Quality audit records for this period
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loadingQuality ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
              </div>
            ) : qualityAudits.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-12 w-12 text-slate-400 mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Quality Audits</h3>
                <p className="text-sm text-slate-600">
                  No quality audit records found for this period
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Team</TableHead>
                      <TableHead>Process Type</TableHead>
                      <TableHead className="text-right">Files Reviewed</TableHead>
                      <TableHead className="text-right">FB Quality</TableHead>
                      <TableHead className="text-right">OFE Quality</TableHead>
                      <TableHead className="text-right">CCE Quality</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {qualityAudits
                      .sort((a, b) => new Date(b.auditDate).getTime() - new Date(a.auditDate).getTime())
                      .map((audit) => (
                        <TableRow key={audit.id}>
                          <TableCell className="font-medium">
                            {formatDate(audit.auditDate)}
                          </TableCell>
                          <TableCell>{audit.teamName}</TableCell>
                          <TableCell>{audit.processType}</TableCell>
                          <TableCell className="text-right font-mono">
                            {audit.totalFilesReviewed}
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className={getScoreColor(audit.fbQuality * 100)}>
                              {(audit.fbQuality * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className={getScoreColor(audit.ofeQuality * 100)}>
                              {(audit.ofeQuality * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Badge variant="secondary" className={getScoreColor(audit.cceQuality * 100)}>
                              {(audit.cceQuality * 100).toFixed(1)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  )
}

export default EmployeePerformanceDetailPage
