"""
Organization Model
Represents organizations (ODS-IND, ODS-VNM)
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Organization(Base):
    """Organization model - multi-tenant support"""
    __tablename__ = "organizations"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(100), nullable=False)  # ODS - IND, ODS - VNM
    code = Column(String(10), unique=True, nullable=False)  # IND, VNM
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    users = relationship("User", back_populates="organization")
    teams = relationship("Team", back_populates="organization")
    orders = relationship("Order", back_populates="organization")
    employee_metrics = relationship("EmployeePerformanceMetrics", back_populates="organization")
    team_metrics = relationship("TeamPerformanceMetrics", back_populates="organization")
    attendance_records = relationship("AttendanceRecord", back_populates="organization")
    
    # Indexes
    __table_args__ = (
        Index('idx_organizations_code', 'code', unique=True),
    )
