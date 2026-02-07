"""
Billing Schemas
Pydantic models for billing report requests and responses
Now billing is done organization-wide by product type (not by team)
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List
from datetime import datetime


class BillingDetailResponse(BaseModel):
    """Billing detail for a product type (team + product type combination)"""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: int
    state: str
    product_type: str = Field(alias="productType")  # Format: "WA Direct Full Search"
    single_seat_count: int = Field(alias="singleSeatCount")
    only_step1_count: int = Field(alias="onlyStep1Count")
    only_step2_count: int = Field(alias="onlyStep2Count")
    total_count: int = Field(alias="totalCount")


class BillingReportResponse(BaseModel):
    """Billing report response with details - organization-wide, no team filtering"""
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)
    
    id: int
    org_id: int = Field(alias="orgId")
    team_id: Optional[int] = Field(None, alias="teamId")  # Always null for org-wide reports
    team_name: Optional[str] = Field("All Teams", alias="teamName")
    billing_month: int = Field(alias="billingMonth")
    billing_year: int = Field(alias="billingYear")
    status: str
    created_by: int = Field(alias="createdBy")
    created_by_name: Optional[str] = Field(None, alias="createdByName")
    finalized_by: Optional[int] = Field(None, alias="finalizedBy")
    finalized_by_name: Optional[str] = Field(None, alias="finalizedByName")
    finalized_at: Optional[datetime] = Field(None, alias="finalizedAt")
    created_at: datetime = Field(alias="createdAt")
    modified_at: datetime = Field(alias="modifiedAt")
    details: List[BillingDetailResponse] = []
    
    # Summary totals
    total_files: int = Field(0, alias="totalFiles")


class BillingReportListResponse(BaseModel):
    """List of billing reports"""
    items: List[BillingReportResponse]
    total: int


class BillingReportCreate(BaseModel):
    """Create a new billing report (admin/superadmin only) - always organization-wide"""
    billing_month: int = Field(alias="billingMonth", ge=1, le=12)
    billing_year: int = Field(alias="billingYear", ge=2020, le=2100)


class BillingReportFinalize(BaseModel):
    """Finalize a billing report - marks all orders as done"""
    pass  # No additional fields needed


class BillingPreviewRequest(BaseModel):
    """Request to preview billing data before generating report"""
    billing_month: int = Field(alias="billingMonth", ge=1, le=12)
    billing_year: int = Field(alias="billingYear", ge=2020, le=2100)


class BillingPreviewDetail(BaseModel):
    """Preview detail - grouped by product type with team prefix"""
    product_type: str = Field(alias="productType")  # Format: "WA Direct Full Search"
    single_seat_count: int = Field(alias="singleSeatCount")
    only_step1_count: int = Field(alias="onlyStep1Count")
    only_step2_count: int = Field(alias="onlyStep2Count")
    total_count: int = Field(alias="totalCount")


class BillingPreviewResponse(BaseModel):
    """Preview billing data before creating report - organization-wide"""
    billing_month: int = Field(alias="billingMonth")
    billing_year: int = Field(alias="billingYear")
    details: List[BillingPreviewDetail] = []
    total_files: int = Field(alias="totalFiles")
    pending_orders_count: int = Field(alias="pendingOrdersCount")
    teams_count: int = Field(alias="teamsCount")  # Number of teams included
