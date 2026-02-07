import React from 'react'
import { usePermission, useAnyPermission, useAnyRole } from '../../hooks/useAuth'
import { Permission, UserRole } from '../../utils/rbac'

interface PermissionGuardProps {
  children: React.ReactNode
  permission?: Permission
  permissions?: Permission[]
  fallback?: React.ReactNode
}

/**
 * Component that conditionally renders children based on user permissions
 */
export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  children,
  permission,
  permissions,
  fallback = null,
}) => {
  let hasAccess = false

  if (permission) {
    hasAccess = usePermission(permission)
  } else if (permissions && permissions.length > 0) {
    hasAccess = useAnyPermission(permissions)
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>
}

interface RoleGuardProps {
  children: React.ReactNode
  roles: UserRole[]
  fallback?: React.ReactNode
}

/**
 * Component that conditionally renders children based on user roles
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  roles,
  fallback = null,
}) => {
  const hasRole = useAnyRole(roles)

  return hasRole ? <>{children}</> : <>{fallback}</>
}

interface AdminOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Component that only renders for admin users
 */
export const AdminOnly: React.FC<AdminOnlyProps> = ({ children, fallback = null }) => {
  return (
    <RoleGuard roles={['admin']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

interface TeamLeadOnlyProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Component that only renders for team lead users
 */
export const TeamLeadOnly: React.FC<TeamLeadOnlyProps> = ({ children, fallback = null }) => {
  return (
    <RoleGuard roles={['team_lead']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}

interface TeamLeadOrAdminProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

/**
 * Component that renders for team lead or admin users
 */
export const TeamLeadOrAdmin: React.FC<TeamLeadOrAdminProps> = ({ children, fallback = null }) => {
  return (
    <RoleGuard roles={['admin', 'team_lead']} fallback={fallback}>
      {children}
    </RoleGuard>
  )
}
