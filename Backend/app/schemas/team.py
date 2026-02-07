"""
Team Schemas
Pydantic schemas for team management, team states, and team products
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


# ============ Team State Schemas ============
class TeamStateBase(BaseModel):
    state: str = Field(..., max_length=50)


class TeamStateCreate(TeamStateBase):
    pass


class TeamStateResponse(TeamStateBase):
    id: int
    team_id: int = Field(..., alias="teamId")
    created_at: datetime = Field(..., alias="createdAt")
    modified_at: datetime = Field(..., alias="modifiedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


# ============ Team Product Schemas ============
class TeamProductBase(BaseModel):
    product_type: str = Field(..., max_length=100, alias="productType")


class TeamProductCreate(TeamProductBase):
    pass


class TeamProductResponse(TeamProductBase):
    id: int
    team_id: int = Field(..., alias="teamId")
    created_at: datetime = Field(..., alias="createdAt")
    modified_at: datetime = Field(..., alias="modifiedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


# ============ Team FA Name Schemas ============
class TeamFANameResponse(BaseModel):
    id: int
    team_id: int = Field(..., alias="teamId")
    fa_name: str = Field(..., alias="faName")
    is_active: bool = Field(..., alias="isActive")
    created_at: datetime = Field(..., alias="createdAt")
    modified_at: datetime = Field(..., alias="modifiedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


# ============ Team Schemas ============
class TeamBase(BaseModel):
    name: str = Field(..., max_length=100)
    org_id: int = Field(..., alias="orgId")
    team_lead_id: Optional[int] = Field(None, alias="teamLeadId")
    is_active: bool = Field(default=True, alias="isActive")
    # Productivity settings
    daily_target: int = Field(default=10, alias="dailyTarget", ge=1, le=100)
    monthly_target: Optional[int] = Field(default=None, alias="monthlyTarget", ge=0, le=100000)
    single_seat_score: float = Field(default=1.0, alias="singleSeatScore", ge=0.1, le=10.0)
    step1_score: float = Field(default=0.5, alias="step1Score", ge=0.1, le=10.0)
    step2_score: float = Field(default=0.5, alias="step2Score", ge=0.1, le=10.0)

    class Config:
        populate_by_name = True


class TeamCreate(TeamBase):
    states: List[str] = Field(default=[])  # List of state codes to add
    products: List[str] = Field(default=[])  # List of product types to add
    fa_names: List[int] = Field(default=[], alias="faNames")  # List of FA name IDs to add


class TeamUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    team_lead_id: Optional[int] = Field(None, alias="teamLeadId")
    is_active: Optional[bool] = Field(None, alias="isActive")
    # Productivity settings
    daily_target: Optional[int] = Field(None, alias="dailyTarget", ge=1, le=100)
    monthly_target: Optional[int] = Field(None, alias="monthlyTarget", ge=0, le=100000)
    single_seat_score: Optional[float] = Field(None, alias="singleSeatScore", ge=0.1, le=10.0)
    step1_score: Optional[float] = Field(None, alias="step1Score", ge=0.1, le=10.0)
    step2_score: Optional[float] = Field(None, alias="step2Score", ge=0.1, le=10.0)
    states: Optional[List[str]] = Field(None)
    products: Optional[List[str]] = Field(None)
    fa_names: Optional[List[int]] = Field(None, alias="faNames")  # List of FA name IDs to update

    class Config:
        populate_by_name = True


class TeamResponse(TeamBase):
    id: int
    states: List[TeamStateResponse] = []
    products: List[TeamProductResponse] = []
    fa_names: List[TeamFANameResponse] = Field(default=[], alias="faNames")
    created_at: datetime = Field(..., alias="createdAt")
    modified_at: datetime = Field(..., alias="modifiedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class TeamSimpleResponse(BaseModel):
    """Simplified team response without nested objects"""
    id: int
    name: str
    org_id: int = Field(..., alias="orgId")
    team_lead_id: Optional[int] = Field(None, alias="teamLeadId")
    is_active: bool = Field(..., alias="isActive")
    states: List[str] = []  # Just state codes
    products: List[str] = []  # Just product names
    fa_names: List[str] = Field(default=[], alias="faNames")  # Just FA name strings
    created_at: datetime = Field(..., alias="createdAt")
    modified_at: datetime = Field(..., alias="modifiedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class TeamListResponse(BaseModel):
    items: List[TeamResponse]
    total: int


# ============ User Team Membership Schemas ============
class UserTeamBase(BaseModel):
    user_id: int = Field(..., alias="userId")
    team_id: int = Field(..., alias="teamId")
    role: str = Field(default="member")


class UserTeamCreate(UserTeamBase):
    pass


class UserTeamUpdate(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = Field(None, alias="isActive")

    class Config:
        populate_by_name = True


class UserTeamResponse(UserTeamBase):
    id: int
    joined_at: datetime = Field(..., alias="joinedAt")
    left_at: Optional[datetime] = Field(None, alias="leftAt")
    is_active: bool = Field(..., alias="isActive")
    created_at: datetime = Field(..., alias="createdAt")
    modified_at: datetime = Field(..., alias="modifiedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class TeamMemberResponse(BaseModel):
    """Team member with user details"""
    id: int
    user_id: int = Field(..., alias="userId")
    user_name: str = Field(..., alias="userName")
    employee_id: str = Field(..., alias="employeeId")
    user_role: str = Field(..., alias="userRole")
    team_role: str = Field(..., alias="teamRole")
    joined_at: datetime = Field(..., alias="joinedAt")
    is_active: bool = Field(..., alias="isActive")

    class Config:
        from_attributes = True
        populate_by_name = True


class TeamWithMembersResponse(TeamResponse):
    """Team response with member list"""
    members: List[TeamMemberResponse] = []
