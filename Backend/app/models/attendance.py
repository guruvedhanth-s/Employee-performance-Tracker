"""
Attendance Models
Manual attendance marking by team leads
"""
from sqlalchemy import Column, Integer, String, Date, DateTime, Text, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class AttendanceRecord(Base):
    """
    Attendance records marked by team leads
    Sparse storage - only stores explicitly marked attendance
    Missing records default to 'absent'
    """
    __tablename__ = "attendance_records"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String(20), nullable=False)  # 'present', 'absent', 'leave'
    marked_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    marked_at = Column(DateTime, nullable=False, default=datetime.now)
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    modified_at = Column(DateTime, nullable=True)
    org_id = Column(Integer, ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False)
    notes = Column(Text, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="attendance_records")
    team = relationship("Team", back_populates="attendance_records")
    marked_by_user = relationship("User", foreign_keys=[marked_by])
    modified_by_user = relationship("User", foreign_keys=[modified_by])
    organization = relationship("Organization", back_populates="attendance_records")
    audit_logs = relationship("AttendanceAuditLog", back_populates="attendance_record", cascade="all, delete-orphan")
    
    # Indexes and constraints
    __table_args__ = (
        Index('idx_attendance_user_date', 'user_id', 'date'),
        Index('idx_attendance_team_date', 'team_id', 'date'),
        Index('idx_attendance_org_date', 'org_id', 'date'),
        Index('idx_attendance_status', 'status'),
        Index('idx_attendance_marked_by', 'marked_by'),
        Index('unique_attendance_record', 'user_id', 'team_id', 'date', unique=True),
    )


class AttendanceAuditLog(Base):
    """
    Audit trail for attendance changes
    Tracks all create, update, delete operations
    """
    __tablename__ = "attendance_audit_log"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    attendance_record_id = Column(Integer, ForeignKey("attendance_records.id", ondelete="CASCADE"), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    date = Column(Date, nullable=False)
    old_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    changed_at = Column(DateTime, nullable=False, default=datetime.now)
    action = Column(String(20), nullable=False)  # 'create', 'update', 'delete'
    notes = Column(Text, nullable=True)
    
    # Relationships
    attendance_record = relationship("AttendanceRecord", back_populates="audit_logs")
    user = relationship("User", foreign_keys=[user_id])
    team = relationship("Team")
    changed_by_user = relationship("User", foreign_keys=[changed_by])
    
    # Indexes
    __table_args__ = (
        Index('idx_audit_record', 'attendance_record_id'),
        Index('idx_audit_user', 'user_id'),
        Index('idx_audit_date', 'date'),
        Index('idx_audit_changed_by', 'changed_by'),
    )
