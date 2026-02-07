"""
FA Names API Routes
CRUD operations for centralized FA Names management
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from datetime import datetime
from app.database import get_db
from app.core.dependencies import (
    get_current_active_user, require_admin
)
from app.models.user import User
from app.models.fa_name import FAName
from app.schemas.fa_name import (
    FANameCreate, FANameUpdate, FAName as FANameSchema,
    FANameListResponse
)
from app.services.audit_service import AuditService
from app.models.audit_log import AuditEntityType, AuditAction

router = APIRouter()


def serialize_fa_name(fa_name: FAName) -> dict:
    """Serialize FA name to camelCase dict"""
    return {
        "id": fa_name.id,
        "name": fa_name.name,
        "isActive": fa_name.is_active,
        "createdAt": fa_name.created_at.isoformat() if fa_name.created_at else None,
        "modifiedAt": fa_name.modified_at.isoformat() if fa_name.modified_at else None
    }


# ============ FA Names CRUD ============
@router.get("")
async def list_fa_names(
    skip: int = Query(0, ge=0, description="Number of items to skip"),
    limit: int = Query(100, ge=1, le=500, description="Number of items to return"),
    active_only: bool = Query(True, description="Filter only active FA names"),
    search: str = Query(None, description="Search by FA name"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get list of FA names.
    All authenticated users can view FA names.
    """
    query = db.query(FAName)
    
    # Filter by active status
    if active_only:
        query = query.filter(FAName.is_active == True)
    
    # Search filter
    if search:
        query = query.filter(FAName.name.ilike(f"%{search}%"))
    
    # Get total count
    total = query.count()
    
    # Get items with pagination
    fa_names = query.order_by(FAName.name).offset(skip).limit(limit).all()
    
    return {
        "items": [serialize_fa_name(fn) for fn in fa_names],
        "total": total
    }


@router.get("/{fa_name_id}")
async def get_fa_name(
    fa_name_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Get a specific FA name by ID.
    All authenticated users can view FA names.
    """
    fa_name = db.query(FAName).filter(FAName.id == fa_name_id).first()
    if not fa_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FA name not found"
        )
    
    return serialize_fa_name(fa_name)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_fa_name(
    fa_name_data: FANameCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new FA name.
    Only admins can create FA names.
    """
    # Check if FA name already exists (case-insensitive)
    existing = db.query(FAName).filter(
        func.lower(FAName.name) == fa_name_data.name.lower()
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="FA name already exists"
        )
    
    # Create new FA name
    new_fa_name = FAName(
        name=fa_name_data.name.strip(),
        is_active=True,
        created_at=datetime.utcnow(),
        modified_at=datetime.utcnow()
    )
    
    db.add(new_fa_name)
    db.commit()
    db.refresh(new_fa_name)
    
    # Audit log
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        action=AuditAction.CREATE,
        entity_type=AuditEntityType.FA_NAME,
        entity_id=new_fa_name.id,
        details={"name": new_fa_name.name}
    )
    
    return serialize_fa_name(new_fa_name)


@router.put("/{fa_name_id}")
async def update_fa_name(
    fa_name_id: int,
    fa_name_data: FANameUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update an existing FA name.
    Only admins can update FA names.
    """
    fa_name = db.query(FAName).filter(FAName.id == fa_name_id).first()
    if not fa_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FA name not found"
        )
    
    old_values = {"name": fa_name.name, "is_active": fa_name.is_active}
    
    # Update name if provided
    if fa_name_data.name is not None:
        # Check if new name already exists (case-insensitive, excluding current record)
        existing = db.query(FAName).filter(
            func.lower(FAName.name) == fa_name_data.name.lower(),
            FAName.id != fa_name_id
        ).first()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="FA name already exists"
            )
        
        fa_name.name = fa_name_data.name.strip()
    
    # Update is_active if provided
    if fa_name_data.is_active is not None:
        fa_name.is_active = fa_name_data.is_active
    
    fa_name.modified_at = datetime.utcnow()
    
    db.commit()
    db.refresh(fa_name)
    
    # Audit log
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        action=AuditAction.UPDATE,
        entity_type=AuditEntityType.FA_NAME,
        entity_id=fa_name.id,
        details={
            "old_values": old_values,
            "new_values": {"name": fa_name.name, "is_active": fa_name.is_active}
        }
    )
    
    return serialize_fa_name(fa_name)


@router.delete("/{fa_name_id}")
async def delete_fa_name(
    fa_name_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Soft delete an FA name (set is_active to False).
    Only admins can delete FA names.
    """
    fa_name = db.query(FAName).filter(FAName.id == fa_name_id).first()
    if not fa_name:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="FA name not found"
        )
    
    # Soft delete
    fa_name.is_active = False
    fa_name.modified_at = datetime.utcnow()
    
    db.commit()
    
    # Audit log
    AuditService.log_action(
        db=db,
        user_id=current_user.id,
        action=AuditAction.DELETE,
        entity_type=AuditEntityType.FA_NAME,
        entity_id=fa_name.id,
        details={"name": fa_name.name}
    )
    
    return {"message": "FA name deleted successfully"}
