import axios, { InternalAxiosRequestConfig } from 'axios'
import type {
  User,
  UserCreate,
  UserUpdate,
  UserWithTeams,
  UserListResponse,
  Team,
  TeamWithMembers,
  TeamCreate,
  TeamUpdate,
  TeamListResponse,
  TeamMember,
  UserTeam,
  UserTeamCreate,
  UserTeamUpdate,
  Order,
  OrderCreate,
  OrderUpdate,
  OrderListResponse,
  OrderFilterParams,
  OrderHistoryEntry,
  Organization,
  OrganizationCreate,
  OrganizationUpdate,
  OrganizationListResponse,
  TransactionType,
  ProcessType,
  OrderStatus,
  Division,
  EmployeeMetrics,
  EmployeeMetricsListResponse,
  TeamMetrics,
  TeamMetricsListResponse,
  DashboardStats,
  MetricsFilterParams,
  LoginRequest,
  LoginResponse,
  RefreshTokenRequest,
  RefreshTokenResponse,
  ChangePasswordRequest,
  MessageResponse,
  DatabaseResetResponse,
  EmployeeProductivity,
  TeamProductivity,
  ProductivityLeaderboardResponse,
  FileNumberCheckResponse,
  QualityAudit,
  QualityAuditCreate,
  QualityAuditUpdate,
  QualityAuditListResponse,
  QualityAuditFilterParams,
  ProcessTypeOFE,
  BillingReport,
  BillingReportCreate,
  BillingReportListResponse,
  BillingPreviewRequest,
  BillingPreviewResponse,
  TeamWeeklyTargetsResponse,
  WeeklyTargetBulkCreate,
  WeeklyTargetSaveResponse,
  CurrentWeekInfo,
  EmployeeTargetHistoryResponse,
  TeamUserAlias,
  TeamUserAliasCreate,
  TeamUserAliasUpdate,
  UserAliasOption,
  TeamUserAliasListResponse,
  AttendanceRecord,
  AttendanceRecordCreate,
  AttendanceBulkCreate,
  AttendanceRecordUpdate,
  DailyRosterResponse,
  AttendanceSummary,
  TeamAttendanceReport,
  AttendanceStatus,
  FAName,
  FANameCreate,
  FANameUpdate,
  FANameListResponse,
} from '../types'

const API_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Flag to prevent multiple refresh attempts
let isRefreshing = false
let failedQueue: Array<{
  resolve: (value: unknown) => void
  reject: (reason?: unknown) => void
}> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  failedQueue = []
}

// Request interceptor for adding auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for handling errors with token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Log error details for debugging
    console.log('API Error Interceptor:', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data,
      hasResponse: !!error.response,
      hasRequest: !!error.request,
    })
    
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean }

    // If error is 401 and we haven't tried to refresh yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      // If already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refreshToken')

      // If no refresh token, redirect to login (only if not already on login page)
      if (!refreshToken) {
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }

      try {
        // Try to refresh the token
        const response = await axios.post(`${API_URL}/auth/refresh`, {
          refreshToken: refreshToken,
        })

        const { accessToken, refreshToken: newRefreshToken } = response.data

        // Save new tokens
        localStorage.setItem('token', accessToken)
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken)
        }

        // Update the failed request with new token
        originalRequest.headers.Authorization = `Bearer ${accessToken}`

        // Process queued requests
        processQueue(null, accessToken)

        return api(originalRequest)
      } catch (refreshError) {
        // Refresh failed, redirect to login (only if not already on login page)
        processQueue(refreshError, null)
        localStorage.removeItem('token')
        localStorage.removeItem('refreshToken')
        if (window.location.pathname !== '/login') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// ============ Auth API ============
export const authApi = {
  login: async (data: LoginRequest): Promise<LoginResponse> => {
    const response = await api.post('/auth/login', data)
    return response.data
  },

  refresh: async (data: RefreshTokenRequest): Promise<RefreshTokenResponse> => {
    const response = await api.post('/auth/refresh', data)
    return response.data
  },

  logout: async (): Promise<MessageResponse> => {
    const response = await api.post('/auth/logout')
    return response.data
  },

  me: async (): Promise<User> => {
    const response = await api.get('/auth/me')
    return response.data
  },

  changePassword: async (data: ChangePasswordRequest): Promise<MessageResponse> => {
    const response = await api.post('/auth/change-password', data)
    return response.data
  },

  // Change own password using the /users/me/change-password endpoint (for temp password flow)
  changeOwnPassword: async (currentPassword: string, newPassword: string): Promise<MessageResponse> => {
    const response = await api.post('/users/me/change-password', null, {
      params: { currentPassword, newPassword }
    })
    return response.data
  },
}

// ============ Users API ============
export const usersApi = {
  list: async (params?: {
    orgId?: number
    teamId?: number
    role?: string
    isActive?: boolean
    page?: number
    pageSize?: number
  }): Promise<UserListResponse> => {
    const response = await api.get('/users', { params })
    return response.data
  },

  get: async (userId: number): Promise<UserWithTeams> => {
    const response = await api.get(`/users/${userId}`)
    return response.data
  },

  create: async (data: UserCreate): Promise<User> => {
    const response = await api.post('/users', data)
    return response.data
  },

  update: async (userId: number, data: UserUpdate): Promise<User> => {
    const response = await api.put(`/users/${userId}`, data)
    return response.data
  },

  delete: async (userId: number): Promise<MessageResponse> => {
    const response = await api.delete(`/users/${userId}`)
    return response.data
  },

  resetPassword: async (userId: number, newPassword: string): Promise<MessageResponse> => {
    const response = await api.post(`/users/${userId}/reset-password`, null, {
      params: { newPassword }
    })
    return response.data
  },

  // User-Team membership
  addToTeam: async (userId: number, data: UserTeamCreate): Promise<UserTeam> => {
    const response = await api.post(`/users/${userId}/teams`, null, {
      params: { teamId: data.teamId, role: data.role || 'member' }
    })
    return response.data
  },

  removeFromTeam: async (userId: number, teamId: number): Promise<MessageResponse> => {
    const response = await api.delete(`/users/${userId}/teams/${teamId}`)
    return response.data
  },

  updateTeamMembership: async (
    userId: number,
    teamId: number,
    data: UserTeamUpdate
  ): Promise<UserTeam> => {
    const response = await api.put(`/users/${userId}/teams/${teamId}`, data)
    return response.data
  },

  getTeams: async (userId: number): Promise<UserTeam[]> => {
    const response = await api.get(`/users/${userId}/teams`)
    return response.data
  },
}

// ============ Teams API ============
export const teamsApi = {
  list: async (params?: {
    orgId?: number
    isActive?: boolean
    page?: number
    pageSize?: number
  }): Promise<TeamListResponse> => {
    const response = await api.get('/teams', { params })
    return response.data
  },

  myTeams: async (): Promise<TeamListResponse> => {
    const response = await api.get('/teams/my-teams')
    return response.data
  },

  get: async (teamId: number): Promise<TeamWithMembers> => {
    const response = await api.get(`/teams/${teamId}`)
    return response.data
  },

  create: async (data: TeamCreate): Promise<Team> => {
    const response = await api.post('/teams', data)
    return response.data
  },

  update: async (teamId: number, data: TeamUpdate): Promise<Team> => {
    const response = await api.put(`/teams/${teamId}`, data)
    return response.data
  },

  delete: async (teamId: number): Promise<MessageResponse> => {
    const response = await api.delete(`/teams/${teamId}`)
    return response.data
  },

  // Team states management
  addState: async (teamId: number, state: string): Promise<Team> => {
    const response = await api.post(`/teams/${teamId}/states`, { state })
    return response.data
  },

  removeState: async (teamId: number, state: string): Promise<Team> => {
    const response = await api.delete(`/teams/${teamId}/states/${state}`)
    return response.data
  },

  // Team products management
  addProduct: async (teamId: number, productType: string): Promise<Team> => {
    const response = await api.post(`/teams/${teamId}/products`, { productType })
    return response.data
  },

  removeProduct: async (teamId: number, productType: string): Promise<Team> => {
    const response = await api.delete(`/teams/${teamId}/products/${productType}`)
    return response.data
  },

  // Team members
  getMembers: async (teamId: number): Promise<TeamMember[]> => {
    const response = await api.get(`/teams/${teamId}/members`)
    return response.data
  },

  addMember: async (teamId: number, userId: number, role: string = 'member'): Promise<TeamMember> => {
    const response = await api.post(`/teams/${teamId}/members`, null, {
      params: { userId, role }
    })
    return response.data
  },

  removeMember: async (teamId: number, userId: number): Promise<MessageResponse> => {
    const response = await api.delete(`/teams/${teamId}/members/${userId}`)
    return response.data
  },

  updateMemberRole: async (teamId: number, userId: number, role: string): Promise<TeamMember> => {
    const response = await api.put(`/teams/${teamId}/members/${userId}`, null, {
      params: { role }
    })
    return response.data
  },

  // Team user aliases (masked names)
  getAliases: async (teamId: number): Promise<TeamUserAliasListResponse> => {
    const response = await api.get(`/teams/${teamId}/aliases`)
    return response.data
  },

  getAliasOptions: async (teamId: number): Promise<UserAliasOption[]> => {
    const response = await api.get(`/teams/${teamId}/alias-options`)
    return response.data
  },

  createOrUpdateAlias: async (teamId: number, userId: number, data: TeamUserAliasCreate): Promise<TeamUserAlias> => {
    const response = await api.post(`/teams/${teamId}/users/${userId}/alias`, data)
    return response.data
  },

  // Team FA names (pool-based)
  getFakeNames: async (teamId: number): Promise<{ items: Array<{ id: number; faName: string; teamId: number }>; total: number }> => {
    const response = await api.get(`/teams/${teamId}/fake-names`)
    return response.data
  },

  deleteAlias: async (teamId: number, userId: number): Promise<MessageResponse> => {
    const response = await api.delete(`/teams/${teamId}/users/${userId}/alias`)
    return response.data
  },
}

// ============ FA Names API ============
export const faNamesApi = {
  /**
   * List all FA names (for dropdown selections)
   * @param params - Optional filter parameters
   */
  list: async (params?: { 
    skip?: number
    limit?: number
    activeOnly?: boolean
    search?: string 
  }): Promise<FANameListResponse> => {
    const queryParams = new URLSearchParams()
    if (params?.skip !== undefined) queryParams.append('skip', params.skip.toString())
    if (params?.limit !== undefined) queryParams.append('limit', params.limit.toString())
    if (params?.activeOnly !== undefined) queryParams.append('active_only', params.activeOnly.toString())
    if (params?.search) queryParams.append('search', params.search)
    
    const response = await api.get<FANameListResponse>(
      `/fa-names?${queryParams.toString()}`
    )
    return response.data
  },

  /**
   * Get a specific FA name by ID
   */
  get: async (id: number): Promise<FAName> => {
    const response = await api.get<FAName>(`/fa-names/${id}`)
    return response.data
  },

  /**
   * Create a new FA name (admin only)
   */
  create: async (data: FANameCreate): Promise<FAName> => {
    const response = await api.post<FAName>('/fa-names', data)
    return response.data
  },

  /**
   * Update an existing FA name (admin only)
   */
  update: async (id: number, data: FANameUpdate): Promise<FAName> => {
    const response = await api.put<FAName>(`/fa-names/${id}`, data)
    return response.data
  },

  /**
   * Delete an FA name (admin only)
   */
  delete: async (id: number): Promise<MessageResponse> => {
    const response = await api.delete<MessageResponse>(`/fa-names/${id}`)
    return response.data
  }
}

// ============ Orders API ============
export const ordersApi = {
  list: async (params?: OrderFilterParams): Promise<OrderListResponse> => {
    const response = await api.get('/orders', { params })
    return response.data
  },

  get: async (orderId: number): Promise<Order> => {
    const response = await api.get(`/orders/${orderId}`)
    return response.data
  },

  // Check if file number + product type combination exists and get its current state
  checkFileNumber: async (fileNumber: string, teamId: number, productType: string): Promise<FileNumberCheckResponse> => {
    const response = await api.get(`/orders/check-file/${encodeURIComponent(fileNumber)}`, {
      params: { teamId, productType }
    })
    return response.data
  },

  create: async (data: OrderCreate): Promise<Order> => {
    const response = await api.post('/orders', data)
    return response.data
  },

  update: async (orderId: number, data: OrderUpdate): Promise<Order> => {
    const response = await api.put(`/orders/${orderId}`, data)
    return response.data
  },

  delete: async (orderId: number): Promise<MessageResponse> => {
    const response = await api.delete(`/orders/${orderId}`)
    return response.data
  },

  restore: async (orderId: number): Promise<Order> => {
    const response = await api.post(`/orders/${orderId}/restore`)
    return response.data
  },

  // Order history
  getHistory: async (orderId: number): Promise<OrderHistoryEntry[]> => {
    const response = await api.get(`/orders/${orderId}/history`)
    return response.data
  },

  // Bulk operations
  bulkUpdateBillingStatus: async (
    orderIds: number[],
    billingStatus: 'pending' | 'done'
  ): Promise<MessageResponse> => {
    const response = await api.post('/orders/bulk/billing-status', {
      orderIds,
      billingStatus,
    })
    return response.data
  },
}

// ============ Organizations API ============
export const organizationsApi = {
  list: async (params?: {
    isActive?: boolean
    page?: number
    pageSize?: number
  }): Promise<OrganizationListResponse> => {
    // Convert camelCase to snake_case for backend
    const queryParams: Record<string, unknown> = {}
    if (params?.isActive !== undefined) queryParams.is_active = params.isActive
    if (params?.page !== undefined) queryParams.page = params.page
    if (params?.pageSize !== undefined) queryParams.page_size = params.pageSize
    
    const response = await api.get('/organizations', { params: queryParams })
    return response.data
  },

  get: async (orgId: number): Promise<Organization> => {
    const response = await api.get(`/organizations/${orgId}`)
    return response.data
  },

  create: async (data: OrganizationCreate): Promise<Organization> => {
    const response = await api.post('/organizations', data)
    return response.data
  },

  update: async (orgId: number, data: OrganizationUpdate): Promise<Organization> => {
    const response = await api.put(`/organizations/${orgId}`, data)
    return response.data
  },

  delete: async (orgId: number): Promise<MessageResponse> => {
    const response = await api.delete(`/organizations/${orgId}`)
    return response.data
  },
}

// ============ Reference Data API ============
export const referenceApi = {
  // Transaction Types
  getTransactionTypes: async (): Promise<TransactionType[]> => {
    const response = await api.get('/reference/transaction-types')
    return response.data
  },

  createTransactionType: async (name: string): Promise<TransactionType> => {
    const response = await api.post('/reference/transaction-types', { name })
    return response.data
  },

  updateTransactionType: async (
    id: number,
    data: { name?: string; isActive?: boolean }
  ): Promise<TransactionType> => {
    const response = await api.put(`/reference/transaction-types/${id}`, data)
    return response.data
  },

  // Process Types
  getProcessTypes: async (): Promise<ProcessType[]> => {
    const response = await api.get('/reference/process-types')
    return response.data
  },

  createProcessType: async (name: string): Promise<ProcessType> => {
    const response = await api.post('/reference/process-types', { name })
    return response.data
  },

  updateProcessType: async (
    id: number,
    data: { name?: string; isActive?: boolean }
  ): Promise<ProcessType> => {
    const response = await api.put(`/reference/process-types/${id}`, data)
    return response.data
  },

  // Order Statuses
  getOrderStatuses: async (): Promise<OrderStatus[]> => {
    const response = await api.get('/reference/order-statuses')
    return response.data
  },

  createOrderStatus: async (name: string): Promise<OrderStatus> => {
    const response = await api.post('/reference/order-statuses', { name })
    return response.data
  },

  updateOrderStatus: async (
    id: number,
    data: { name?: string; isActive?: boolean }
  ): Promise<OrderStatus> => {
    const response = await api.put(`/reference/order-statuses/${id}`, data)
    return response.data
  },

  // Divisions
  getDivisions: async (): Promise<Division[]> => {
    const response = await api.get('/reference/divisions')
    return response.data
  },

  createDivision: async (data: { name: string; description?: string }): Promise<Division> => {
    const response = await api.post('/reference/divisions', data)
    return response.data
  },

  updateDivision: async (
    id: number,
    data: { name?: string; description?: string }
  ): Promise<Division> => {
    const response = await api.put(`/reference/divisions/${id}`, data)
    return response.data
  },
}

// ============ Metrics API ============
export const metricsApi = {
  // Dashboard stats
  getDashboardStats: async (params?: { orgId?: number; teamId?: number; month?: number; year?: number }): Promise<DashboardStats> => {
    // Convert camelCase to snake_case for backend
    const queryParams: Record<string, unknown> = {}
    if (params?.orgId !== undefined) queryParams.org_id = params.orgId
    if (params?.teamId !== undefined) queryParams.team_id = params.teamId
    if (params?.month !== undefined) queryParams.month = params.month
    if (params?.year !== undefined) queryParams.year = params.year
    
    const response = await api.get('/metrics/dashboard', { params: queryParams })
    return response.data
  },

  // Employee metrics
  getEmployeeMetrics: async (params?: MetricsFilterParams): Promise<EmployeeMetricsListResponse> => {
    const response = await api.get('/metrics/employees', { params })
    return response.data
  },

  // List employee metrics with more flexible parameters
  listEmployeeMetrics: async (params?: {
    orgId?: number
    teamId?: number
    userId?: number
    periodType?: string
    startDate?: string
    endDate?: string
    page?: number
    pageSize?: number
  }): Promise<EmployeeMetricsListResponse> => {
    const queryParams: Record<string, unknown> = {}
    if (params?.orgId !== undefined) queryParams.org_id = params.orgId
    if (params?.teamId !== undefined) queryParams.team_id = params.teamId
    if (params?.userId !== undefined) queryParams.user_id = params.userId
    if (params?.periodType !== undefined) queryParams.period_type = params.periodType
    if (params?.startDate !== undefined) queryParams.start_date = params.startDate
    if (params?.endDate !== undefined) queryParams.end_date = params.endDate
    if (params?.page !== undefined) queryParams.page = params.page
    if (params?.pageSize !== undefined) queryParams.page_size = params.pageSize
    
    const response = await api.get('/metrics/employees', { params: queryParams })
    return response.data
  },

  getEmployeeMetricsByUser: async (
    userId: number,
    params?: MetricsFilterParams
  ): Promise<EmployeeMetrics[]> => {
    const response = await api.get(`/metrics/employees/${userId}`, { params })
    return response.data
  },

  // Team metrics
  getTeamMetrics: async (params?: MetricsFilterParams): Promise<TeamMetricsListResponse> => {
    const response = await api.get('/metrics/teams', { params })
    return response.data
  },

  getTeamMetricsByTeam: async (
    teamId: number,
    params?: MetricsFilterParams
  ): Promise<TeamMetrics[]> => {
    const response = await api.get(`/metrics/teams/${teamId}`, { params })
    return response.data
  },

  // Calculate metrics (admin only)
  calculateEmployeeMetrics: async (params: {
    userId: number
    date: string
    periodType: 'daily' | 'weekly' | 'monthly'
  }): Promise<EmployeeMetrics> => {
    const response = await api.post('/metrics/calculate/employee', params)
    return response.data
  },

  calculateTeamMetrics: async (params: {
    teamId: number
    date: string
    periodType: 'daily' | 'weekly' | 'monthly'
  }): Promise<TeamMetrics> => {
    const response = await api.post('/metrics/calculate/team', params)
    return response.data
  },
}

// ============ Database API (Admin only) ============
export const databaseApi = {
  reset: async (): Promise<DatabaseResetResponse> => {
    const response = await api.post('/database/reset-database')
    return response.data
  },
}

// ============ Productivity API ============
// NOTE: Target is per employee (not per team). Score is aggregated across ALL teams.
export const productivityApi = {
  // Get employee productivity for a date range (aggregates across all teams)
  getEmployeeProductivity: async (params: {
    userId: number
    startDate: string
    endDate: string
  }): Promise<EmployeeProductivity> => {
    const queryParams = {
      start_date: params.startDate,
      end_date: params.endDate,
    }
    const response = await api.get(`/productivity/employee/${params.userId}`, { params: queryParams })
    return response.data
  },

  // Get employee monthly productivity
  getEmployeeMonthlyProductivity: async (params: {
    userId: number
    year: number
    month: number
  }): Promise<EmployeeProductivity> => {
    const queryParams = {
      year: params.year,
      month: params.month,
    }
    const response = await api.get(`/productivity/employee/${params.userId}/monthly`, { params: queryParams })
    return response.data
  },

  // Get team productivity (shows all team members with their aggregated scores)
  getTeamProductivity: async (params: {
    teamId: number
    startDate: string
    endDate: string
  }): Promise<TeamProductivity> => {
    const queryParams = {
      start_date: params.startDate,
      end_date: params.endDate,
    }
    const response = await api.get(`/productivity/team/${params.teamId}`, { params: queryParams })
    return response.data
  },

  // Get productivity leaderboard
  getLeaderboard: async (params: {
    startDate: string
    endDate: string
    orgId?: number
    teamId?: number
    limit?: number
  }): Promise<ProductivityLeaderboardResponse> => {
    const queryParams: Record<string, unknown> = {
      start_date: params.startDate,
      end_date: params.endDate,
    }
    if (params.orgId !== undefined) queryParams.org_id = params.orgId
    if (params.teamId !== undefined) queryParams.team_id = params.teamId
    if (params.limit !== undefined) queryParams.limit = params.limit
    
    const response = await api.get('/productivity/leaderboard', { params: queryParams })
    return response.data
  },

  // Get my productivity (aggregates across all teams I belong to)
  getMyProductivity: async (params: {
    startDate: string
    endDate: string
  }): Promise<EmployeeProductivity> => {
    const queryParams = {
      start_date: params.startDate,
      end_date: params.endDate,
    }
    const response = await api.get('/productivity/my', { params: queryParams })
    return response.data
  },
}

// ============ Quality Audit API (Admin/Superadmin only) ============
export const qualityAuditApi = {
  // Create a new quality audit
  create: async (data: QualityAuditCreate): Promise<QualityAudit> => {
    const payload: Record<string, unknown> = {
      examiner_id: data.examinerId,
      team_id: data.teamId,
      process_type: data.processType,
      files_with_error: data.filesWithError,
      total_errors: data.totalErrors,
      files_with_cce_error: data.filesWithCceError,
      audit_date: data.auditDate,
      audit_period_start: data.auditPeriodStart,
      audit_period_end: data.auditPeriodEnd,
    }
    // Add totalFilesReviewed if provided
    if (data.totalFilesReviewed !== undefined) {
      payload.total_files_reviewed = data.totalFilesReviewed
    }
    const response = await api.post('/quality-audits', payload)
    return response.data
  },

  // List quality audits with filters
  list: async (params?: QualityAuditFilterParams): Promise<QualityAuditListResponse> => {
    const queryParams: Record<string, unknown> = {}
    if (params?.orgId !== undefined) queryParams.org_id = params.orgId
    if (params?.teamId !== undefined) queryParams.team_id = params.teamId
    if (params?.examinerId !== undefined) queryParams.examiner_id = params.examinerId
    if (params?.startDate) queryParams.start_date = params.startDate
    if (params?.endDate) queryParams.end_date = params.endDate
    if (params?.page) queryParams.page = params.page
    if (params?.pageSize) queryParams.page_size = params.pageSize

    const response = await api.get('/quality-audits', { params: queryParams })
    return response.data
  },

  // Get a specific quality audit
  get: async (id: number): Promise<QualityAudit> => {
    const response = await api.get(`/quality-audits/${id}`)
    return response.data
  },

  // Update a quality audit
  update: async (id: number, data: QualityAuditUpdate): Promise<QualityAudit> => {
    const payload: Record<string, unknown> = {}
    if (data.processType !== undefined) payload.process_type = data.processType
    if (data.filesWithError !== undefined) payload.files_with_error = data.filesWithError
    if (data.totalErrors !== undefined) payload.total_errors = data.totalErrors
    if (data.filesWithCceError !== undefined) payload.files_with_cce_error = data.filesWithCceError
    if (data.auditDate !== undefined) payload.audit_date = data.auditDate
    if (data.auditPeriodStart !== undefined) payload.audit_period_start = data.auditPeriodStart
    if (data.auditPeriodEnd !== undefined) payload.audit_period_end = data.auditPeriodEnd

    const response = await api.put(`/quality-audits/${id}`, payload)
    return response.data
  },

  // Delete a quality audit
  delete: async (id: number): Promise<void> => {
    await api.delete(`/quality-audits/${id}`)
  },

  // Get available process types with OFE values
  getProcessTypes: async (): Promise<ProcessTypeOFE[]> => {
    const response = await api.get('/quality-audits/process-types/list')
    return response.data.process_types
  },
}

// ============ Billing API ============
export const billingApi = {
  // List billing reports with filters
  list: async (params?: {
    teamId?: number
    billingMonth?: number
    billingYear?: number
    status?: string
  }): Promise<BillingReportListResponse> => {
    const response = await api.get('/billing', { params })
    return response.data
  },

  // Get a single billing report
  get: async (id: number): Promise<BillingReport> => {
    const response = await api.get(`/billing/${id}`)
    return response.data
  },

  // Preview billing data before creating report
  preview: async (data: BillingPreviewRequest): Promise<BillingPreviewResponse> => {
    const response = await api.post('/billing/preview', data)
    return response.data
  },

  // Create a new billing report
  create: async (data: BillingReportCreate): Promise<BillingReport> => {
    const response = await api.post('/billing', data)
    return response.data
  },

  // Finalize a billing report (marks orders as done)
  finalize: async (id: number): Promise<BillingReport> => {
    const response = await api.post(`/billing/${id}/finalize`)
    return response.data
  },

  // Delete a billing report (draft only)
  delete: async (id: number): Promise<void> => {
    await api.delete(`/billing/${id}`)
  },

  // Export billing report to Excel
  exportExcel: async (id: number): Promise<void> => {
    const response = await api.get(`/billing/${id}/export/excel`, {
      responseType: 'blob',
    })
    
    // Create a download link
    const url = window.URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    link.href = url
    
    // Extract filename from Content-Disposition header or use default
    const contentDisposition = response.headers['content-disposition']
    let filename = 'billing_report.xlsx'
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      if (filenameMatch && filenameMatch[1]) {
        filename = filenameMatch[1].replace(/['"]/g, '')
      }
    }
    
    link.setAttribute('download', filename)
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  },
}

// ============ Weekly Targets API ============
export const weeklyTargetsApi = {
  // Get current week info
  getCurrentWeek: async (): Promise<CurrentWeekInfo> => {
    const response = await api.get('/weekly-targets/current-week')
    return response.data
  },

  // Get team weekly targets for a specific week
  getTeamTargets: async (params: {
    teamId: number
    weekStartDate?: string
  }): Promise<TeamWeeklyTargetsResponse> => {
    const queryParams: Record<string, unknown> = {}
    if (params.weekStartDate) {
      queryParams.week_start_date = params.weekStartDate
    }
    const response = await api.get(`/weekly-targets/team/${params.teamId}`, { params: queryParams })
    return response.data
  },

  // Set/update weekly targets for team members
  setTeamTargets: async (
    teamId: number,
    data: WeeklyTargetBulkCreate
  ): Promise<WeeklyTargetSaveResponse> => {
    const payload = {
      week_start_date: data.weekStartDate,
      targets: data.targets.map(t => ({
        user_id: t.userId,
        target: t.target,
      })),
    }
    const response = await api.post(`/weekly-targets/team/${teamId}`, payload)
    return response.data
  },

  // Get employee target history
  getEmployeeTargets: async (params: {
    userId: number
    teamId: number
    startDate?: string
    endDate?: string
  }): Promise<EmployeeTargetHistoryResponse> => {
    const queryParams: Record<string, unknown> = {
      team_id: params.teamId,
    }
    if (params.startDate) queryParams.start_date = params.startDate
    if (params.endDate) queryParams.end_date = params.endDate
    const response = await api.get(`/weekly-targets/employee/${params.userId}`, { params: queryParams })
    return response.data
  },

  // Copy targets from previous week
  copyFromPreviousWeek: async (params: {
    teamId: number
    weekStartDate: string
  }): Promise<WeeklyTargetSaveResponse> => {
    const queryParams = {
      week_start_date: params.weekStartDate,
    }
    const response = await api.post(`/weekly-targets/copy-from-previous/${params.teamId}`, null, { params: queryParams })
    return response.data
  },
}

// ============ Attendance API ============
export const attendanceApi = {
  // Mark single attendance
  markAttendance: async (data: AttendanceRecordCreate): Promise<AttendanceRecord> => {
    const payload = {
      user_id: data.userId,
      team_id: data.teamId,
      date: data.date,
      status: data.status,
      notes: data.notes,
    }
    const response = await api.post('/attendance/mark', payload)
    return response.data
  },

  // Mark attendance for multiple employees
  markAttendanceBulk: async (data: AttendanceBulkCreate): Promise<{ message: string; recordsCreated: number }> => {
    const payload = {
      team_id: data.teamId,
      date: data.date,
      status: data.status,
      employee_ids: data.employeeIds,
    }
    const response = await api.post('/attendance/mark-bulk', payload)
    return response.data
  },

  // Get daily roster for a team
  getDailyRoster: async (teamId: number, date: string): Promise<DailyRosterResponse> => {
    const response = await api.get('/attendance/roster', {
      params: {
        team_id: teamId,
        date: date,
      },
    })
    return response.data
  },

  // Get employee attendance summary
  getEmployeeAttendance: async (
    userId: number,
    startDate: string,
    endDate: string
  ): Promise<AttendanceSummary> => {
    const response = await api.get(`/attendance/employee/${userId}`, {
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    })
    return response.data
  },

  // Get team attendance report
  getTeamAttendanceReport: async (
    teamId: number,
    startDate: string,
    endDate: string
  ): Promise<TeamAttendanceReport> => {
    const response = await api.get(`/attendance/reports/team/${teamId}`, {
      params: {
        start_date: startDate,
        end_date: endDate,
      },
    })
    return response.data
  },

  // Update attendance record
  updateAttendance: async (
    recordId: number,
    data: AttendanceRecordUpdate
  ): Promise<AttendanceRecord> => {
    const payload = {
      status: data.status,
      notes: data.notes,
    }
    const response = await api.put(`/attendance/${recordId}`, payload)
    return response.data
  },
}

// Legacy export for backward compatibility
export const resetDatabase = databaseApi.reset

export default api
