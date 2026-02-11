"""
Error Handler Utility
Centralizes error handling patterns for consistent HTTP responses.
Eliminates duplicate HTTPException patterns across endpoints.
"""
from fastapi import HTTPException, status
from typing import Optional, Any, Dict
import logging

logger = logging.getLogger(__name__)


class ErrorHandler:
    """Standardized error handling with consistent HTTP responses"""
    
    @staticmethod
    def not_found(detail: str = "Resource not found", name: str = "Resource") -> HTTPException:
        """404 Not Found error"""
        logger.warning(f"404 - {name} not found: {detail}")
        return HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )
    
    @staticmethod
    def forbidden(detail: str = "Access denied") -> HTTPException:
        """403 Forbidden error"""
        logger.warning(f"403 - Forbidden: {detail}")
        return HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail
        )
    
    @staticmethod
    def unauthorized(detail: str = "Unauthorized") -> HTTPException:
        """401 Unauthorized error"""
        logger.warning(f"401 - Unauthorized: {detail}")
        return HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    @staticmethod
    def bad_request(detail: str = "Invalid request") -> HTTPException:
        """400 Bad Request error"""
        logger.warning(f"400 - Bad Request: {detail}")
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )
    
    @staticmethod
    def conflict(detail: str = "Resource already exists") -> HTTPException:
        """409 Conflict error"""
        logger.warning(f"409 - Conflict: {detail}")
        return HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail
        )
    
    @staticmethod
    def internal_error(detail: str = "Internal server error", log_exception: Optional[Exception] = None) -> HTTPException:
        """500 Internal Server Error"""
        if log_exception:
            logger.error(f"500 - Internal Server Error: {detail}", exc_info=log_exception)
        else:
            logger.error(f"500 - Internal Server Error: {detail}")
        
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=detail
        )
    
    # ============ Domain-Specific Errors ============
    
    @staticmethod
    def resource_not_found(resource_type: str, resource_id: Any) -> HTTPException:
        """Generic resource not found"""
        detail = f"{resource_type} with ID {resource_id} not found"
        return ErrorHandler.not_found(detail=detail, name=resource_type)
    
    @staticmethod
    def team_not_found(team_id: int) -> HTTPException:
        """Team not found error"""
        return ErrorHandler.resource_not_found("Team", team_id)
    
    @staticmethod
    def user_not_found(user_id: int) -> HTTPException:
        """User not found error"""
        return ErrorHandler.resource_not_found("User", user_id)
    
    @staticmethod
    def organization_not_found(org_id: int) -> HTTPException:
        """Organization not found error"""
        return ErrorHandler.resource_not_found("Organization", org_id)
    
    @staticmethod
    def order_not_found(order_id: int) -> HTTPException:
        """Order not found error"""
        return ErrorHandler.resource_not_found("Order", order_id)
    
    @staticmethod
    def no_team_access(team_id: Optional[int] = None) -> HTTPException:
        """User doesn't have access to team"""
        detail = "Cannot access this team"
        if team_id:
            detail += f" (Team: {team_id})"
        return ErrorHandler.forbidden(detail=detail)
    
    @staticmethod
    def no_org_access(org_id: Optional[int] = None) -> HTTPException:
        """User doesn't have access to organization"""
        detail = "Cannot access this organization"
        if org_id:
            detail += f" (Org: {org_id})"
        return ErrorHandler.forbidden(detail=detail)
    
    @staticmethod
    def insufficient_permissions(required_role: str) -> HTTPException:
        """User doesn't have required role"""
        detail = f"{required_role} access required"
        return ErrorHandler.forbidden(detail=detail)
    
    @staticmethod
    def team_lead_required() -> HTTPException:
        """Team lead or higher role required"""
        return ErrorHandler.insufficient_permissions("Team lead or higher")
    
    @staticmethod
    def admin_required() -> HTTPException:
        """Admin role required"""
        return ErrorHandler.insufficient_permissions("Admin")
    
    @staticmethod
    def superadmin_required() -> HTTPException:
        """Superadmin access required"""
        return ErrorHandler.insufficient_permissions("Superadmin")
    
    @staticmethod
    def employee_only_self_access(resource_type: str = "this resource") -> HTTPException:
        """Employees can only access their own data"""
        detail = f"Employees can only access their own {resource_type}"
        return ErrorHandler.forbidden(detail=detail)
    
    @staticmethod
    def resource_already_exists(resource_type: str, identifier: str = "") -> HTTPException:
        """Resource already exists"""
        detail = f"{resource_type} already exists"
        if identifier:
            detail += f" ({identifier})"
        return ErrorHandler.conflict(detail=detail)
    
    @staticmethod
    def invalid_input(field: str, reason: str) -> HTTPException:
        """Invalid input parameter"""
        detail = f"Invalid {field}: {reason}"
        return ErrorHandler.bad_request(detail=detail)
    
    @staticmethod
    def missing_required_field(field: str) -> HTTPException:
        """Required field is missing"""
        return ErrorHandler.bad_request(detail=f"Required field missing: {field}")
    
    @staticmethod
    def invalid_date_range() -> HTTPException:
        """Invalid date range (end before start)"""
        return ErrorHandler.bad_request(detail="End date must be after start date")
    
    @staticmethod
    def user_not_in_team(user_id: int, team_id: int) -> HTTPException:
        """User is not a member of team"""
        detail = f"User {user_id} is not a member of team {team_id}"
        return ErrorHandler.forbidden(detail=detail)
    
    @staticmethod
    def not_team_lead_of_team(user_id: int, team_id: int) -> HTTPException:
        """User is not the team lead of specified team"""
        detail = f"User {user_id} is not the team lead of team {team_id}"
        return ErrorHandler.forbidden(detail=detail)
    
    @staticmethod
    def handle_exception(
        exception: Exception,
        context: str = "",
        return_generic: bool = True
    ) -> HTTPException:
        """
        Handle unexpected exceptions with logging.
        
        Args:
            exception: The exception that occurred
            context: Optional context string for logging
            return_generic: If True, returns generic 500 error to client
            
        Returns:
            HTTPException to return to client
        """
        error_msg = f"Exception: {context}" if context else "Unexpected error"
        logger.error(error_msg, exc_info=exception)
        
        if return_generic:
            return ErrorHandler.internal_error(detail="An unexpected error occurred")
        else:
            return ErrorHandler.internal_error(
                detail=str(exception),
                log_exception=exception
            )
    
    @staticmethod
    def create_error_response(
        status_code: int,
        detail: str,
        error_code: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a standardized error response dictionary.
        
        Args:
            status_code: HTTP status code
            detail: Error detail message
            error_code: Optional error code for client handling
            
        Returns:
            Dictionary with error details
        """
        response = {
            "status": "error",
            "statusCode": status_code,
            "detail": detail,
        }
        if error_code:
            response["error_code"] = error_code
        return response
