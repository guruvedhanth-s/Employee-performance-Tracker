"""
User Role Enums
Type-safe user role definitions to replace string constants.
Provides better IDE support and prevents typos.
"""
from enum import Enum


class UserRole(str, Enum):
    """User role enumeration with string values for backward compatibility"""
    
    SUPERADMIN = "superadmin"
    ADMIN = "admin"
    TEAM_LEAD = "team_lead"
    EMPLOYEE = "employee"
    
    def __str__(self) -> str:
        return self.value
    
    @classmethod
    def is_admin_or_higher(cls, role: 'UserRole') -> bool:
        """Check if role is admin or higher"""
        return role in (cls.SUPERADMIN, cls.ADMIN)
    
    @classmethod
    def is_team_lead_or_higher(cls, role: 'UserRole') -> bool:
        """Check if role is team lead or higher"""
        return role in (cls.SUPERADMIN, cls.ADMIN, cls.TEAM_LEAD)
    
    @classmethod
    def is_manager_or_higher(cls, role: 'UserRole') -> bool:
        """Check if role is manager-level or higher (team_lead+)"""
        return role in (cls.SUPERADMIN, cls.ADMIN, cls.TEAM_LEAD)


class AttendanceStatus(str, Enum):
    """Attendance status enumeration"""
    
    PRESENT = "present"
    ABSENT = "absent"
    LEAVE = "leave"
    NOT_MARKED = "not_marked"
    
    def __str__(self) -> str:
        return self.value


class BillingStatus(str, Enum):
    """Order billing status enumeration"""
    
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    
    def __str__(self) -> str:
        return self.value


class PeriodType(str, Enum):
    """Metrics period type enumeration"""
    
    DAILY = "daily"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    
    def __str__(self) -> str:
        return self.value


class AuditAction(str, Enum):
    """Audit log action enumeration"""
    
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    RESTORE = "restore"
    BULK_UPDATE = "bulk_update"
    
    def __str__(self) -> str:
        return self.value


# Backward compatibility: maintain constants that map to enum values
ROLE_SUPERADMIN = UserRole.SUPERADMIN.value
ROLE_ADMIN = UserRole.ADMIN.value
ROLE_TEAM_LEAD = UserRole.TEAM_LEAD.value
ROLE_EMPLOYEE = UserRole.EMPLOYEE.value

ATTENDANCE_PRESENT = AttendanceStatus.PRESENT.value
ATTENDANCE_ABSENT = AttendanceStatus.ABSENT.value
ATTENDANCE_LEAVE = AttendanceStatus.LEAVE.value
ATTENDANCE_NOT_MARKED = AttendanceStatus.NOT_MARKED.value

BILLING_NOT_STARTED = BillingStatus.NOT_STARTED.value
BILLING_IN_PROGRESS = BillingStatus.IN_PROGRESS.value
BILLING_PENDING = BillingStatus.PENDING.value
BILLING_COMPLETED = BillingStatus.COMPLETED.value
BILLING_CANCELLED = BillingStatus.CANCELLED.value

PERIOD_DAILY = PeriodType.DAILY.value
PERIOD_WEEKLY = PeriodType.WEEKLY.value
PERIOD_MONTHLY = PeriodType.MONTHLY.value
