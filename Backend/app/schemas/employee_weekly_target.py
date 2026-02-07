"""
Employee Weekly Target Schemas
Pydantic schemas for managing employee weekly productivity targets.

Business Logic:
- Target is per employee PER TEAM (each team lead sets target for their team)
- Employee's total target = SUM of targets from all teams they belong to
- Productivity = Total Score / Sum of All Team Targets × 100

Example:
- Employee X in Team A: target = 20 (set by Team A lead)
- Employee X in Team B: target = 15 (set by Team B lead)
- Employee X total target = 20 + 15 = 35
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


# ============ Employee Weekly Target Schemas ============

class EmployeeWeeklyTargetBase(BaseModel):
    """Base schema for employee weekly target"""
    user_id: int = Field(..., alias="userId")
    team_id: int = Field(..., alias="teamId")  # Team context for this target
    week_start_date: date = Field(..., alias="weekStartDate")
    week_end_date: date = Field(..., alias="weekEndDate")
    target: int = Field(..., ge=0, le=1000)  # Weekly target for this team

    class Config:
        populate_by_name = True


class EmployeeWeeklyTargetCreate(BaseModel):
    """Schema for creating a weekly target"""
    user_id: int = Field(..., alias="userId")
    team_id: int = Field(..., alias="teamId")  # Team context for this target
    week_start_date: date = Field(..., alias="weekStartDate")
    target: int = Field(..., ge=0, le=1000)

    class Config:
        populate_by_name = True


class EmployeeWeeklyTargetUpdate(BaseModel):
    """Schema for updating a weekly target"""
    target: int = Field(..., ge=0, le=1000)


class EmployeeWeeklyTargetResponse(BaseModel):
    """Response schema for weekly target"""
    id: int
    user_id: int = Field(..., alias="userId")
    team_id: int = Field(..., alias="teamId")  # Team context for this target
    week_start_date: date = Field(..., alias="weekStartDate")
    week_end_date: date = Field(..., alias="weekEndDate")
    target: int
    created_by: int = Field(..., alias="createdBy")
    created_at: datetime = Field(..., alias="createdAt")
    modified_at: datetime = Field(..., alias="modifiedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class EmployeeWeeklyTargetWithUserResponse(EmployeeWeeklyTargetResponse):
    """Response schema with user details"""
    user_name: Optional[str] = Field(None, alias="userName")
    team_name: Optional[str] = Field(None, alias="teamName")  # Team name for display

    class Config:
        from_attributes = True
        populate_by_name = True


# ============ Bulk Operations Schemas ============

class WeeklyTargetBulkEntry(BaseModel):
    """Single entry for bulk target update"""
    user_id: int = Field(..., alias="userId")
    target: int = Field(..., ge=0, le=1000)

    class Config:
        populate_by_name = True


class WeeklyTargetBulkCreate(BaseModel):
    """Schema for setting multiple employee targets at once"""
    week_start_date: date = Field(..., alias="weekStartDate")
    targets: List[WeeklyTargetBulkEntry]

    class Config:
        populate_by_name = True


# ============ Query/Response Schemas ============

class WeekInfo(BaseModel):
    """Information about a week"""
    week_start_date: date = Field(..., alias="weekStartDate")
    week_end_date: date = Field(..., alias="weekEndDate")
    is_current_week: bool = Field(..., alias="isCurrentWeek")
    is_past_week: bool = Field(..., alias="isPastWeek")
    can_edit: bool = Field(..., alias="canEdit")

    class Config:
        populate_by_name = True


class TeamMemberTargetEntry(BaseModel):
    """Target entry for a team member (target is per employee per team)"""
    user_id: int = Field(..., alias="userId")
    user_name: str = Field(..., alias="userName")
    employee_id: Optional[str] = Field(None, alias="employeeId")
    current_target: Optional[int] = Field(None, alias="currentTarget")  # Target for THIS team
    previous_target: Optional[int] = Field(None, alias="previousTarget")  # Previous week's target for THIS team
    target_id: Optional[int] = Field(None, alias="targetId")

    class Config:
        populate_by_name = True


class TeamWeeklyTargetsResponse(BaseModel):
    """Response containing all team member targets for a week"""
    team_id: int = Field(..., alias="teamId")
    team_name: str = Field(..., alias="teamName")
    week_info: WeekInfo = Field(..., alias="weekInfo")
    members: List[TeamMemberTargetEntry]

    class Config:
        populate_by_name = True


class EmployeeTargetHistoryResponse(BaseModel):
    """Historical targets for an employee"""
    user_id: int = Field(..., alias="userId")
    targets: List[EmployeeWeeklyTargetResponse]

    class Config:
        populate_by_name = True
