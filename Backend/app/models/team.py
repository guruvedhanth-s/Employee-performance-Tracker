"""
Team Model and Related Junction Tables
Teams and their associated states and products
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Team(Base):
    """Team model - groups of employees working on specific states/products"""
    __tablename__ = "teams"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    name = Column(String(100), nullable=False)  # Florida, California, GI Clearing, etc.
    team_lead_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Productivity settings - configurable per team
    daily_target = Column(Integer, nullable=False, default=10)  # Daily target orders per employee
    monthly_target = Column(Integer, nullable=True, default=None)  # Monthly target for entire team (set by admin)
    single_seat_score = Column(Numeric(4, 2), nullable=False, default=1.0)  # Score for Single Seat completion
    step1_score = Column(Numeric(4, 2), nullable=False, default=0.5)  # Score for Step 1 only completion
    step2_score = Column(Numeric(4, 2), nullable=False, default=0.5)  # Score for Step 2 only completion
    
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    organization = relationship("Organization", back_populates="teams")
    team_lead = relationship("User", back_populates="led_teams", foreign_keys=[team_lead_id])
    
    # Team states and products (one-to-many)
    states = relationship("TeamState", back_populates="team", cascade="all, delete-orphan")
    products = relationship("TeamProduct", back_populates="team", cascade="all, delete-orphan")
    
    # Team members (many-to-many via user_teams)
    members = relationship("UserTeam", back_populates="team")
    
    # Orders assigned to this team
    orders = relationship("Order", back_populates="team")
    
    # Performance metrics
    employee_metrics = relationship("EmployeePerformanceMetrics", back_populates="team")
    team_metrics = relationship("TeamPerformanceMetrics", back_populates="team")
    
    # FA names (pool-based) for this team
    fa_names = relationship("TeamFAName", back_populates="team", cascade="all, delete-orphan")
    
    # User aliases (team-specific FA names assigned to users)
    user_aliases = relationship("TeamUserAlias", back_populates="team", cascade="all, delete-orphan")
    
    # Attendance records for this team
    attendance_records = relationship("AttendanceRecord", back_populates="team")
    
    # Indexes
    __table_args__ = (
        Index('idx_teams_org', 'org_id'),
        Index('idx_teams_lead', 'team_lead_id'),
    )


class TeamState(Base):
    """Team states junction table - which states a team handles"""
    __tablename__ = "team_states"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    state = Column(String(50), nullable=False)  # Full state name: California, New York, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    team = relationship("Team", back_populates="states")
    
    # Indexes
    __table_args__ = (
        Index('unique_team_state', 'team_id', 'state', unique=True),
        Index('idx_team_states_team', 'team_id'),
    )


class TeamProduct(Base):
    """Team products junction table - which products a team handles"""
    __tablename__ = "team_products"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    product_type = Column(String(100), nullable=False)  # Full Search, M&B, RS Clear, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    team = relationship("Team", back_populates="products")
    
    # Indexes
    __table_args__ = (
        Index('unique_team_product', 'team_id', 'product_type', unique=True),
        Index('idx_team_products_team', 'team_id'),
    )
