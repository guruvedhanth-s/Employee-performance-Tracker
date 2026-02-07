"""
Billing API Endpoints
Admin and SuperAdmin only access
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from io import BytesIO
from app.database import get_db
from app.models.user import User
from app.schemas.billing import (
    BillingReportCreate,
    BillingReportResponse,
    BillingReportListResponse,
    BillingReportFinalize,
    BillingPreviewRequest,
    BillingPreviewResponse
)
from app.services import billing_service
from app.core.dependencies import require_admin

router = APIRouter()


@router.get("", response_model=BillingReportListResponse)
def list_billing_reports(
    billing_month: Optional[int] = Query(None, ge=1, le=12),
    billing_year: Optional[int] = Query(None, ge=2020, le=2100),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    List organization-wide billing reports with optional filters
    No team filtering - all reports are org-wide
    Admin/SuperAdmin only
    """
    reports = billing_service.get_billing_reports(
        db=db,
        org_id=current_user.org_id,
        billing_month=billing_month,
        billing_year=billing_year,
        status=status
    )
    
    return BillingReportListResponse(
        items=reports,
        total=len(reports)
    )


@router.get("/{report_id}", response_model=BillingReportResponse)
def get_billing_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Get a single billing report by ID
    Admin/SuperAdmin only
    """
    report = billing_service.get_billing_report_by_id(db, report_id)
    
    # Verify report belongs to user's org
    if report.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return report


@router.post("/preview", response_model=BillingPreviewResponse)
def preview_billing(
    request: BillingPreviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Preview billing data before generating report
    Shows what will be included without creating the report
    Admin/SuperAdmin only
    """
    return billing_service.preview_billing_data(
        db=db,
        org_id=current_user.org_id,
        request=request
    )


@router.post("")
def create_billing_report(
    data: BillingReportCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Create organization-wide billing report grouped by product types
    Admin/SuperAdmin only
    """
    return billing_service.create_billing_report(
        db=db,
        org_id=current_user.org_id,
        current_user_id=current_user.id,
        data=data
    )


@router.post("/{report_id}/finalize", response_model=BillingReportResponse)
def finalize_billing_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Finalize a billing report
    - Marks report as 'finalized'
    - Updates all associated orders from 'pending' to 'done'
    Admin/SuperAdmin only
    """
    # Get report to verify org
    report = billing_service.get_billing_report_by_id(db, report_id)
    
    if report.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    return billing_service.finalize_billing_report(
        db=db,
        report_id=report_id,
        current_user_id=current_user.id
    )


@router.delete("/{report_id}")
def delete_billing_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Delete a billing report (only if in draft status)
    Admin/SuperAdmin only
    """
    # Get report to verify org
    report = billing_service.get_billing_report_by_id(db, report_id)
    
    if report.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    billing_service.delete_billing_report(db, report_id)
    
    return {"message": "Billing report deleted successfully"}


@router.get("/{report_id}/export/excel")
def export_billing_report_excel(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    """
    Export billing report to Excel format
    Admin/SuperAdmin only
    """
    # Get report to verify org
    report = billing_service.get_billing_report_by_id(db, report_id)
    
    if report.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Generate Excel file
    excel_file = billing_service.export_billing_report_to_excel(db, report_id)
    
    # Create filename
    filename = f"billing_report_{report.team_name}_{report.billing_month}_{report.billing_year}.xlsx"
    filename = filename.replace(" ", "_")
    
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
