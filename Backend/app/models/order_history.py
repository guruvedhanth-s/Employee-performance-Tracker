"""
Order History Model
Audit trail for tracking all changes to orders
"""
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class OrderHistory(Base):
    """Order history - audit trail for order changes"""
    __tablename__ = "order_history"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    order_id = Column(Integer, ForeignKey("orders.id"), nullable=False)
    changed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    field_name = Column(String(100), nullable=False)  # Name of field that was changed
    old_value = Column(Text, nullable=True)  # Previous value (JSON for complex fields)
    new_value = Column(Text, nullable=True)  # New value (JSON for complex fields)
    change_type = Column(String(50), nullable=False)  # create, update, delete, status_change, lock, unlock
    changed_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    order = relationship("Order", back_populates="history")
    changed_by_user = relationship("User", back_populates="order_changes")
    
    # Indexes
    __table_args__ = (
        Index('idx_history_order', 'order_id'),
        Index('idx_history_user', 'changed_by'),
        Index('idx_history_order_time', 'order_id', 'changed_at'),
        Index('idx_history_change_type', 'change_type'),
    )
