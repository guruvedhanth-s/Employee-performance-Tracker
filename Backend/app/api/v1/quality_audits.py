"""
Quality Audit API Endpoints
REST API for quality audit management (admin, superadmin, and team leads)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from typing import Optional
from datetime import date
import math

from app.database import get_db
from app.core.dependencies import get_current_user, get_user_teams
from app.services.quality_audit_service import QualityAuditService
from app.models.user import User
from app.models.team import Team
from app.schemas.quality_audit import (
    QualityAuditCreate,
    QualityAuditUpdate,
    QualityAuditResponse,
    QualityAuditListItem,
    QualityAuditListResponse,
    PROCESS_TYPE_OFE
)

router = APIRouter(prefix="/quality-audits", tags=["quality-audits"])


def require_admin_or_team_lead(current_user: User = Depends(get_current_user)):
    """Dependency to ensure user is admin, superadmin, or team_lead"""
    if current_user.user_role not in ["superadmin", "admin", "team_lead"]:
        raise HTTPException(status_code=403, detail="Admin or team lead access required")
    return current_user


def check_team_lead_team_access(current_user: User, team_id: int, db: Session):
    """Check if team lead has access to the specified team"""
    if current_user.user_role == "team_lead":
        team_ids = get_user_teams(current_user, db)
        if team_id not in team_ids:
            raise HTTPException(status_code=403, detail="You can only manage audits for teams you lead")


@router.post("", response_model=QualityAuditResponse)
def create_quality_audit(
    audit_data: QualityAuditCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_lead)
):
    """
    Create a new quality audit record.
    Automatically calculates OFE, total files reviewed, and quality metrics.
    """
    # Verify examiner exists and belongs to the team
    examiner = db.query(User).filter(User.id == audit_data.examiner_id).first()
    if not examiner:
        raise HTTPException(status_code=404, detail="Examiner not found")
    
    # Verify team exists
    team = db.query(Team).filter(Team.id == audit_data.team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # For team leads, verify they lead this team
    check_team_lead_team_access(current_user, audit_data.team_id, db)
    
    # For non-superadmin, verify they belong to the same org
    if current_user.user_role != "superadmin" and examiner.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Cannot create audit for examiner from different organization")
    
    try:
        audit = QualityAuditService.create_quality_audit(
            db=db,
            audit_data=audit_data,
            current_user_id=current_user.id
        )
        
        # Eager load relationships for response
        db.refresh(audit)
        response_data = QualityAuditResponse.model_validate(audit)
        response_data.examiner_name = examiner.user_name
        response_data.team_name = team.name
        
        return response_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("", response_model=QualityAuditListResponse)
def list_quality_audits(
    org_id: Optional[int] = Query(None, description="Filter by organization ID"),
    team_id: Optional[int] = Query(None, description="Filter by team ID"),
    examiner_id: Optional[int] = Query(None, description="Filter by examiner ID"),
    start_date: Optional[date] = Query(None, description="Filter by audit date >= start_date"),
    end_date: Optional[date] = Query(None, description="Filter by audit date <= end_date"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Page size"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List quality audits with optional filters.
    - Superadmins can view all audits
    - Admins can view audits from their organization
    - Team Leads can view audits from teams they lead
    - Employees can only view their own audits
    """
    team_ids = None
    
    # For employees, restrict to their own audits only
    if current_user.user_role == "employee":
        examiner_id = current_user.id
        org_id = current_user.org_id
    # For team leads, restrict to teams they lead
    elif current_user.user_role == "team_lead":
        team_ids = get_user_teams(current_user, db)
        # If a specific team_id is requested, verify access
        if team_id is not None:
            if team_id not in team_ids:
                raise HTTPException(status_code=403, detail="You can only view audits for teams you lead")
            team_ids = None  # Use the single team_id filter instead
        org_id = current_user.org_id
    # For admin users, restrict to their org
    elif current_user.user_role == "admin":
        org_id = current_user.org_id
    # Superadmins can filter as needed
    
    skip = (page - 1) * page_size
    
    items, total = QualityAuditService.list_quality_audits(
        db=db,
        org_id=org_id,
        team_id=team_id,
        team_ids=team_ids,
        examiner_id=examiner_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=page_size
    )
    
    # Build response with examiner and team names
    list_items = []
    for audit in items:
        examiner = db.query(User).filter(User.id == audit.examiner_id).first()
        team = db.query(Team).filter(Team.id == audit.team_id).first()
        
        list_items.append(QualityAuditListItem(
            id=audit.id,
            examiner_id=audit.examiner_id,
            examiner_name=examiner.user_name if examiner else "Unknown",
            team_name=team.name if team else "Unknown",
            process_type=audit.process_type,
            ofe=audit.ofe,
            total_files_reviewed=audit.total_files_reviewed,
            ofe_count=audit.ofe_count,
            files_with_error=audit.files_with_error,
            total_errors=audit.total_errors,
            files_with_cce_error=audit.files_with_cce_error,
            fb_quality=audit.fb_quality,
            ofe_quality=audit.ofe_quality,
            cce_quality=audit.cce_quality,
            audit_date=audit.audit_date,
            created_at=audit.created_at
        ))
    
    total_pages = math.ceil(total / page_size) if page_size > 0 else 0
    
    return QualityAuditListResponse(
        items=list_items,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages
    )


@router.get("/{audit_id}", response_model=QualityAuditResponse)
def get_quality_audit(
    audit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_lead)
):
    """Get a specific quality audit by ID"""
    audit = QualityAuditService.get_quality_audit(db, audit_id)
    
    if not audit:
        raise HTTPException(status_code=404, detail="Quality audit not found")
    
    # For admin users, verify same org
    if current_user.user_role == "admin" and audit.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # For team leads, verify they lead this team
    check_team_lead_team_access(current_user, audit.team_id, db)
    
    examiner = db.query(User).filter(User.id == audit.examiner_id).first()
    team = db.query(Team).filter(Team.id == audit.team_id).first()
    
    response_data = QualityAuditResponse.model_validate(audit)
    response_data.examiner_name = examiner.user_name if examiner else "Unknown"
    response_data.team_name = team.name if team else "Unknown"
    
    return response_data


@router.put("/{audit_id}", response_model=QualityAuditResponse)
def update_quality_audit(
    audit_id: int,
    audit_data: QualityAuditUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_lead)
):
    """
    Update a quality audit record.
    Automatically recalculates quality metrics based on updated values.
    """
    # Get existing audit
    existing_audit = QualityAuditService.get_quality_audit(db, audit_id)
    if not existing_audit:
        raise HTTPException(status_code=404, detail="Quality audit not found")
    
    # For admin users, verify same org
    if current_user.user_role == "admin" and existing_audit.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # For team leads, verify they lead this team
    check_team_lead_team_access(current_user, existing_audit.team_id, db)
    
    try:
        audit = QualityAuditService.update_quality_audit(
            db=db,
            audit_id=audit_id,
            audit_data=audit_data,
            current_user_id=current_user.id
        )
        
        examiner = db.query(User).filter(User.id == audit.examiner_id).first()
        team = db.query(Team).filter(Team.id == audit.team_id).first()
        
        response_data = QualityAuditResponse.model_validate(audit)
        response_data.examiner_name = examiner.user_name if examiner else "Unknown"
        response_data.team_name = team.name if team else "Unknown"
        
        return response_data
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{audit_id}", status_code=204)
def delete_quality_audit(
    audit_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_lead)
):
    """Soft delete a quality audit record"""
    # Get existing audit
    existing_audit = QualityAuditService.get_quality_audit(db, audit_id)
    if not existing_audit:
        raise HTTPException(status_code=404, detail="Quality audit not found")
    
    # For admin users, verify same org
    if current_user.user_role == "admin" and existing_audit.org_id != current_user.org_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # For team leads, verify they lead this team
    check_team_lead_team_access(current_user, existing_audit.team_id, db)
    
    success = QualityAuditService.delete_quality_audit(
        db=db,
        audit_id=audit_id,
        current_user_id=current_user.id
    )
    
    if not success:
        raise HTTPException(status_code=404, detail="Quality audit not found")
    
    return None


@router.get("/process-types/list")
def get_process_types(current_user: User = Depends(require_admin_or_team_lead)):
    """Get list of available process types with their OFE values"""
    return {
        "process_types": [
            {"name": process_type, "ofe": ofe_value}
            for process_type, ofe_value in PROCESS_TYPE_OFE.items()
        ]
    }
