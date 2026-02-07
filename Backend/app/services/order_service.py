"""
Order Service
Business logic for order operations including audit trails and workflow
"""
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional, Dict, Any, List
from app.models.order import Order
from app.models.order_history import OrderHistory
from app.models.user import User


class OrderService:
    """Service for order business logic"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def log_change(
        self,
        order_id: int,
        changed_by: int,
        field_name: str,
        old_value: Optional[str],
        new_value: Optional[str],
        change_type: str
    ) -> OrderHistory:
        """Log a change to the order history"""
        history = OrderHistory(
            order_id=order_id,
            changed_by=changed_by,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            change_type=change_type
        )
        self.db.add(history)
        return history
    
    def soft_delete(self, order: Order, user_id: int) -> bool:
        """Soft delete an order"""
        if order.deleted_at:
            return False
        
        order.deleted_at = datetime.utcnow()
        order.deleted_by = user_id
        order.modified_by = user_id
        
        self.log_change(
            order.id, user_id, "deleted_at",
            None, str(order.deleted_at), "delete"
        )
        return True
    
    def restore(self, order: Order, user_id: int) -> bool:
        """Restore a soft-deleted order"""
        if not order.deleted_at:
            return False
        
        old_deleted = str(order.deleted_at)
        order.deleted_at = None
        order.deleted_by = None
        order.modified_by = user_id
        
        self.log_change(
            order.id, user_id, "deleted_at",
            old_deleted, None, "restore"
        )
        return True
    
    def update_with_audit(
        self,
        order: Order,
        update_data: Dict[str, Any],
        user_id: int
    ) -> List[str]:
        """
        Update order fields with audit logging
        Returns empty list (no fields are blocked now that locking is removed)
        """
        blocked_fields: List[str] = []
        
        for field, new_value in update_data.items():
            old_value = getattr(order, field)
            if old_value != new_value:
                self.log_change(
                    order.id, user_id, field,
                    str(old_value) if old_value is not None else None,
                    str(new_value) if new_value is not None else None,
                    "update"
                )
                setattr(order, field, new_value)
        
        order.modified_by = user_id
        return blocked_fields
    
    def calculate_step_duration(self, start_time: datetime, end_time: datetime) -> Optional[int]:
        """Calculate duration in minutes between start and end time"""
        if not start_time or not end_time:
            return None
        delta = end_time - start_time
        return int(delta.total_seconds() / 60)
    
    def is_completed(self, order: Order) -> bool:
        """Check if an order is considered completed based on steps"""
        # An order is considered completed if both steps are done (for two-step orders)
        # or if the single step is done (for single-step orders)
        return (order.step1_user_id is not None or order.step2_user_id is not None)
