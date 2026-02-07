"""
Attendance Schemas
Request/Response models for attendance API
"""
from pydantic import BaseModel, Field, validator
from typing import Optional, List, Dict
from datetime import date, datetime
from enum import Enum


class AttendanceStatus(str, Enum):
    """Attendance status enum"""
    PRESENT = "present"
    ABSENT = "absent"
    LEAVE = "leave"


class AttendanceRecordCreate(BaseModel):
    """Schema for creating single attendance record"""
    user_id: int = Field(alias="userId")
    team_id: int = Field(alias="teamId")
    date: date
    status: AttendanceStatus
    notes: Optional[str] = None
    
    class Config:
        populate_by_name = True
        use_enum_values = True


class AttendanceBulkCreate(BaseModel):
    """Schema for bulk creating attendance records"""
    team_id: int = Field(alias="teamId")
    date: date
    status: AttendanceStatus
    employee_ids: List[int] = Field(alias="employeeIds")
    notes: Optional[str] = None
    
    class Config:
        populate_by_name = True
        use_enum_values = True


class AttendanceRecordUpdate(BaseModel):
    """Schema for updating attendance record"""
    status: AttendanceStatus
    notes: Optional[str] = None
    
    class Config:
        use_enum_values = True


class AttendanceRecordResponse(BaseModel):
    """Schema for attendance record response"""
    id: int
    user_id: int = Field(alias="userId")
    user_name: str = Field(alias="userName")
    employee_id: str = Field(alias="employeeId")
    team_id: int = Field(alias="teamId")
    date: date
    status: str
    marked_by: int = Field(alias="markedBy")
    marked_by_name: str = Field(alias="markedByName")
    marked_at: datetime = Field(alias="markedAt")
    modified_by: Optional[int] = Field(alias="modifiedBy", default=None)
    modified_by_name: Optional[str] = Field(alias="modifiedByName", default=None)
    modified_at: Optional[datetime] = Field(alias="modifiedAt", default=None)
    notes: Optional[str] = None
    
    class Config:
        populate_by_name = True
        from_attributes = True


class DailyRosterEmployee(BaseModel):
    """Employee info for daily roster"""
    user_id: int = Field(alias="userId")
    user_name: str = Field(alias="userName")
    employee_id: str = Field(alias="employeeId")
    status: Optional[str] = None  # None means not marked (default absent)
    attendance_id: Optional[int] = Field(alias="attendanceId", default=None)
    notes: Optional[str] = None
    marked_by_name: Optional[str] = Field(alias="markedByName", default=None)
    marked_at: Optional[datetime] = Field(alias="markedAt", default=None)
    
    class Config:
        populate_by_name = True


class DailyRosterResponse(BaseModel):
    """Daily roster response with all team members"""
    team_id: int = Field(alias="teamId")
    team_name: str = Field(alias="teamName")
    date: date
    employees: List[DailyRosterEmployee]
    summary: Dict[str, int]  # {"present": X, "absent": Y, "leave": Z, "not_marked": W}
    
    class Config:
        populate_by_name = True


class AttendanceSummary(BaseModel):
    """Attendance summary for an employee or team"""
    user_id: Optional[int] = Field(alias="userId", default=None)
    user_name: Optional[str] = Field(alias="userName", default=None)
    employee_id: Optional[str] = Field(alias="employeeId", default=None)
    start_date: date = Field(alias="startDate")
    end_date: date = Field(alias="endDate")
    working_days: int = Field(alias="workingDays")
    days_present: int = Field(alias="daysPresent")
    days_absent: int = Field(alias="daysAbsent")
    days_leave: int = Field(alias="daysLeave")
    attendance_percent: float = Field(alias="attendancePercent")
    
    class Config:
        populate_by_name = True


class EmployeeAttendanceDetail(BaseModel):
    """Detailed attendance for single employee"""
    user_id: int = Field(alias="userId")
    user_name: str = Field(alias="userName")
    employee_id: str = Field(alias="employeeId")
    summary: AttendanceSummary
    daily_records: List[AttendanceRecordResponse] = Field(alias="dailyRecords")
    
    class Config:
        populate_by_name = True


class TeamAttendanceReport(BaseModel):
    """Team attendance report"""
    team_id: int = Field(alias="teamId")
    team_name: str = Field(alias="teamName")
    start_date: date = Field(alias="startDate")
    end_date: date = Field(alias="endDate")
    working_days: int = Field(alias="workingDays")
    employees: List[AttendanceSummary]
    team_summary: Dict[str, int] = Field(alias="teamSummary")  # Aggregate counts
    
    class Config:
        populate_by_name = True


class AttendanceAuditLogResponse(BaseModel):
    """Audit log response"""
    id: int
    attendance_record_id: Optional[int] = Field(alias="attendanceRecordId", default=None)
    user_id: int = Field(alias="userId")
    user_name: str = Field(alias="userName")
    team_id: int = Field(alias="teamId")
    team_name: str = Field(alias="teamName")
    date: date
    old_status: Optional[str] = Field(alias="oldStatus", default=None)
    new_status: str = Field(alias="newStatus")
    action: str
    changed_by: int = Field(alias="changedBy")
    changed_by_name: str = Field(alias="changedByName")
    changed_at: datetime = Field(alias="changedAt")
    notes: Optional[str] = None
    
    class Config:
        populate_by_name = True
        from_attributes = True
