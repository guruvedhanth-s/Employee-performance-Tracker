"""
Quality Audit Schemas
Pydantic models for quality audit data validation and serialization
"""
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


# OFE values mapping
PROCESS_TYPE_OFE = {
    "Full Search": 6,
    "Streamline": 5,
    "Update & DD": 3,
    "GI clearing": 1
}


class QualityAuditBase(BaseModel):
    """Base schema for quality audit"""
    examiner_id: int = Field(..., description="User ID of the examiner")
    team_id: int = Field(..., description="Team ID")
    process_type: str = Field(..., description="Process type: Full Search, Streamline, Update & DD, or GI clearing")
    
    # Optional manual entry for total files reviewed
    total_files_reviewed: Optional[int] = Field(None, ge=0, description="Total files reviewed (optional, will be fetched from DB if not provided)")
    
    # Manual entry fields
    files_with_error: int = Field(0, ge=0, description="Number of files with errors")
    total_errors: int = Field(0, ge=0, description="Total number of errors")
    files_with_cce_error: int = Field(0, ge=0, description="Number of files with CCE errors")
    
    # Audit period
    audit_date: date = Field(..., description="Date of the audit")
    audit_period_start: Optional[date] = Field(None, description="Optional audit period start date")
    audit_period_end: Optional[date] = Field(None, description="Optional audit period end date")
    
    @field_validator('process_type')
    @classmethod
    def validate_process_type(cls, v: str) -> str:
        """Validate process type is one of the allowed values"""
        if v not in PROCESS_TYPE_OFE:
            raise ValueError(f"Process type must be one of: {', '.join(PROCESS_TYPE_OFE.keys())}")
        return v


class QualityAuditCreate(QualityAuditBase):
    """Schema for creating a quality audit record"""
    # total_files_reviewed will be fetched from the database
    # Other calculated fields will be computed automatically
    pass


class QualityAuditUpdate(BaseModel):
    """Schema for updating a quality audit record"""
    process_type: Optional[str] = None
    files_with_error: Optional[int] = Field(None, ge=0)
    total_errors: Optional[int] = Field(None, ge=0)
    files_with_cce_error: Optional[int] = Field(None, ge=0)
    audit_date: Optional[date] = None
    audit_period_start: Optional[date] = None
    audit_period_end: Optional[date] = None
    
    @field_validator('process_type')
    @classmethod
    def validate_process_type(cls, v: Optional[str]) -> Optional[str]:
        """Validate process type if provided"""
        if v is not None and v not in PROCESS_TYPE_OFE:
            raise ValueError(f"Process type must be one of: {', '.join(PROCESS_TYPE_OFE.keys())}")
        return v


class QualityAuditResponse(BaseModel):
    """Schema for quality audit response"""
    id: int
    org_id: int
    examiner_id: int
    team_id: int
    process_type: str
    
    # Calculated fields
    ofe: int = Field(..., description="OFE value based on process type")
    total_files_reviewed: int = Field(..., description="Total files reviewed")
    ofe_count: int = Field(..., description="Files reviewed * OFE")
    
    # Manual entry fields
    files_with_error: int = Field(..., description="Number of files with errors")
    total_errors: int = Field(..., description="Total number of errors")
    files_with_cce_error: int = Field(..., description="Number of files with CCE errors")
    
    # Quality percentages (0.0 to 1.0, but displayed as 0% to 100%)
    fb_quality: Decimal = Field(..., description="FB Quality percentage (as decimal)")
    ofe_quality: Decimal = Field(..., description="OFE Quality percentage (as decimal)")
    cce_quality: Decimal = Field(..., description="CCE Quality percentage (as decimal)")
    
    # Dates
    audit_date: date
    audit_period_start: Optional[date] = None
    audit_period_end: Optional[date] = None
    
    # Metadata
    created_by: int
    modified_by: Optional[int] = None
    created_at: datetime
    modified_at: datetime
    
    # Related data (for display)
    examiner_name: Optional[str] = None
    team_name: Optional[str] = None
    
    class Config:
        from_attributes = True


class QualityAuditListItem(BaseModel):
    """Simplified schema for quality audit list view"""
    id: int
    examiner_id: int = Field(..., alias="examinerId")
    examiner_name: str = Field(..., alias="examinerName")
    team_name: str = Field(..., alias="teamName")
    process_type: str = Field(..., alias="processType")
    ofe: int
    total_files_reviewed: int = Field(..., alias="totalFilesReviewed")
    ofe_count: int = Field(..., alias="ofeCount")
    files_with_error: int = Field(..., alias="filesWithError")
    total_errors: int = Field(..., alias="totalErrors")
    files_with_cce_error: int = Field(..., alias="filesWithCceError")
    fb_quality: Decimal = Field(..., alias="fbQuality")
    ofe_quality: Decimal = Field(..., alias="ofeQuality")
    cce_quality: Decimal = Field(..., alias="cceQuality")
    audit_date: date = Field(..., alias="auditDate")
    created_at: datetime = Field(..., alias="createdAt")
    
    class Config:
        from_attributes = True
        populate_by_name = True
        # Serialize with aliases (camelCase) by default
        by_alias = True


class QualityAuditSummary(BaseModel):
    """Summary statistics for quality audits"""
    total_audits: int
    total_files_reviewed: int
    total_files_with_errors: int
    total_errors: int
    avg_fb_quality: float
    avg_ofe_quality: float
    avg_cce_quality: float
    best_performer: Optional[str] = None
    worst_performer: Optional[str] = None


class QualityAuditListResponse(BaseModel):
    """Paginated response for quality audit list"""
    items: list[QualityAuditListItem]
    total: int
    page: int
    page_size: int = Field(..., alias="pageSize")
    total_pages: int = Field(..., alias="totalPages")
    
    class Config:
        populate_by_name = True
        # Serialize with aliases (camelCase) by default
        by_alias = True
