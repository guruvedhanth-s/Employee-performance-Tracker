"""
User Schemas
Pydantic schemas for user management and authentication
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


# ============ User Schemas ============
class UserBase(BaseModel):
    user_name: str = Field(..., max_length=100, serialization_alias="userName")
    employee_id: str = Field(..., max_length=50, serialization_alias="employeeId")
    user_role: str = Field(..., serialization_alias="userRole")
    org_id: Optional[int] = Field(None, serialization_alias="orgId")
    
    model_config = ConfigDict(populate_by_name=True)


class UserCreate(BaseModel):
    user_name: str = Field(..., max_length=100, alias="userName")
    employee_id: Optional[str] = Field(None, max_length=50, alias="employeeId")  # Auto-generated if not provided
    password: str = Field(..., min_length=8)
    user_role: str = Field(..., alias="userRole")
    org_id: Optional[int] = Field(None, alias="orgId")
    
    model_config = ConfigDict(populate_by_name=True)


class UserUpdate(BaseModel):
    user_name: Optional[str] = Field(None, max_length=100, alias="userName")
    user_role: Optional[str] = Field(None, alias="userRole")
    org_id: Optional[int] = Field(None, alias="orgId")
    is_active: Optional[bool] = Field(None, alias="isActive")

    model_config = ConfigDict(populate_by_name=True)


class UserResponse(BaseModel):
    id: int
    user_name: str = Field(serialization_alias="userName")
    employee_id: str = Field(serialization_alias="employeeId")
    user_role: str = Field(serialization_alias="userRole")
    org_id: Optional[int] = Field(serialization_alias="orgId")
    password_last_changed: Optional[datetime] = Field(None, serialization_alias="passwordLastChanged")
    last_login: Optional[datetime] = Field(None, serialization_alias="lastLogin")
    is_active: bool = Field(serialization_alias="isActive")
    created_at: datetime = Field(serialization_alias="createdAt")
    modified_at: datetime = Field(serialization_alias="modifiedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class UserWithTeamsResponse(UserResponse):
    """User response with team memberships"""
    teams: List["TeamMembershipResponse"] = []


class UserListResponse(BaseModel):
    items: List[UserResponse]
    total: int


# ============ Auth Schemas ============
class LoginRequest(BaseModel):
    user_name: str = Field(..., alias="userName")
    password: str

    model_config = ConfigDict(populate_by_name=True)


class LoginResponse(BaseModel):
    access_token: str = Field(serialization_alias="accessToken")
    refresh_token: str = Field(serialization_alias="refreshToken")
    token_type: str = Field(default="bearer", serialization_alias="tokenType")
    user: UserResponse

    model_config = ConfigDict(populate_by_name=True)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(..., alias="refreshToken")

    model_config = ConfigDict(populate_by_name=True)


class RefreshTokenResponse(BaseModel):
    access_token: str = Field(serialization_alias="accessToken")
    token_type: str = Field(default="bearer", serialization_alias="tokenType")

    model_config = ConfigDict(populate_by_name=True)


class ChangePasswordRequest(BaseModel):
    old_password: str = Field(..., alias="oldPassword")
    new_password: str = Field(..., min_length=8, alias="newPassword")

    model_config = ConfigDict(populate_by_name=True)


class ForgotPasswordRequest(BaseModel):
    user_name: str = Field(..., alias="userName")

    model_config = ConfigDict(populate_by_name=True)


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, alias="newPassword")

    model_config = ConfigDict(populate_by_name=True)


class TokenPayload(BaseModel):
    sub: str  # user id
    role: str
    user_name: str = Field(..., alias="userName")
    org_id: Optional[int] = Field(None, alias="orgId")
    exp: Optional[datetime] = None

    model_config = ConfigDict(populate_by_name=True)


# ============ Session Management Schemas ============
class SessionResponse(BaseModel):
    """Active session information"""
    session_id: str = Field(serialization_alias="sessionId")
    user_id: int = Field(serialization_alias="userId")
    device_info: str = Field(serialization_alias="deviceInfo")
    ip_address: str = Field(serialization_alias="ipAddress")
    user_agent: str = Field(serialization_alias="userAgent")
    created_at: str = Field(serialization_alias="createdAt")
    last_activity: str = Field(serialization_alias="lastActivity")
    expires_in_seconds: int = Field(serialization_alias="expiresInSeconds")
    
    model_config = ConfigDict(populate_by_name=True)


class SessionListResponse(BaseModel):
    """List of active sessions"""
    sessions: List[SessionResponse]
    total: int


class RevokeSessionRequest(BaseModel):
    """Request to revoke a specific session"""
    session_id: str = Field(..., alias="sessionId")
    
    model_config = ConfigDict(populate_by_name=True)


class RevokeAllSessionsResponse(BaseModel):
    """Response after revoking all sessions"""
    message: str
    sessions_revoked: int = Field(serialization_alias="sessionsRevoked")
    
    model_config = ConfigDict(populate_by_name=True)


# ============ Team Membership Schema (for circular import resolution) ============
class TeamMembershipResponse(BaseModel):
    """Team membership info embedded in user response"""
    team_id: int = Field(serialization_alias="teamId")
    team_name: str = Field(serialization_alias="teamName")
    role: str
    joined_at: datetime = Field(serialization_alias="joinedAt")
    is_active: bool = Field(serialization_alias="isActive")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# Update forward reference
UserWithTeamsResponse.model_rebuild()
