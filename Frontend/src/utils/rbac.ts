import type { User, UserRole } from '../types'

// Re-export UserRole for convenience
export type { UserRole } from '../types'

// Permission definitions
export const Permissions = {
  // Organization management
  CREATE_ORG: 'create:org',
  UPDATE_ORG: 'update:org',
  DELETE_ORG: 'delete:org',
  VIEW_ALL_ORGS: 'view:all_orgs',
  
  // User management
  CREATE_USER: 'create:user',
  UPDATE_USER: 'update:user',
  DELETE_USER: 'delete:user',
  VIEW_ALL_USERS: 'view:all_users',
  
  // Team management
  CREATE_TEAM: 'create:team',
  UPDATE_TEAM: 'update:team',
  DELETE_TEAM: 'delete:team',
  VIEW_ALL_TEAMS: 'view:all_teams',
  VIEW_OWN_TEAM: 'view:own_team',
  
  // Order management
  CREATE_ORDER: 'create:order',
  UPDATE_OWN_ORDER: 'update:own_order',
  UPDATE_ANY_ORDER: 'update:any_order',
  DELETE_ORDER: 'delete:order',
  VIEW_ALL_ORDERS: 'view:all_orders',
  VIEW_ORG_ORDERS: 'view:org_orders',
  VIEW_TEAM_ORDERS: 'view:team_orders',
  VIEW_OWN_ORDERS: 'view:own_orders',
  
  // Reports and analytics
  VIEW_ALL_REPORTS: 'view:all_reports',
  VIEW_ORG_REPORTS: 'view:org_reports',
  VIEW_TEAM_REPORTS: 'view:team_reports',
  VIEW_OWN_REPORTS: 'view:own_reports',
  
  // Billing
  MANAGE_BILLING: 'manage:billing',
  VIEW_ALL_BILLING: 'view:all_billing',
  VIEW_ORG_BILLING: 'view:org_billing',
  VIEW_TEAM_BILLING: 'view:team_billing',
} as const

export type Permission = typeof Permissions[keyof typeof Permissions]

// Role-based permissions mapping
const rolePermissions: Record<UserRole, Permission[]> = {
  superadmin: [
    // Super admins have all permissions across all organizations
    Permissions.CREATE_ORG,
    Permissions.UPDATE_ORG,
    Permissions.DELETE_ORG,
    Permissions.VIEW_ALL_ORGS,
    Permissions.CREATE_USER,
    Permissions.UPDATE_USER,
    Permissions.DELETE_USER,
    Permissions.VIEW_ALL_USERS,
    Permissions.CREATE_TEAM,
    Permissions.UPDATE_TEAM,
    Permissions.DELETE_TEAM,
    Permissions.VIEW_ALL_TEAMS,
    Permissions.CREATE_ORDER,
    Permissions.UPDATE_ANY_ORDER,
    Permissions.DELETE_ORDER,
    Permissions.VIEW_ALL_ORDERS,
    Permissions.VIEW_ALL_REPORTS,
    Permissions.MANAGE_BILLING,
    Permissions.VIEW_ALL_BILLING,
  ],
  admin: [
    // Admins have all permissions within their organization
    Permissions.CREATE_USER,
    Permissions.UPDATE_USER,
    Permissions.DELETE_USER,
    Permissions.VIEW_ALL_USERS,
    Permissions.CREATE_TEAM,
    Permissions.UPDATE_TEAM,
    Permissions.DELETE_TEAM,
    Permissions.VIEW_ALL_TEAMS,
    Permissions.CREATE_ORDER,
    Permissions.UPDATE_ANY_ORDER,
    Permissions.DELETE_ORDER,
    Permissions.VIEW_ORG_ORDERS,
    Permissions.VIEW_ORG_REPORTS,
    Permissions.VIEW_ORG_BILLING,
  ],
  team_lead: [
    // Team leads can manage their team
    Permissions.VIEW_OWN_TEAM,
    Permissions.VIEW_ALL_USERS,
    Permissions.CREATE_ORDER,
    Permissions.UPDATE_OWN_ORDER,
    Permissions.VIEW_TEAM_ORDERS,
    Permissions.VIEW_OWN_ORDERS,
    Permissions.VIEW_TEAM_REPORTS,
    Permissions.VIEW_TEAM_BILLING,
  ],
  employee: [
    // Employees can only manage their own work
    Permissions.CREATE_ORDER,
    Permissions.UPDATE_OWN_ORDER,
    Permissions.VIEW_OWN_ORDERS,
    Permissions.VIEW_OWN_REPORTS,
  ],
}

/**
 * Check if a user has a specific permission
 */
export const hasPermission = (user: User | null, permission: Permission): boolean => {
  if (!user) return false
  const permissions = rolePermissions[user.userRole]
  return permissions?.includes(permission) ?? false
}

/**
 * Check if a user has any of the specified permissions
 */
export const hasAnyPermission = (user: User | null, permissions: Permission[]): boolean => {
  if (!user) return false
  return permissions.some(permission => hasPermission(user, permission))
}

/**
 * Check if a user has all of the specified permissions
 */
export const hasAllPermissions = (user: User | null, permissions: Permission[]): boolean => {
  if (!user) return false
  return permissions.every(permission => hasPermission(user, permission))
}

/**
 * Check if user has a specific role
 */
export const hasRole = (user: User | null, role: UserRole): boolean => {
  return user?.userRole === role
}

/**
 * Check if user has any of the specified roles
 */
export const hasAnyRole = (user: User | null, roles: UserRole[]): boolean => {
  if (!user) return false
  return roles.includes(user.userRole)
}

/**
 * Check if user is a superadmin
 */
export const isSuperAdmin = (user: User | null): boolean => {
  return user?.userRole === 'superadmin'
}

/**
 * Check if user is an admin
 */
export const isAdmin = (user: User | null): boolean => {
  return user?.userRole === 'admin'
}

/**
 * Check if user is a team lead
 */
export const isTeamLead = (user: User | null): boolean => {
  return user?.userRole === 'team_lead'
}

/**
 * Check if user is an employee
 */
export const isEmployee = (user: User | null): boolean => {
  return user?.userRole === 'employee'
}

/**
 * Check if user is admin or superadmin
 */
export const isAdminOrSuperAdmin = (user: User | null): boolean => {
  return hasAnyRole(user, ['admin', 'superadmin'])
}

/**
 * Check if user is team lead or higher
 */
export const isTeamLeadOrHigher = (user: User | null): boolean => {
  return hasAnyRole(user, ['team_lead', 'admin', 'superadmin'])
}

/**
 * Check if user can manage another user
 */
export const canManageUser = (currentUser: User | null, targetUser: User): boolean => {
  if (!currentUser) return false
  if (isSuperAdmin(currentUser)) return true
  if (isAdmin(currentUser) && currentUser.orgId === targetUser.orgId) return true
  return false
}

/**
 * Get user role display name
 */
export const getRoleDisplayName = (role: UserRole): string => {
  const roleNames: Record<UserRole, string> = {
    superadmin: 'Super Administrator',
    admin: 'Administrator',
    team_lead: 'Team Lead',
    employee: 'Employee',
  }
  return roleNames[role]
}

/**
 * Get available roles for user to assign
 */
export const getAssignableRoles = (user: User | null): UserRole[] => {
  if (!user) return []
  if (isSuperAdmin(user)) return ['superadmin', 'admin', 'team_lead', 'employee']
  if (isAdmin(user)) return ['admin', 'team_lead', 'employee']
  if (isTeamLead(user)) return ['employee']
  return []
}

/**
 * Get all available roles
 */
export const getAllRoles = (): UserRole[] => {
  return ['superadmin', 'admin', 'team_lead', 'employee']
}
