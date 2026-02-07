"""
Billing Model
Monthly billing records tracking file counts and revenue
"""
from sqlalchemy import Column, Integer, String, DateTime, Date, ForeignKey, Index, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class BillingReport(Base):
    """
    Billing report model - stores monthly billing snapshots
    
    Each report captures billing data for a specific month and team
    Once marked as 'done', all associated orders are marked as billed
    """
    __tablename__ = "billing_reports"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    
    # Billing period
    billing_month = Column(Integer, nullable=False)  # 1-12
    billing_year = Column(Integer, nullable=False)  # e.g., 2024
    
    # Status
    status = Column(String(20), default='draft')  # draft, finalized
    
    # Audit fields
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    finalized_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    finalized_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    modified_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    organization = relationship("Organization")
    team = relationship("Team")
    created_by_user = relationship("User", foreign_keys=[created_by])
    finalized_by_user = relationship("User", foreign_keys=[finalized_by])
    details = relationship("BillingDetail", back_populates="report", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_billing_org_team_period', 'org_id', 'team_id', 'billing_year', 'billing_month', unique=True),
        Index('idx_billing_status', 'status'),
        Index('idx_billing_period', 'billing_year', 'billing_month'),
    )


class BillingDetail(Base):
    """
    Billing detail model - breakdown by state and product type
    
    Each detail line represents file counts for a specific:
    - Team
    - State 
    - Product Type combination
    """
    __tablename__ = "billing_details"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    report_id = Column(Integer, ForeignKey("billing_reports.id", ondelete="CASCADE"), nullable=False)
    
    # Grouping dimensions
    state = Column(String(5), nullable=False)
    product_type = Column(String(100), nullable=False)
    
    # File counts - each type counts as 1 for billing
    single_seat_count = Column(Integer, default=0)  # step1_user_id = step2_user_id
    only_step1_count = Column(Integer, default=0)   # Only step1_user_id filled
    only_step2_count = Column(Integer, default=0)   # Only step2_user_id filled
    total_count = Column(Integer, default=0)        # Sum of all three
    
    created_at = Column(DateTime, default=datetime.now)
    
    # Relationships
    report = relationship("BillingReport", back_populates="details")
    
    # Indexes
    __table_args__ = (
        Index('idx_billing_details_report', 'report_id'),
        Index('idx_billing_details_state_product', 'state', 'product_type'),
    )
