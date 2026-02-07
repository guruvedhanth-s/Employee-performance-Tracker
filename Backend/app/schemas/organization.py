"""
Organization Schemas
Pydantic schemas for organization management
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class OrganizationBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=10)  # IND, VNM
    is_active: bool = Field(default=True, serialization_alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)


class OrganizationCreate(OrganizationBase):
    pass


class OrganizationUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    code: Optional[str] = Field(None, max_length=10)
    is_active: Optional[bool] = Field(None, serialization_alias="isActive")

    model_config = ConfigDict(populate_by_name=True)


class OrganizationResponse(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool = Field(serialization_alias="isActive")
    created_at: datetime = Field(serialization_alias="createdAt")
    modified_at: datetime = Field(serialization_alias="modifiedAt")

    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class OrganizationListResponse(BaseModel):
    items: List[OrganizationResponse]
    total: int
