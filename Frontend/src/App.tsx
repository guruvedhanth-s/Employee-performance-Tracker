import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { ProtectedRoute } from './components/common/ProtectedRoute'
import { LoginPage } from './pages/auth/LoginPage'
import { UnauthorizedPage } from './pages/auth/UnauthorizedPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import TeamLeadDashboard from './pages/teamlead/TeamLeadDashboard'
import TeamLeadMembersPage from './pages/teamlead/TeamMembersPage'
import TeamLeadOrdersPage from './pages/teamlead/TeamOrdersPage'
import TeamLeadProductivityPage from './pages/teamlead/TeamProductivityPage'
import TeamLeadTeamManagementPage from './pages/teamlead/TeamLeadTeamManagementPage'
import EmployeePerformancePage from './pages/teamlead/EmployeePerformancePage'
import EmployeeDashboard from './pages/employee/EmployeeDashboard'
import OrderEntryPage from './pages/employee/OrderEntryPage'
import OrderEditPage from './pages/employee/OrderEditPage'
import TeamReportsPage from './pages/admin/TeamReportsPage'
import TeamReportDetailPage from './pages/admin/TeamReportDetailPage'
import EmployeeReportsPage from './pages/admin/EmployeeReportsPage'
import EmployeeManagementPage from './pages/admin/EmployeeManagementPage'
import OrderAnalysisPage from './pages/admin/OrderAnalysisPage'
import OnboardingPage from './pages/admin/OnboardingPage'
import TeamManagementPage from './pages/admin/TeamManagementPage'
import ScoreManagementPage from './pages/admin/ScoreManagementPage'
import QualityAuditPage from './pages/admin/QualityAuditPage'
import BillingPage from './pages/admin/BillingPage'
import TeamMembersPage from './pages/admin/TeamMembersPage'
import EmployeeDetailPage from './pages/admin/EmployeeDetailPage'
import EmployeePerformanceDetailPage from './pages/admin/EmployeePerformanceDetailPage'
import OrganizationsPage from './pages/admin/OrganizationsPage'
import ProductivityReportsPage from './pages/admin/ProductivityReportsPage'
import EmployeeTargetsPage from './pages/admin/EmployeeTargetsPage'
import TeamAttendancePage from './pages/teamlead/TeamAttendancePage'
import TeamAttendanceReportsPage from './pages/teamlead/TeamAttendanceReportsPage'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      refetchOnReconnect: false,
      retry: 1,
      staleTime: 10 * 60 * 1000, // 10 minutes - data stays fresh longer
      gcTime: 30 * 60 * 1000, // 30 minutes - keep data in cache longer (formerly cacheTime)
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="min-h-screen bg-background">
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/unauthorized" element={<UnauthorizedPage />} />

            {/* Admin Routes */}
            <Route
              path="/admin/dashboard"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/teams"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <TeamReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/team-report/:id"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <TeamReportDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/employees"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <EmployeeReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/employee-management"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <EmployeeManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/orders"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <OrderAnalysisPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/onboarding"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <OnboardingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/team-management"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <TeamManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/score-management"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <ScoreManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/quality-audit"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin', 'team_lead']}>
                  <QualityAuditPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/billing"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <BillingPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/teams/:teamId/members"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <TeamMembersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/employees/:userId"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <EmployeeDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/employees/:userId/performance"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <EmployeePerformanceDetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/organizations"
              element={
                <ProtectedRoute requiredRoles={['superadmin']}>
                  <OrganizationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/productivity"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <ProductivityReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/employee-targets"
              element={
                <ProtectedRoute requiredRoles={['admin', 'superadmin']}>
                  <EmployeeTargetsPage />
                </ProtectedRoute>
              }
            />

            {/* Team Lead Routes */}
            <Route
              path="/teamlead/dashboard"
              element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <TeamLeadDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teamlead/team"
              element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <TeamLeadMembersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teamlead/orders"
              element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <TeamLeadOrdersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teamlead/productivity"
              element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <TeamLeadProductivityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teamlead/team-management"
              element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <TeamLeadTeamManagementPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teamlead/teams/:teamId/members"
              element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <TeamMembersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teamlead/teams/:teamId/targets"
              element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <EmployeeTargetsPage />
                </ProtectedRoute>
              }
            />

            <Route
              path="/teamlead/employee/:userId/performance"
              element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <EmployeePerformancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teamlead/quality-audit"
              element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <QualityAuditPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teamlead/attendance"
              element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <TeamAttendancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/teamlead/attendance/reports"
              element={
                <ProtectedRoute requiredRoles={['team_lead']}>
                  <TeamAttendanceReportsPage />
                </ProtectedRoute>
              }
            />

{/* Employee Routes */}
            <Route
              path="/employee/dashboard"
              element={
                <ProtectedRoute requiredRoles={['employee']}>
                  <EmployeeDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/new-order"
              element={
                <ProtectedRoute requiredRoles={['employee', 'team_lead', 'admin', 'superadmin']}>
                  <OrderEntryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/employee/edit-order/:orderId"
              element={
                <ProtectedRoute requiredRoles={['employee', 'team_lead', 'admin', 'superadmin']}>
                  <OrderEditPage />
                </ProtectedRoute>
              }
            />

            {/* Default Route */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            
            {/* 404 Route */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </div>
        <Toaster 
          position="top-right"
          toastOptions={{
            duration: 5000,
            error: {
              duration: 8000,
              style: {
                background: '#ef4444',
                color: '#fff',
              },
            },
            success: {
              duration: 3000,
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
