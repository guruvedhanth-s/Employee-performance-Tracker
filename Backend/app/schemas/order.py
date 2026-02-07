"""
Order Schemas
Pydantic schemas for order management with step-based workflow
"""
from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Any
from datetime import date, datetime


# ============ Order Schemas ============
class OrderBase(BaseModel):
    file_number: str = Field(..., max_length=100, alias="fileNumber")
    entry_date: date = Field(..., alias="entryDate")
    transaction_type_id: int = Field(..., alias="transactionTypeId")
    process_type_id: int = Field(..., alias="processTypeId")
    order_status_id: int = Field(..., alias="orderStatusId")
    division_id: int = Field(..., alias="divisionId")
    state: str = Field(..., max_length=5)
    county: str = Field(..., max_length=100)
    product_type: str = Field(..., max_length=100, alias="productType")
    team_id: int = Field(..., alias="teamId")
    org_id: int = Field(..., alias="orgId")


class OrderCreate(OrderBase):
    # Step 1 (optional on create)
    step1_user_id: Optional[int] = Field(None, alias="step1UserId")
    step1_fa_name_id: Optional[int] = Field(None, alias="step1FaNameId")
    step1_start_time: Optional[datetime] = Field(None, alias="step1StartTime")
    step1_end_time: Optional[datetime] = Field(None, alias="step1EndTime")
    
    # Step 2 (optional on create)
    step2_user_id: Optional[int] = Field(None, alias="step2UserId")
    step2_fa_name_id: Optional[int] = Field(None, alias="step2FaNameId")
    step2_start_time: Optional[datetime] = Field(None, alias="step2StartTime")
    step2_end_time: Optional[datetime] = Field(None, alias="step2EndTime")


class OrderUpdate(BaseModel):
    entry_date: Optional[date] = Field(None, alias="entryDate")
    transaction_type_id: Optional[int] = Field(None, alias="transactionTypeId")
    process_type_id: Optional[int] = Field(None, alias="processTypeId")
    order_status_id: Optional[int] = Field(None, alias="orderStatusId")
    division_id: Optional[int] = Field(None, alias="divisionId")
    state: Optional[str] = Field(None, max_length=5)
    county: Optional[str] = Field(None, max_length=100)
    product_type: Optional[str] = Field(None, max_length=100, alias="productType")
    team_id: Optional[int] = Field(None, alias="teamId")
    
    # Step 1 updates
    step1_user_id: Optional[int] = Field(None, alias="step1UserId")
    step1_fa_name_id: Optional[int] = Field(None, alias="step1FaNameId")
    step1_start_time: Optional[datetime] = Field(None, alias="step1StartTime")
    step1_end_time: Optional[datetime] = Field(None, alias="step1EndTime")
    
    # Step 2 updates
    step2_user_id: Optional[int] = Field(None, alias="step2UserId")
    step2_fa_name_id: Optional[int] = Field(None, alias="step2FaNameId")
    step2_start_time: Optional[datetime] = Field(None, alias="step2StartTime")
    step2_end_time: Optional[datetime] = Field(None, alias="step2EndTime")
    
    billing_status: Optional[str] = Field(None, alias="billingStatus")

    @model_validator(mode='after')
    def validate_step_times(self):
        """Validate that end times are after start times for both steps"""
        # Validate Step 1 times
        if self.step1_start_time and self.step1_end_time:
            if self.step1_end_time <= self.step1_start_time:
                raise ValueError("Step 1 end time must be after start time")
        
        # Validate Step 2 times
        if self.step2_start_time and self.step2_end_time:
            if self.step2_end_time <= self.step2_start_time:
                raise ValueError("Step 2 end time must be after start time")
        
        return self

    class Config:
        populate_by_name = True


class StepInfo(BaseModel):
    """Step information embedded in order response"""
    user_id: Optional[int] = Field(None, alias="userId")
    user_name: Optional[str] = Field(None, alias="userName")
    fa_name: Optional[str] = Field(None, alias="faName")
    start_time: Optional[datetime] = Field(None, alias="startTime")
    end_time: Optional[datetime] = Field(None, alias="endTime")

    class Config:
        populate_by_name = True


class ReferenceTypeInfo(BaseModel):
    """Embedded reference type info"""
    id: int
    name: str

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    file_number: str = Field(..., alias="fileNumber")
    entry_date: date = Field(..., alias="entryDate")
    
    # Reference data (expanded)
    transaction_type_id: int = Field(..., alias="transactionTypeId")
    transaction_type: Optional[ReferenceTypeInfo] = Field(None, alias="transactionType")
    process_type_id: int = Field(..., alias="processTypeId")
    process_type: Optional[ReferenceTypeInfo] = Field(None, alias="processType")
    order_status_id: int = Field(..., alias="orderStatusId")
    order_status: Optional[ReferenceTypeInfo] = Field(None, alias="orderStatus")
    division_id: int = Field(..., alias="divisionId")
    division: Optional[ReferenceTypeInfo] = None
    
    # Location
    state: str
    county: str
    
    # Product and assignment
    product_type: str = Field(..., alias="productType")
    team_id: int = Field(..., alias="teamId")
    org_id: int = Field(..., alias="orgId")
    
    # Steps
    step1: Optional[StepInfo] = None
    step2: Optional[StepInfo] = None
    
    # Billing
    billing_status: str = Field(..., alias="billingStatus")
    
    # Audit
    created_by: int = Field(..., alias="createdBy")
    modified_by: Optional[int] = Field(None, alias="modifiedBy")
    created_at: datetime = Field(..., alias="createdAt")
    modified_at: datetime = Field(..., alias="modifiedAt")
    deleted_at: Optional[datetime] = Field(None, alias="deletedAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class OrderSimpleResponse(BaseModel):
    """Simplified order response for lists"""
    id: int
    file_number: str = Field(..., alias="fileNumber")
    entry_date: date = Field(..., alias="entryDate")
    state: str
    county: str
    product_type: str = Field(..., alias="productType")
    transaction_type_name: Optional[str] = Field(None, alias="transactionTypeName")
    process_type_name: Optional[str] = Field(None, alias="processTypeName")
    order_status_name: Optional[str] = Field(None, alias="orderStatusName")
    division_name: Optional[str] = Field(None, alias="divisionName")
    team_id: int = Field(..., alias="teamId")
    billing_status: str = Field(..., alias="billingStatus")
    created_at: datetime = Field(..., alias="createdAt")

    class Config:
        from_attributes = True
        populate_by_name = True


class OrderListResponse(BaseModel):
    items: List[OrderSimpleResponse]
    total: int


class OrderFilterParams(BaseModel):
    """Filter parameters for order queries"""
    org_id: Optional[int] = Field(None, alias="orgId")
    team_id: Optional[int] = Field(None, alias="teamId")
    order_status_id: Optional[int] = Field(None, alias="orderStatusId")
    step1_user_id: Optional[int] = Field(None, alias="step1UserId")
    step2_user_id: Optional[int] = Field(None, alias="step2UserId")
    billing_status: Optional[str] = Field(None, alias="billingStatus")
    state: Optional[str] = None
    start_date: Optional[date] = Field(None, alias="startDate")
    end_date: Optional[date] = Field(None, alias="endDate")
    include_deleted: bool = Field(False, alias="includeDeleted")
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=100, alias="pageSize")

    class Config:
        populate_by_name = True
