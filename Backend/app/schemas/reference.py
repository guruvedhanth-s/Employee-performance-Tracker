"""
Reference Tables Schemas
Pydantic schemas for reference/lookup tables
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


# ============ Transaction Type Schemas ============
class TransactionTypeBase(BaseModel):
    name: str = Field(..., max_length=100)
    is_active: bool = Field(default=True, serialization_alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)


class TransactionTypeCreate(TransactionTypeBase):
    pass


class TransactionTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    is_active: Optional[bool] = Field(None, serialization_alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)


class TransactionTypeResponse(BaseModel):
    id: int
    name: str
    is_active: bool = Field(serialization_alias="isActive")
    created_at: datetime = Field(serialization_alias="createdAt")
    modified_at: datetime = Field(serialization_alias="modifiedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============ Process Type Schemas ============
class ProcessTypeBase(BaseModel):
    name: str = Field(..., max_length=50)
    is_active: bool = Field(default=True, serialization_alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)


class ProcessTypeCreate(ProcessTypeBase):
    pass


class ProcessTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = Field(None, serialization_alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)


class ProcessTypeResponse(BaseModel):
    id: int
    name: str
    is_active: bool = Field(serialization_alias="isActive")
    created_at: datetime = Field(serialization_alias="createdAt")
    modified_at: datetime = Field(serialization_alias="modifiedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============ Order Status Schemas ============
class OrderStatusBase(BaseModel):
    name: str = Field(..., max_length=50)
    is_active: bool = Field(default=True, serialization_alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)


class OrderStatusCreate(OrderStatusBase):
    pass


class OrderStatusUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    is_active: Optional[bool] = Field(None, serialization_alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)


class OrderStatusResponse(BaseModel):
    id: int
    name: str
    is_active: bool = Field(serialization_alias="isActive")
    created_at: datetime = Field(serialization_alias="createdAt")
    modified_at: datetime = Field(serialization_alias="modifiedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


# ============ Division Schemas ============
class DivisionBase(BaseModel):
    name: str = Field(..., max_length=50)
    description: Optional[str] = None


class DivisionCreate(DivisionBase):
    pass


class DivisionUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None


class DivisionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime = Field(serialization_alias="createdAt")
    modified_at: datetime = Field(serialization_alias="modifiedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
