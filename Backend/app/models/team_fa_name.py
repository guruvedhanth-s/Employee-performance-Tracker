from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class TeamFAName(Base):
    """Junction table linking teams to FA names from master list"""
    __tablename__ = "team_fa_names"
    
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    fa_name_id = Column(Integer, ForeignKey("fa_names.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    team = relationship("Team", back_populates="fa_names")
    fa_name = relationship("FAName")
    
    # Ensure a team can't have the same FA name twice
    __table_args__ = (
        UniqueConstraint('team_id', 'fa_name_id', name='uq_team_fa_name_id'),
    )

