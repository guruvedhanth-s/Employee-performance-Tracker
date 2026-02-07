import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useIsAuthenticated, useCurrentUser, useAnyRole } from '../../hooks/useAuth'
import { hasPermission, Permission } from '../../utils/rbac'
import type { UserRole } from '../../types'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: UserRole[]
  requiredPermissions?: Permission[]
  fallbackPath?: string
}

/**
 * Protected route component that checks authentication and authorization
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles,
  requiredPermissions,
  fallbackPath = '/login',
}) => {
  const location = useLocation()
  const isAuthenticated = useIsAuthenticated()
  const user = useCurrentUser()

  // Check authentication
  if (!isAuthenticated || !user) {
    return <Navigate to={fallbackPath} state={{ from: location }} replace />
  }

  // Check role-based access
  if (requiredRoles && requiredRoles.length > 0) {
    const hasRequiredRole = requiredRoles.includes(user.userRole)
    if (!hasRequiredRole) {
      return <Navigate to="/unauthorized" replace />
    }
  }

  // Check permission-based access
  if (requiredPermissions && requiredPermissions.length > 0) {
    const hasRequiredPermission = requiredPermissions.every(permission =>
      hasPermission(user, permission)
    )
    if (!hasRequiredPermission) {
      return <Navigate to="/unauthorized" replace />
    }
  }

  return <>{children}</>
}

interface RoleBasedRouteProps {
  children: React.ReactNode
  allowedRoles: UserRole[]
}

/**
 * Route component that only renders for specific roles
 */
export const RoleBasedRoute: React.FC<RoleBasedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const hasRole = useAnyRole(allowedRoles)

  if (!hasRole) {
    return <Navigate to="/unauthorized" replace />
  }

  return <>{children}</>
}
