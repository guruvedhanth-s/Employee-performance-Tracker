import { useAuthStore } from '../store/authStore'
import { Permission, hasPermission, hasAnyPermission, hasAllPermissions, hasRole, hasAnyRole } from '../utils/rbac'
import type { UserRole } from '../types'

/**
 * Hook to check if current user has a specific permission
 */
export const usePermission = (permission: Permission): boolean => {
  const user = useAuthStore(state => state.user)
  return hasPermission(user, permission)
}

/**
 * Hook to check if current user has any of the specified permissions
 */
export const useAnyPermission = (permissions: Permission[]): boolean => {
  const user = useAuthStore(state => state.user)
  return hasAnyPermission(user, permissions)
}

/**
 * Hook to check if current user has all of the specified permissions
 */
export const useAllPermissions = (permissions: Permission[]): boolean => {
  const user = useAuthStore(state => state.user)
  return hasAllPermissions(user, permissions)
}

/**
 * Hook to check if current user has a specific role
 */
export const useRole = (role: UserRole): boolean => {
  const user = useAuthStore(state => state.user)
  return hasRole(user, role)
}

/**
 * Hook to check if current user has any of the specified roles
 */
export const useAnyRole = (roles: UserRole[]): boolean => {
  const user = useAuthStore(state => state.user)
  return hasAnyRole(user, roles)
}

/**
 * Hook to get current user
 */
export const useCurrentUser = () => {
  return useAuthStore(state => state.user)
}

/**
 * Hook to check if user is authenticated
 */
export const useIsAuthenticated = (): boolean => {
  return useAuthStore(state => state.isAuthenticated)
}
