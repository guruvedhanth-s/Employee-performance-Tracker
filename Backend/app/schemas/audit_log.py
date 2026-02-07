"""
Pydantic schemas for Audit Log API responses.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field
from datetime import datetime


class AuditLogBase(BaseModel):
    """Base schema for audit log"""
    entity_type: str = Field(..., description="Type of entity (User, Team, Order, etc.)")
    entity_id: str = Field(..., description="ID of the entity")
    entity_name: Optional[str] = Field(None, description="Human-readable name of the entity")
    action: str = Field(..., description="Action performed (create, update, delete, etc.)")
    description: Optional[str] = Field(None, description="Human-readable description")
    reason: Optional[str] = Field(None, description="Reason for the action")


class AuditLogResponse(AuditLogBase):
    """Schema for audit log response"""
    id: int
    changes: Optional[Dict[str, Dict[str, Any]]] = Field(None, description="Field-level changes")
    old_values: Optional[Dict[str, Any]] = Field(None, description="Complete snapshot before change")
    new_values: Optional[Dict[str, Any]] = Field(None, description="Complete snapshot after change")
    user_id: Optional[int] = Field(None, description="ID of user who made the change")
    username: Optional[str] = Field(None, description="Username who made the change")
    user_role: Optional[str] = Field(None, description="Role of user at time of change")
    ip_address: Optional[str] = Field(None, description="IP address of the request")
    user_agent: Optional[str] = Field(None, description="User agent string")
    endpoint: Optional[str] = Field(None, description="API endpoint")
    request_method: Optional[str] = Field(None, description="HTTP method")
    created_at: datetime = Field(..., description="When the change occurred")
    organization_id: Optional[int] = Field(None, description="Organization ID")
    
    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    """Schema for paginated list of audit logs"""
    logs: List[AuditLogResponse]
    total: int = Field(..., description="Total number of audit logs")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    pages: int = Field(..., description="Total number of pages")
    
    class Config:
        from_attributes = True


class AuditLogFilterParams(BaseModel):
    """Schema for audit log filter parameters"""
    entity_type: Optional[str] = Field(None, description="Filter by entity type")
    entity_id: Optional[str] = Field(None, description="Filter by entity ID")
    action: Optional[str] = Field(None, description="Filter by action type")
    user_id: Optional[int] = Field(None, description="Filter by user ID")
    organization_id: Optional[int] = Field(None, description="Filter by organization")
    start_date: Optional[datetime] = Field(None, description="Filter by start date")
    end_date: Optional[datetime] = Field(None, description="Filter by end date")
    page: int = Field(1, ge=1, description="Page number")
    page_size: int = Field(50, ge=1, le=200, description="Items per page")


class AuditLogSummary(BaseModel):
    """Summary statistics for audit logs"""
    total_logs: int
    entities_tracked: int
    actions_by_type: Dict[str, int]
    recent_activity: List[AuditLogResponse]
    
    class Config:
        from_attributes = True
