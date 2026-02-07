"""
Attendance API Endpoints
Team leads mark attendance for their team members
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import date

from app.database import get_db
from app.models.user import User
from app.services.attendance_service import AttendanceService
from app.schemas.attendance import (
    AttendanceRecordCreate,
    AttendanceBulkCreate,
    AttendanceRecordUpdate,
    AttendanceRecordResponse,
    DailyRosterResponse,
    AttendanceSummary,
    TeamAttendanceReport
)
from app.core.dependencies import (
    get_current_active_user,
    require_team_lead_or_admin,
    require_admin,
    ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD, ROLE_EMPLOYEE
)

router = APIRouter(prefix="/attendance", tags=["attendance"])


@router.post("/mark", response_model=AttendanceRecordResponse)
def mark_attendance(
    data: AttendanceRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_team_lead_or_admin)
):
    """
    Mark attendance for single employee
    Team leads can only mark for their team, admins for any team
    """
    service = AttendanceService(db)
    
    # Authorization check for team leads
    if current_user.user_role == "team_lead":
        # Check if current user is lead of the team
        from app.models.team import Team
        team = db.query(Team).filter(Team.id == data.team_id).first()
        if not team or team.team_lead_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only mark attendance for your own team"
            )
    
    return service.mark_attendance_single(
        user_id=data.user_id,
        team_id=data.team_id,
        check_date=data.date,
        status=data.status,
        marked_by=current_user.id,
        notes=data.notes
    )


@router.post("/mark-bulk", response_model=List[AttendanceRecordResponse])
def mark_attendance_bulk(
    data: AttendanceBulkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_team_lead_or_admin)
):
    """
    Bulk mark attendance for multiple employees
    Useful for "Mark All as Present" functionality
    """
    service = AttendanceService(db)
    
    # Authorization check for team leads
    if current_user.user_role == "team_lead":
        from app.models.team import Team
        team = db.query(Team).filter(Team.id == data.team_id).first()
        if not team or team.team_lead_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only mark attendance for your own team"
            )
    
    return service.mark_attendance_bulk(
        team_id=data.team_id,
        check_date=data.date,
        status=data.status,
        employee_ids=data.employee_ids,
        marked_by=current_user.id
    )


@router.get("/roster", response_model=DailyRosterResponse)
def get_daily_roster(
    team_id: int,
    date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_team_lead_or_admin)
):
    """
    Get daily roster with attendance status for all team members
    """
    service = AttendanceService(db)
    
    # Authorization check for team leads
    if current_user.user_role == "team_lead":
        from app.models.team import Team
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team or team.team_lead_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only view roster for your own team"
            )
    
    return service.get_daily_roster(team_id=team_id, check_date=date)


@router.get("/employee/{user_id}", response_model=AttendanceSummary)
def get_employee_attendance(
    user_id: int,
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """
    Get attendance summary for an employee
    Employees can view their own, team leads can view their team, admins can view all
    """
    service = AttendanceService(db)
    
    # Authorization check
    if current_user.user_role == "employee" and current_user.id != user_id:
        raise HTTPException(
            status_code=403,
            detail="You can only view your own attendance"
        )
    
    if current_user.user_role == "team_lead":
        # Check if user is in team lead's team
        from app.models.user_team import UserTeam
        from app.models.team import Team
        
        # Get teams led by current user
        led_teams = db.query(Team).filter(Team.team_lead_id == current_user.id).all()
        led_team_ids = [t.id for t in led_teams]
        
        # Check if target user is in any of these teams
        membership = db.query(UserTeam).filter(
            UserTeam.user_id == user_id,
            UserTeam.team_id.in_(led_team_ids)
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=403,
                detail="You can only view attendance for your team members"
            )
    
    return service.get_employee_attendance_summary(user_id, start_date, end_date)


@router.get("/reports/team/{team_id}", response_model=TeamAttendanceReport)
def get_team_attendance_report(
    team_id: int,
    start_date: date,
    end_date: date,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_team_lead_or_admin)
):
    """
    Generate team attendance report
    """
    service = AttendanceService(db)
    
    # Authorization check for team leads
    if current_user.user_role == "team_lead":
        from app.models.team import Team
        team = db.query(Team).filter(Team.id == team_id).first()
        if not team or team.team_lead_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only generate reports for your own team"
            )
    
    return service.get_team_attendance_report(team_id, start_date, end_date)


@router.put("/{record_id}", response_model=AttendanceRecordResponse)
def update_attendance(
    record_id: int,
    data: AttendanceRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_team_lead_or_admin)
):
    """
    Update existing attendance record
    """
    from app.models.attendance import AttendanceRecord
    
    record = db.query(AttendanceRecord).filter(AttendanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Attendance record not found")
    
    # Authorization check for team leads
    if current_user.user_role == "team_lead":
        from app.models.team import Team
        team = db.query(Team).filter(Team.id == record.team_id).first()
        if not team or team.team_lead_id != current_user.id:
            raise HTTPException(
                status_code=403,
                detail="You can only update attendance for your own team"
            )
    
    service = AttendanceService(db)
    return service.mark_attendance_single(
        user_id=record.user_id,
        team_id=record.team_id,
        check_date=record.date,
        status=data.status,
        marked_by=current_user.id,
        notes=data.notes
    )
