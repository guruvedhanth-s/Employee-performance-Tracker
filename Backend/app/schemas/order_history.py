"""
Order History Schemas
Pydantic schemas for audit trail
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class OrderHistoryBase(BaseModel):
    order_id: int = Field(..., alias="orderId")
    field_name: str = Field(..., max_length=100, alias="fieldName")
    old_value: Optional[str] = Field(None, alias="oldValue")
    new_value: Optional[str] = Field(None, alias="newValue")
    change_type: str = Field(..., max_length=50, alias="changeType")


class OrderHistoryCreate(OrderHistoryBase):
    changed_by: int = Field(..., alias="changedBy")


class OrderHistoryResponse(OrderHistoryBase):
    id: int
    changed_by: int = Field(..., alias="changedBy")
    changed_by_name: Optional[str] = Field(None, alias="changedByName")
    changed_at: datetime = Field(..., alias="changedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class OrderHistoryListResponse(BaseModel):
    items: List[OrderHistoryResponse]
    total: int
