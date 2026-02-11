/**
 * Utility helpers for common functions used across the application
 */

/**
 * Extracts initials from a name string
 * @param name - The full name or username
 * @returns Two-letter initials in uppercase
 */
export const getInitials = (name: string): string => {
  if (!name) return '??'
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Handles logout flow by logging out user and redirecting to login page
 * @param logout - Zustand logout function from auth store
 * @param navigate - React Router navigate function
 */
export const handleLogoutFlow = (logout: () => void, navigate: (path: string) => void): void => {
  logout()
  navigate('/login')
}

/**
 * Extracts user-friendly error message from various error response formats
 * Handles string errors, validation error arrays, and error objects
 * @param error - The error object from API response
 * @param defaultMsg - Default message if no error details found
 * @returns Formatted error message string
 */
export const parseApiError = (error: any, defaultMsg: string = 'An error occurred'): string => {
  const detail = error.response?.data?.detail
  if (!detail) return defaultMsg

  if (typeof detail === 'string') {
    return detail
  } else if (Array.isArray(detail)) {
    // Handle Pydantic validation errors (422)
    return detail.map((err: any) => err.msg || err.message || JSON.stringify(err)).join(', ')
  } else if (typeof detail === 'object') {
    return detail.msg || detail.message || JSON.stringify(detail)
  }
  return defaultMsg
}
