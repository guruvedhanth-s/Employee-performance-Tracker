"""
User Model
Represents system users with roles (superadmin, admin, team_lead, employee)
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    """User roles enum"""
    SUPERADMIN = "superadmin"   # Full access to both organizations
    ADMIN = "admin"             # Full access to single organization
    TEAM_LEAD = "team_lead"     # Manages team members and team performance
    EMPLOYEE = "employee"       # Works on orders


class User(Base):
    """User model - employees and administrators"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_name = Column(String(100), unique=True, nullable=False)  # Username (used for display and login)
    employee_id = Column(String(50), unique=True, nullable=False)  # Employee ID
    password_hash = Column(String(255), nullable=False)  # Hashed password
    password_last_changed = Column(DateTime, nullable=True)  # Security tracking
    must_change_password = Column(Boolean, default=False)  # True when admin resets password with temp password
    token_version = Column(Integer, default=0, nullable=False)  # Increment to invalidate all tokens
    user_role = Column(String(20), nullable=False)  # superadmin, admin, team_lead, employee
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=True)  # Nullable for superadmin
    last_login = Column(DateTime, nullable=True)  # Activity tracking
    is_active = Column(Boolean, default=True)
    deactivated_at = Column(DateTime, nullable=True)  # When user was deactivated/left the company
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = relationship("Organization", back_populates="users")
    
    # Team memberships (many-to-many via user_teams)
    team_memberships = relationship("UserTeam", back_populates="user")
    
    # Teams where this user is the lead
    led_teams = relationship("Team", back_populates="team_lead", foreign_keys="Team.team_lead_id")
    
    # Orders created by this user
    created_orders = relationship("Order", back_populates="created_by_user", foreign_keys="Order.created_by")
    modified_orders = relationship("Order", back_populates="modified_by_user", foreign_keys="Order.modified_by")
    deleted_orders = relationship("Order", back_populates="deleted_by_user", foreign_keys="Order.deleted_by")
    
    # Orders where user completed steps
    step1_orders = relationship("Order", back_populates="step1_user", foreign_keys="Order.step1_user_id")
    step2_orders = relationship("Order", back_populates="step2_user", foreign_keys="Order.step2_user_id")
    
    # Order history changes
    order_changes = relationship("OrderHistory", back_populates="changed_by_user")
    
    # Performance metrics
    performance_metrics = relationship("EmployeePerformanceMetrics", back_populates="user", 
                                       foreign_keys="EmployeePerformanceMetrics.user_id")
    
    # Password reset tokens
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user")
    
    # Team-specific aliases (fake names assigned to this user in different teams)
    team_aliases = relationship("TeamUserAlias", back_populates="user", cascade="all, delete-orphan")
    
    # Attendance records
    attendance_records = relationship("AttendanceRecord", back_populates="user", foreign_keys="AttendanceRecord.user_id")
    
    # Indexes
    __table_args__ = (
        Index('idx_users_org_role', 'org_id', 'user_role'),
        Index('idx_users_employee_id', 'employee_id'),
        Index('idx_users_username', 'user_name'),
        Index('idx_users_last_login', 'last_login'),
    )
