/**
 * Extracts a user-friendly error message from various error response formats
 * Handles string errors, validation error arrays, and error objects
 */
export const extractErrorMessage = (error: any, defaultMessage: string = 'An error occurred'): string => {
  // Check if there's a response with detail
  if (error.response?.data?.detail) {
    const detail = error.response.data.detail
    
    // If detail is a string, use it directly
    if (typeof detail === 'string') {
      return detail
    }
    
    // If detail is an array of validation errors (Pydantic format), format them
    if (Array.isArray(detail)) {
      return detail.map((err: any) => {
        if (typeof err === 'string') return err
        if (err.msg) return err.msg
        if (err.message) return err.message
        return 'Validation error'
      }).join(', ')
    }
    
    // If detail is an object, try to extract message
    if (typeof detail === 'object') {
      return detail.msg || detail.message || defaultMessage
    }
  }
  
  // Fallback to error message or default
  return error.message || defaultMessage
}
