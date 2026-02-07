import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { billingApi } from '../../services/api'
import type { BillingReport, BillingPreviewResponse } from '../../types'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { AdminNav } from '../../components/layout/AdminNav'
import {
  FileText,
  Plus,
  RefreshCw,
  Loader2,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  AlertCircle,
  Calendar,
  FileCheck,
  Download
} from 'lucide-react'
import toast from 'react-hot-toast'

export const BillingPage = () => {
  const { user } = useAuthStore()
  const navigate = useNavigate()

  const [reports, setReports] = useState<BillingReport[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const [preview, setPreview] = useState<BillingPreviewResponse | null>(null)
  const [selectedReport, setSelectedReport] = useState<BillingReport | null>(null)

  // Filter state
  const [filterMonth, setFilterMonth] = useState<number | null>(null)
  const [filterYear, setFilterYear] = useState<number | null>(null)
  const [filterStatus, setFilterStatus] = useState<string | null>(null)

  // Form state
  const [formMonth, setFormMonth] = useState<number>(new Date().getMonth() + 1)
  const [formYear, setFormYear] = useState<number>(new Date().getFullYear())

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ]

  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i)

  useEffect(() => {
    if (!user || !['admin', 'superadmin'].includes(user.userRole)) {
      navigate('/login')
    } else {
      fetchInitialData()
    }
  }, [user, navigate])

  useEffect(() => {
    if (user) {
      fetchReports()
    }
  }, [filterMonth, filterYear, filterStatus])

  const fetchInitialData = async () => {
    try {
      setLoading(true)
      const reportsRes = await billingApi.list()
      setReports(reportsRes.items || [])
    } catch (error) {
      console.error('Failed to fetch initial data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const fetchReports = async () => {
    try {
      const params: any = {}
      if (filterMonth) params.billingMonth = filterMonth
      if (filterYear) params.billingYear = filterYear
      if (filterStatus) params.status = filterStatus

      const response = await billingApi.list(params)
      setReports(response.items || [])
    } catch (error) {
      console.error('Failed to fetch reports:', error)
    }
  }

  const handlePreview = async () => {
    if (!formMonth || !formYear) {
      toast.error('Please select month and year')
      return
    }

    try {
      setProcessing(true)
      const previewData = await billingApi.preview({
        billingMonth: formMonth,
        billingYear: formYear,
      })

      if (previewData.totalFiles === 0) {
        toast.error('No pending orders found for this period')
        return
      }

      setPreview(previewData)
      setShowPreview(true)
    } catch (error: any) {
      console.error('Failed to preview billing data:', error)
      toast.error(error.response?.data?.detail || 'Failed to preview billing data')
    } finally {
      setProcessing(false)
    }
  }

  const handleCreate = async () => {
    if (!formMonth || !formYear) {
      toast.error('Please select month and year')
      return
    }

    try {
      setProcessing(true)
      await billingApi.create({
        billingMonth: formMonth,
        billingYear: formYear,
      })

      toast.success('Billing report created successfully')
      setShowCreateForm(false)
      setShowPreview(false)
      setPreview(null)
      resetForm()
      fetchReports()
    } catch (error: any) {
      console.error('Failed to create billing report:', error)
      toast.error(error.response?.data?.detail || 'Failed to create billing report')
    } finally {
      setProcessing(false)
    }
  }

  const handleFinalize = async (report: BillingReport) => {
    if (
      !confirm(
        `Are you sure you want to finalize billing for ${months[report.billingMonth - 1].label} ${report.billingYear}?\n\nThis will mark all ${report.totalFiles} orders as "done" and cannot be undone.`
      )
    ) {
      return
    }

    try {
      setProcessing(true)
      await billingApi.finalize(report.id)
      toast.success('Billing report finalized successfully')
      fetchReports()
    } catch (error: any) {
      console.error('Failed to finalize billing report:', error)
      toast.error(error.response?.data?.detail || 'Failed to finalize billing report')
    } finally {
      setProcessing(false)
    }
  }

  const handleDelete = async (report: BillingReport) => {
    if (report.status === 'finalized') {
      toast.error('Cannot delete finalized billing reports')
      return
    }

    if (!confirm('Are you sure you want to delete this billing report?')) {
      return
    }

    try {
      await billingApi.delete(report.id)
      toast.success('Billing report deleted successfully')
      fetchReports()
    } catch (error: any) {
      console.error('Failed to delete billing report:', error)
      toast.error(error.response?.data?.detail || 'Failed to delete billing report')
    }
  }

  const handleViewDetails = (report: BillingReport) => {
    setSelectedReport(report)
  }

  const handleExportExcel = async (report: BillingReport) => {
    try {
      toast.loading('Generating Excel file...', { id: 'export-excel' })
      await billingApi.exportExcel(report.id)
      toast.success('Excel file downloaded successfully', { id: 'export-excel' })
    } catch (error: any) {
      console.error('Failed to export billing report:', error)
      toast.error(error.response?.data?.detail || 'Failed to export billing report', { id: 'export-excel' })
    }
  }

  const resetForm = () => {
    setFormMonth(new Date().getMonth() + 1)
    setFormYear(new Date().getFullYear())
  }

  const getStatusBadge = (status: string) => {
    if (status === 'finalized') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-green-700 bg-green-100 rounded">
          <CheckCircle2 className="h-3 w-3" />
          Finalized
        </span>
      )
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded">
        <AlertCircle className="h-3 w-3" />
        Draft
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Billing Reports</h1>
              <p className="text-sm text-slate-600">Organization-wide monthly billing grouped by product types</p>
            </div>
            <Button
              onClick={() => {
                resetForm()
                setShowCreateForm(!showCreateForm)
                setShowPreview(false)
                setSelectedReport(null)
              }}
            >
              {showCreateForm ? (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Cancel
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  New Billing Report
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <AdminNav />

      <main className="container mx-auto px-4 py-8">
        {/* Create Form */}
        {showCreateForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>New Billing Report</CardTitle>
              <CardDescription>
                Select billing period to generate organization-wide report
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Month *</Label>
                    <Select
                      value={formMonth.toString()}
                      onValueChange={(value) => setFormMonth(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select month" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((month) => (
                          <SelectItem key={month.value} value={month.value.toString()}>
                            {month.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Year *</Label>
                    <Select
                      value={formYear.toString()}
                      onValueChange={(value) => setFormYear(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((year) => (
                          <SelectItem key={year} value={year.toString()}>
                            {year}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button onClick={handlePreview} disabled={processing} variant="outline">
                    {processing ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <Eye className="h-4 w-4 mr-2" />
                        Preview Data
                      </>
                    )}
                  </Button>

                  {showPreview && preview && (
                    <Button onClick={handleCreate} disabled={processing}>
                      {processing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <FileCheck className="h-4 w-4 mr-2" />
                          Create Report
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Preview Table */}
                {showPreview && preview && (
                  <div className="mt-6">
                    <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                      <h3 className="font-semibold text-blue-900 mb-2">Preview Summary</h3>
                      <div className="grid md:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-blue-700">Period:</span>{' '}
                          <span className="font-medium">
                            {months[preview.billingMonth - 1].label} {preview.billingYear}
                          </span>
                        </div>
                        <div>
                          <span className="text-blue-700">Total Files:</span>{' '}
                          <span className="font-medium">{preview.totalFiles}</span>
                        </div>
                        <div>
                          <span className="text-blue-700">Teams:</span>{' '}
                          <span className="font-medium">{preview.teamsCount}</span>
                        </div>
                      </div>
                    </div>

                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product Type</TableHead>
                          <TableHead className="text-center">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.details.map((detail, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-medium">{detail.productType}</TableCell>
                            <TableCell className="text-center font-semibold">
                              {detail.totalCount}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-slate-50 font-semibold">
                          <TableCell>GRAND TOTAL</TableCell>
                          <TableCell className="text-center">{preview.totalFiles}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="flex items-center gap-4 flex-wrap">
              <Label className="whitespace-nowrap">Filter by:</Label>

              <Select
                value={filterMonth?.toString() || 'all'}
                onValueChange={(value) => setFilterMonth(value === 'all' ? null : parseInt(value))}
              >
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {months.map((month) => (
                    <SelectItem key={month.value} value={month.value.toString()}>
                      {month.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterYear?.toString() || 'all'}
                onValueChange={(value) => setFilterYear(value === 'all' ? null : parseInt(value))}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All Years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Years</SelectItem>
                  {years.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterStatus || 'all'}
                onValueChange={(value) => setFilterStatus(value === 'all' ? null : value)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="finalized">Finalized</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="sm" onClick={fetchReports}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Reports List */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Billing Reports
            </CardTitle>
            <CardDescription>View and manage monthly billing reports</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : reports.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Period</TableHead>
                      <TableHead className="text-center">Total Files</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead>Created By</TableHead>
                      <TableHead>Finalized By</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-slate-500" />
                            {months[report.billingMonth - 1].label} {report.billingYear}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-semibold">
                          {report.totalFiles}
                        </TableCell>
                        <TableCell className="text-center">{getStatusBadge(report.status)}</TableCell>
                        <TableCell className="text-sm">
                          {report.createdByName}
                          <div className="text-xs text-muted-foreground">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {report.finalizedByName ? (
                            <>
                              {report.finalizedByName}
                              <div className="text-xs text-muted-foreground">
                                {report.finalizedAt
                                  ? new Date(report.finalizedAt).toLocaleDateString()
                                  : ''}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(report)}
                              title="View Details"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExportExcel(report)}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="Export to Excel"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {report.status === 'draft' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleFinalize(report)}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Finalize Report"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(report)}
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  title="Delete Report"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No billing reports found</p>
                <p className="text-sm mt-1">Click "New Billing Report" to create your first report</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Report Details Modal */}
        {selectedReport && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <Card className="max-w-4xl w-full max-h-[90vh] overflow-auto">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>
                      {months[selectedReport.billingMonth - 1].label}{' '}
                      {selectedReport.billingYear} - All Teams
                    </CardTitle>
                    <CardDescription>Billing report details</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportExcel(selectedReport)}
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Export Excel
                    </Button>
                    <Button variant="outline" onClick={() => setSelectedReport(null)}>
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-4 bg-slate-50 rounded">
                  <div className="grid md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      {getStatusBadge(selectedReport.status)}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Total Files:</span>{' '}
                      <span className="font-semibold">{selectedReport.totalFiles}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Created By:</span>{' '}
                      {selectedReport.createdByName}
                    </div>
                    <div>
                      <span className="text-muted-foreground">Finalized By:</span>{' '}
                      {selectedReport.finalizedByName || '-'}
                    </div>
                  </div>
                </div>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product Type</TableHead>
                      <TableHead className="text-center">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedReport.details.map((detail) => (
                      <TableRow key={detail.id}>
                        <TableCell className="font-medium">{detail.productType}</TableCell>
                        <TableCell className="text-center font-semibold">
                          {detail.totalCount}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-slate-50 font-semibold">
                      <TableCell>GRAND TOTAL</TableCell>
                      <TableCell className="text-center">{selectedReport.totalFiles}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}

export default BillingPage
