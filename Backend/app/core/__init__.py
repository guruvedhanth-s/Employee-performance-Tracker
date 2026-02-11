"""
Core Package
Core application utilities including enums, dependencies, configuration, and security.
"""

# Import and expose enums for type-safe role checking
from app.core.enums import (
    UserRole,
    AttendanceStatus,
    BillingStatus,
    PeriodType,
    AuditAction,
    # Backward compatibility constants
    ROLE_SUPERADMIN,
    ROLE_ADMIN,
    ROLE_TEAM_LEAD,
    ROLE_EMPLOYEE,
)

__all__ = [
    "UserRole",
    "AttendanceStatus",
    "BillingStatus",
    "PeriodType",
    "AuditAction",
    "ROLE_SUPERADMIN",
    "ROLE_ADMIN",
    "ROLE_TEAM_LEAD",
    "ROLE_EMPLOYEE",
]
