"""
User Team Membership Model
Junction table for many-to-many relationship between users and teams
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class UserTeam(Base):
    """User-Team membership junction table"""
    __tablename__ = "user_teams"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    role = Column(String(50), default="member")  # member (leadership tracked in users.user_role)
    joined_at = Column(DateTime, default=datetime.utcnow)  # When user joined the team
    left_at = Column(DateTime, nullable=True)  # When user left (NULL if still member)
    is_active = Column(Boolean, default=True)  # Active membership
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="team_memberships")
    team = relationship("Team", back_populates="members")
    
    # Indexes
    __table_args__ = (
        Index('unique_user_team', 'user_id', 'team_id', unique=True),
        Index('idx_user_teams_user', 'user_id'),
        Index('idx_user_teams_team', 'team_id'),
        Index('idx_user_teams_team_active', 'team_id', 'is_active'),
        Index('idx_user_teams_active', 'is_active'),
    )
