"""
Organizations API Routes
CRUD operations for organization management (Superadmin only for most operations)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.core.dependencies import (
    get_current_active_user, require_superadmin,
    ROLE_SUPERADMIN
)
from app.models.user import User
from app.models.organization import Organization
from app.schemas.organization import (
    OrganizationCreate, OrganizationUpdate, OrganizationResponse, OrganizationListResponse
)

router = APIRouter()


@router.get("")
async def list_organizations(
    is_active: bool = None,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List organizations:
    - Superadmin: Can see all organizations (optionally filtered by is_active)
    - Others: Can only see their own organization
    """
    if current_user.user_role == ROLE_SUPERADMIN:
        query = db.query(Organization)
        # Filter by is_active if provided
        if is_active is not None:
            query = query.filter(Organization.is_active == is_active)
        organizations = query.order_by(Organization.name).all()
    else:
        organizations = db.query(Organization).filter(
            Organization.id == current_user.org_id
        ).all()
    
    items = []
    for org in organizations:
        items.append({
            "id": org.id,
            "name": org.name,
            "code": org.code,
            "isActive": org.is_active,
            "createdAt": org.created_at.isoformat() if org.created_at else None,
            "modifiedAt": org.modified_at.isoformat() if org.modified_at else None
        })
    
    return {"items": items, "total": len(organizations)}


@router.get("/{organization_id}", response_model=OrganizationResponse)
async def get_organization(
    organization_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get organization by ID"""
    # Non-superadmins can only access their own organization
    if current_user.user_role != ROLE_SUPERADMIN:
        if current_user.org_id != organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden"
            )
    
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    return OrganizationResponse.model_validate(organization)


@router.post("", response_model=OrganizationResponse, status_code=status.HTTP_201_CREATED)
async def create_organization(
    organization_data: OrganizationCreate,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Create new organization (Superadmin only)"""
    # Check if code already exists
    existing = db.query(Organization).filter(
        Organization.code == organization_data.code.upper()
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Organization code already exists"
        )
    
    organization = Organization(
        name=organization_data.name,
        code=organization_data.code.upper(),
        is_active=organization_data.is_active
    )
    
    db.add(organization)
    db.commit()
    db.refresh(organization)
    
    return OrganizationResponse.model_validate(organization)


@router.put("/{organization_id}", response_model=OrganizationResponse)
async def update_organization(
    organization_id: int,
    organization_data: OrganizationUpdate,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Update organization (Superadmin only)"""
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Check for code uniqueness if changing
    update_data = organization_data.model_dump(exclude_unset=True)
    if 'code' in update_data:
        existing = db.query(Organization).filter(
            Organization.code == update_data['code'].upper(),
            Organization.id != organization_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Organization code already exists"
            )
        update_data['code'] = update_data['code'].upper()
    
    # Update fields
    for field, value in update_data.items():
        setattr(organization, field, value)
    
    db.commit()
    db.refresh(organization)
    
    return OrganizationResponse.model_validate(organization)


@router.delete("/{organization_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_organization(
    organization_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Deactivate organization (Superadmin only)"""
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    # Soft delete - deactivate
    organization.is_active = False
    db.commit()


@router.post("/{organization_id}/activate")
async def activate_organization(
    organization_id: int,
    current_user: User = Depends(require_superadmin),
    db: Session = Depends(get_db)
):
    """Reactivate organization (Superadmin only)"""
    organization = db.query(Organization).filter(Organization.id == organization_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    
    organization.is_active = True
    db.commit()
    
    return {"message": "Organization activated successfully"}
