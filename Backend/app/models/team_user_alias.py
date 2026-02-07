"""
Team User Alias Model
Maps users to their FA names within specific teams for order masking
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class TeamUserAlias(Base):
    """Team-specific user alias for masking real names in orders"""
    __tablename__ = "team_user_aliases"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    fa_name = Column(String(200), nullable=False)  # The masked/FA name for this user in this team
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    team = relationship("Team", back_populates="user_aliases")
    user = relationship("User", back_populates="team_aliases")
    
    # Indexes and constraints
    __table_args__ = (
        Index('idx_team_user_aliases_team_user', 'team_id', 'user_id'),
        Index('idx_team_user_aliases_user', 'user_id'),
        UniqueConstraint('team_id', 'user_id', name='uq_team_user_alias'),
    )
