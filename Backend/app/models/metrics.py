"""
Performance Metrics Models
Employee and Team performance tracking
"""
from sqlalchemy import Column, Integer, String, Date, DateTime, ForeignKey, Index, Numeric, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class EmployeePerformanceMetrics(Base):
    """Employee performance metrics - daily/weekly/monthly aggregation"""
    __tablename__ = "employee_performance_metrics"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=True)  # Team context
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    metric_date = Column(Date, nullable=False)  # Date of metrics
    period_type = Column(String(20), nullable=False)  # daily, weekly, monthly
    
    # Order metrics
    total_orders_assigned = Column(Integer, default=0)
    total_step1_completed = Column(Integer, default=0)
    total_step2_completed = Column(Integer, default=0)
    total_single_seat_completed = Column(Integer, default=0)
    total_orders_completed = Column(Integer, default=0)
    
    # Time metrics (in minutes)
    total_working_minutes = Column(Integer, default=0)
    avg_step1_duration_minutes = Column(Integer, nullable=True)
    avg_step2_duration_minutes = Column(Integer, nullable=True)
    avg_order_completion_minutes = Column(Integer, nullable=True)
    
    # Status breakdown
    orders_on_hold = Column(Integer, default=0)
    orders_completed = Column(Integer, default=0)
    orders_bp_rti = Column(Integer, default=0)  # BP and RTI status
    
    # Quality/Efficiency
    efficiency_score = Column(Numeric(5, 2), nullable=True)  # 0-100
    quality_score = Column(Numeric(5, 2), nullable=True)
    
    # Calculation and soft delete
    calculation_status = Column(String(20), default='pending')  # pending, calculated, failed
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="performance_metrics", foreign_keys=[user_id])
    team = relationship("Team", back_populates="employee_metrics")
    organization = relationship("Organization", back_populates="employee_metrics")
    
    # Indexes
    __table_args__ = (
        Index('unique_emp_metrics', 'user_id', 'metric_date', 'period_type', unique=True),
        Index('idx_emp_metrics_org_period', 'org_id', 'period_type', 'metric_date'),
        Index('idx_emp_metrics_team_date', 'team_id', 'metric_date'),
        Index('idx_emp_metrics_date', 'metric_date'),
        Index('idx_emp_metrics_calc_status', 'calculation_status'),
        Index('idx_emp_metrics_deleted', 'deleted_at'),
    )


class TeamPerformanceMetrics(Base):
    """Team performance metrics - daily/weekly/monthly aggregation"""
    __tablename__ = "team_performance_metrics"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    metric_date = Column(Date, nullable=False)
    period_type = Column(String(20), nullable=False)  # daily, weekly, monthly
    
    # Order metrics
    total_orders_assigned = Column(Integer, default=0)
    total_orders_completed = Column(Integer, default=0)
    total_orders_in_progress = Column(Integer, default=0)
    total_orders_on_hold = Column(Integer, default=0)
    total_orders_bp_rti = Column(Integer, default=0)
    
    # Time metrics (in minutes)
    total_team_working_minutes = Column(Integer, default=0)
    avg_order_completion_minutes = Column(Integer, nullable=True)
    
    # Team composition
    active_employees_count = Column(Integer, default=0)
    
    # Performance indicators
    team_efficiency_score = Column(Numeric(5, 2), nullable=True)  # 0-100
    orders_per_employee = Column(Numeric(5, 2), nullable=True)
    completion_rate = Column(Numeric(5, 2), nullable=True)  # Percentage
    
    # Breakdowns (JSON)
    transaction_breakdown = Column(Text, nullable=True)  # JSON: breakdown by transaction type
    product_breakdown = Column(Text, nullable=True)  # JSON: breakdown by product type
    state_breakdown = Column(Text, nullable=True)  # JSON: breakdown by state
    
    # Calculation and soft delete
    calculation_status = Column(String(20), default='pending')
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    team = relationship("Team", back_populates="team_metrics")
    organization = relationship("Organization", back_populates="team_metrics")
    
    # Indexes
    __table_args__ = (
        Index('unique_team_metrics', 'team_id', 'metric_date', 'period_type', unique=True),
        Index('idx_team_metrics_org_period', 'org_id', 'period_type', 'metric_date'),
        Index('idx_team_metrics_date', 'metric_date'),
        Index('idx_team_metrics_calc_status', 'calculation_status'),
        Index('idx_team_metrics_deleted', 'deleted_at'),
    )
