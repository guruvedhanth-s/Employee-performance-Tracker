"""
Order Model
Core order tracking with step-based workflow
"""
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Date, ForeignKey, Index, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class Order(Base):
    """
    Order model with step-based workflow
    
    Business Logic - Process Types:
    - Step1: Only Step 1 is completed. step1_user_id filled, step2_user_id NULL
    - Step2: Only Step 2 is completed. step2_user_id filled, step1_user_id NULL
    - Single Seat: One user does both steps. step1_user_id = step2_user_id (same user)
    """
    __tablename__ = "orders"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    file_number = Column(String(100), nullable=False)  # Unique with product_type
    entry_date = Column(Date, nullable=False)  # Order entry date
    
    # Reference table foreign keys
    transaction_type_id = Column(Integer, ForeignKey("transaction_types.id"), nullable=False)
    process_type_id = Column(Integer, ForeignKey("process_types.id"), nullable=False)
    order_status_id = Column(Integer, ForeignKey("order_status.id"), nullable=False)
    division_id = Column(Integer, ForeignKey("divisions.id"), nullable=False)
    
    # Location
    state = Column(String(5), nullable=False)  # Filtered by team_states
    county = Column(String(100), nullable=False)  # Manual entry
    
    # Product and Team
    product_type = Column(String(100), nullable=False)  # Filtered by team_products
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    
    # Step 1 User (First Half)
    step1_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    step1_fa_name_id = Column(Integer, ForeignKey("fa_names.id", ondelete="SET NULL"), nullable=True)
    step1_start_time = Column(DateTime, nullable=True)
    step1_end_time = Column(DateTime, nullable=True)
    
    # Step 2 User (Second Half) - For Single Seat: same as step1_user_id
    step2_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    step2_fa_name_id = Column(Integer, ForeignKey("fa_names.id", ondelete="SET NULL"), nullable=True)
    step2_start_time = Column(DateTime, nullable=True)
    step2_end_time = Column(DateTime, nullable=True)
    
    # Billing
    billing_status = Column(String(20), default='pending')  # pending or done
    
    # Audit
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete timestamp
    deleted_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.now)
    modified_at = Column(DateTime, default=datetime.now, onupdate=datetime.now)
    
    # Relationships
    organization = relationship("Organization", back_populates="orders")
    team = relationship("Team", back_populates="orders")
    
    # Reference table relationships
    transaction_type = relationship("TransactionType")
    process_type = relationship("ProcessType")
    order_status = relationship("OrderStatusType")
    division = relationship("Division")
    
    # User relationships
    step1_user = relationship("User", back_populates="step1_orders", foreign_keys=[step1_user_id])
    step2_user = relationship("User", back_populates="step2_orders", foreign_keys=[step2_user_id])
    created_by_user = relationship("User", back_populates="created_orders", foreign_keys=[created_by])
    modified_by_user = relationship("User", back_populates="modified_orders", foreign_keys=[modified_by])
    deleted_by_user = relationship("User", back_populates="deleted_orders", foreign_keys=[deleted_by])
    
    # FA name relationships
    step1_fa_name = relationship("FAName", foreign_keys=[step1_fa_name_id])
    step2_fa_name = relationship("FAName", foreign_keys=[step2_fa_name_id])
    
    # Order history (audit trail)
    history = relationship("OrderHistory", back_populates="order", cascade="all, delete-orphan")
    
    # Indexes
    __table_args__ = (
        Index('idx_orders_file_product_team', 'file_number', 'product_type', 'team_id', unique=True),
        Index('idx_orders_file_number', 'file_number'),  # Non-unique index for file_number lookups
        Index('idx_orders_org_team', 'org_id', 'team_id'),
        Index('idx_orders_status', 'order_status_id'),
        Index('idx_orders_dates', 'entry_date'),
        Index('idx_orders_step1_user', 'step1_user_id'),
        Index('idx_orders_step2_user', 'step2_user_id'),
        Index('idx_orders_step1_fa_name', 'step1_fa_name_id'),
        Index('idx_orders_step2_fa_name', 'step2_fa_name_id'),
        Index('idx_orders_billing_status', 'billing_status'),
        Index('idx_orders_step1_user_status', 'step1_user_id', 'order_status_id'),
        Index('idx_orders_step2_user_status', 'step2_user_id', 'order_status_id'),
        Index('idx_orders_team_status_date', 'team_id', 'order_status_id', 'entry_date'),
        Index('idx_orders_deleted', 'deleted_at'),
        # Constraints
        CheckConstraint('step1_end_time IS NULL OR step1_end_time >= step1_start_time', name='chk_step1_end_after_start'),
        CheckConstraint('step2_end_time IS NULL OR step2_end_time >= step2_start_time', name='chk_step2_end_after_start'),
        CheckConstraint("billing_status IN ('pending', 'done')", name='chk_billing_status_values'),
    )
