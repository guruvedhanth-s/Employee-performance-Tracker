"""
Attendance Service
Business logic for manual attendance marking by team leads
"""
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import date, datetime
from typing import List, Optional
from fastapi import HTTPException
from calendar import monthrange

from app.models.attendance import AttendanceRecord, AttendanceAuditLog
from app.models.user import User
from app.models.team import Team
from app.models.user_team import UserTeam
from app.schemas.attendance import (
    AttendanceRecordCreate,
    AttendanceBulkCreate,
    AttendanceRecordUpdate,
    AttendanceRecordResponse,
    DailyRosterEmployee,
    DailyRosterResponse,
    AttendanceSummary,
    EmployeeAttendanceDetail,
    TeamAttendanceReport,
    AttendanceAuditLogResponse
)


class AttendanceService:
    """Service for handling attendance operations"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def _validate_current_month(self, check_date: date) -> None:
        """Validate that date is in current month"""
        today = date.today()
        if check_date.year != today.year or check_date.month != today.month:
            raise HTTPException(
                status_code=400,
                detail="Can only mark/edit attendance for current month"
            )
    
    def _validate_team_membership(self, user_id: int, team_id: int) -> None:
        """Validate that user is an active member of the team"""
        membership = self.db.query(UserTeam).filter(
            UserTeam.user_id == user_id,
            UserTeam.team_id == team_id,
            UserTeam.is_active == True
        ).first()
        
        if not membership:
            raise HTTPException(
                status_code=400,
                detail="Employee is not a member of this team"
            )
    
    def _log_audit(
        self,
        attendance_record_id: Optional[int],
        user_id: int,
        team_id: int,
        check_date: date,
        old_status: Optional[str],
        new_status: str,
        changed_by: int,
        action: str,
        notes: Optional[str] = None
    ) -> None:
        """Create audit log entry"""
        audit_log = AttendanceAuditLog(
            attendance_record_id=attendance_record_id,
            user_id=user_id,
            team_id=team_id,
            date=check_date,
            old_status=old_status,
            new_status=new_status,
            changed_by=changed_by,
            action=action,
            notes=notes
        )
        self.db.add(audit_log)
    
    def mark_attendance_single(
        self,
        user_id: int,
        team_id: int,
        check_date: date,
        status: str,
        marked_by: int,
        notes: Optional[str] = None
    ) -> AttendanceRecordResponse:
        """Mark attendance for single employee on single date"""
        # Validate current month
        self._validate_current_month(check_date)
        
        # Validate team membership
        self._validate_team_membership(user_id, team_id)
        
        # Get user and organization
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if record exists
        existing = self.db.query(AttendanceRecord).filter(
            AttendanceRecord.user_id == user_id,
            AttendanceRecord.team_id == team_id,
            AttendanceRecord.date == check_date
        ).first()
        
        if existing:
            # Update existing record
            old_status = existing.status
            existing.status = status
            existing.modified_by = marked_by
            existing.modified_at = datetime.now()
            existing.notes = notes
            
            self._log_audit(
                existing.id, user_id, team_id, check_date,
                old_status, status, marked_by, 'update', notes
            )
            
            self.db.commit()
            self.db.refresh(existing)
            record = existing
        else:
            # Create new record
            record = AttendanceRecord(
                user_id=user_id,
                team_id=team_id,
                date=check_date,
                status=status,
                marked_by=marked_by,
                org_id=user.org_id,
                notes=notes
            )
            self.db.add(record)
            self.db.flush()
            
            self._log_audit(
                record.id, user_id, team_id, check_date,
                None, status, marked_by, 'create', notes
            )
            
            self.db.commit()
            self.db.refresh(record)
        
        # Build response
        marked_by_user = self.db.query(User).filter(User.id == marked_by).first()
        modified_by_user = None
        if record.modified_by:
            modified_by_user = self.db.query(User).filter(User.id == record.modified_by).first()
        
        return AttendanceRecordResponse(
            id=record.id,
            userId=record.user_id,
            userName=user.user_name,
            employeeId=user.employee_id,
            teamId=record.team_id,
            date=record.date,
            status=record.status,
            markedBy=record.marked_by,
            markedByName=marked_by_user.user_name if marked_by_user else "Unknown",
            markedAt=record.marked_at,
            modifiedBy=record.modified_by,
            modifiedByName=modified_by_user.user_name if modified_by_user else None,
            modifiedAt=record.modified_at,
            notes=record.notes
        )
    
    def mark_attendance_bulk(
        self,
        team_id: int,
        check_date: date,
        status: str,
        employee_ids: List[int],
        marked_by: int
    ) -> List[AttendanceRecordResponse]:
        """Bulk mark attendance for multiple employees"""
        # Validate current month
        self._validate_current_month(check_date)
        
        results = []
        for user_id in employee_ids:
            try:
                result = self.mark_attendance_single(
                    user_id, team_id, check_date, status, marked_by
                )
                results.append(result)
            except Exception as e:
                # Continue with other employees if one fails
                print(f"Failed to mark attendance for user {user_id}: {str(e)}")
                continue
        
        return results
    
    def get_daily_roster(
        self,
        team_id: int,
        check_date: date
    ) -> DailyRosterResponse:
        """Get daily roster with attendance status for all team members"""
        # Get team
        team = self.db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        
        # Get all active team members
        memberships = self.db.query(UserTeam).options(
            joinedload(UserTeam.user)
        ).filter(
            UserTeam.team_id == team_id,
            UserTeam.is_active == True
        ).all()
        
        # Get attendance records for this date
        attendance_records = self.db.query(AttendanceRecord).filter(
            AttendanceRecord.team_id == team_id,
            AttendanceRecord.date == check_date
        ).all()
        
        # Create dict for quick lookup
        attendance_dict = {r.user_id: r for r in attendance_records}
        
        # Build employee roster
        employees = []
        summary = {"present": 0, "absent": 0, "leave": 0, "not_marked": 0}
        
        # Batch query for all marked_by users to avoid N+1
        marked_by_ids = set()
        for attendance in attendance_records:
            if attendance.marked_by:
                marked_by_ids.add(attendance.marked_by)
        
        marked_by_users = {}
        if marked_by_ids:
            users = self.db.query(User).filter(User.id.in_(marked_by_ids)).all()
            marked_by_users = {u.id: u for u in users}
        
        for membership in memberships:
            user = membership.user
            if not user or not user.is_active:
                continue
            
            attendance = attendance_dict.get(user.id)
            
            if attendance:
                status = attendance.status
                attendance_id = attendance.id
                notes = attendance.notes
                marked_by_user = marked_by_users.get(attendance.marked_by)
                marked_by_name = marked_by_user.user_name if marked_by_user else None
                marked_at = attendance.marked_at
                summary[status] = summary.get(status, 0) + 1
            else:
                # Not marked - defaults to absent
                status = None
                attendance_id = None
                notes = None
                marked_by_name = None
                marked_at = None
                summary["not_marked"] += 1
            
            employees.append(DailyRosterEmployee(
                userId=user.id,
                userName=user.user_name,
                employeeId=user.employee_id,
                status=status,
                attendanceId=attendance_id,
                notes=notes,
                markedByName=marked_by_name,
                markedAt=marked_at
            ))
        
        return DailyRosterResponse(
            teamId=team_id,
            teamName=team.name,
            date=check_date,
            employees=employees,
            summary=summary
        )
    
    def get_employee_attendance_summary(
        self,
        user_id: int,
        start_date: date,
        end_date: date
    ) -> AttendanceSummary:
        """Get attendance summary for an employee"""
        # Get user
        user = self.db.query(User).filter(User.id == user_id).first()
        
        # Only count days up to today (don't count future days)
        today = date.today()
        effective_end_date = min(end_date, today)
        
        if not user:
            # Return empty summary instead of raising exception when called internally
            working_days_calc = (effective_end_date - start_date).days + 1 if effective_end_date >= start_date else 0
            return AttendanceSummary(
                userId=user_id,
                userName="Unknown",
                employeeId="Unknown",
                startDate=start_date,
                endDate=end_date,
                workingDays=working_days_calc,
                daysPresent=0,
                daysAbsent=working_days_calc,
                daysLeave=0,
                attendancePercent=0.0
            )
        
        # Calculate working days (only up to today, don't include future days)
        working_days = (effective_end_date - start_date).days + 1 if effective_end_date >= start_date else 0
        
        # Query attendance records (only up to today)
        records = self.db.query(AttendanceRecord).filter(
            AttendanceRecord.user_id == user_id,
            AttendanceRecord.date >= start_date,
            AttendanceRecord.date <= effective_end_date
        ).all()
        
        # Count by status
        days_present = sum(1 for r in records if r.status == 'present')
        days_leave = sum(1 for r in records if r.status == 'leave')
        # Default to absent for unmarked days (only past/today, not future)
        days_absent = working_days - days_present - days_leave
        
        # Calculate percentage (present days / total days)
        attendance_percent = (days_present / working_days * 100) if working_days > 0 else 0.0
        
        return AttendanceSummary(
            userId=user_id,
            userName=user.user_name,
            employeeId=user.employee_id,
            startDate=start_date,
            endDate=end_date,
            workingDays=working_days,
            daysPresent=days_present,
            daysAbsent=days_absent,
            daysLeave=days_leave,
            attendancePercent=round(attendance_percent, 2)
        )
    
    def get_team_attendance_report(
        self,
        team_id: int,
        start_date: date,
        end_date: date
    ) -> TeamAttendanceReport:
        """Generate team attendance report"""
        # Get team
        team = self.db.query(Team).filter(Team.id == team_id).first()
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        
        # Get all active team members
        memberships = self.db.query(UserTeam).filter(
            UserTeam.team_id == team_id,
            UserTeam.is_active == True
        ).all()
        
        # Only count days up to today (don't include future days)
        today = date.today()
        effective_end_date = min(end_date, today)
        working_days = (effective_end_date - start_date).days + 1 if effective_end_date >= start_date else 0
        
        # Get attendance summary for each employee
        employees = []
        team_present = 0
        team_absent = 0
        team_leave = 0
        
        for membership in memberships:
            user = membership.user
            if not user or not user.is_active:
                continue
            
            summary = self.get_employee_attendance_summary(
                user.id, start_date, end_date
            )
            employees.append(summary)
            
            team_present += summary.days_present
            team_absent += summary.days_absent
            team_leave += summary.days_leave
        
        return TeamAttendanceReport(
            teamId=team_id,
            teamName=team.name,
            startDate=start_date,
            endDate=end_date,
            workingDays=working_days,
            employees=employees,
            teamSummary={
                "total_present": team_present,
                "total_absent": team_absent,
                "total_leave": team_leave,
                "employee_count": len(employees)
            }
        )
