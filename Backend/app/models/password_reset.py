"""
Password Reset Token Model
Secure password reset functionality
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class PasswordResetToken(Base):
    """Password reset tokens for secure password recovery"""
    __tablename__ = "password_reset_tokens"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(255), unique=True, nullable=False)  # Hashed token
    expires_at = Column(DateTime, nullable=False)  # Token expiration
    used_at = Column(DateTime, nullable=True)  # When token was used (NULL if not used)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="password_reset_tokens")
    
    # Indexes
    __table_args__ = (
        Index('idx_password_reset_user', 'user_id'),
        Index('idx_password_reset_token', 'token', unique=True),
        Index('idx_password_reset_user_expiry', 'user_id', 'expires_at'),
        Index('idx_password_reset_used', 'used_at'),
    )

