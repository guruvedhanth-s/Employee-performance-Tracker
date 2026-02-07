"""
Teams API Routes
CRUD operations for team management including states, products, and members
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.core.dependencies import (
    get_current_active_user, require_admin, require_team_lead, require_team_lead_or_admin,
    check_org_access, check_team_access, get_user_teams,
    ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD, ROLE_EMPLOYEE
)
from app.models.user import User
from app.models.team import Team, TeamState, TeamProduct
from app.models.user_team import UserTeam
from app.models.team_fa_name import TeamFAName
from app.schemas.team import TeamCreate, TeamUpdate
from app.services.cache_service import cache
from app.services.audit_service import AuditService
from app.models.audit_log import AuditEntityType, AuditAction

router = APIRouter()


def serialize_team_state(state: TeamState) -> dict:
    """Serialize team state to camelCase dict"""
    return {
        "id": state.id,
        "teamId": state.team_id,
        "state": state.state,
        "createdAt": state.created_at.isoformat() if state.created_at else None,
        "modifiedAt": state.modified_at.isoformat() if state.modified_at else None
    }


def serialize_team_product(product: TeamProduct) -> dict:
    """Serialize team product to camelCase dict"""
    return {
        "id": product.id,
        "teamId": product.team_id,
        "productType": product.product_type,
        "createdAt": product.created_at.isoformat() if product.created_at else None,
        "modifiedAt": product.modified_at.isoformat() if product.modified_at else None
    }


def serialize_team_fa_name(team_fa_name) -> dict:
    """Serialize team FA name to camelCase dict with fa_name relationship"""
    return {
        "id": team_fa_name.id,
        "teamId": team_fa_name.team_id,
        "faName": team_fa_name.fa_name.name if hasattr(team_fa_name, 'fa_name') and team_fa_name.fa_name else None,
        "isActive": team_fa_name.is_active,
        "createdAt": team_fa_name.created_at.isoformat() if team_fa_name.created_at else None,
        "modifiedAt": team_fa_name.modified_at.isoformat() if team_fa_name.modified_at else None
    }


def serialize_team(team: Team) -> dict:
    """Serialize team to camelCase dict with states, products, and FA names"""
    return {
        "id": team.id,
        "name": team.name,
        "orgId": team.org_id,
        "teamLeadId": team.team_lead_id,
        "isActive": team.is_active,
        "dailyTarget": team.daily_target,
        "monthlyTarget": team.monthly_target,
        "singleSeatScore": float(team.single_seat_score) if team.single_seat_score else 1.0,
        "step1Score": float(team.step1_score) if team.step1_score else 0.5,
        "step2Score": float(team.step2_score) if team.step2_score else 0.5,
        "createdAt": team.created_at.isoformat() if team.created_at else None,
        "modifiedAt": team.modified_at.isoformat() if team.modified_at else None,
        "states": [serialize_team_state(s) for s in team.states] if team.states else [],
        "products": [serialize_team_product(p) for p in team.products] if team.products else [],
        "faNames": [serialize_team_fa_name(f) for f in team.fa_names] if hasattr(team, 'fa_names') and team.fa_names else []
    }


def serialize_team_member(user: User, user_team: UserTeam) -> dict:
    """Serialize team member to camelCase dict"""
    return {
        "id": user_team.id,
        "userId": user.id,
        "userName": user.user_name,
        "employeeId": user.employee_id,
        "userRole": user.user_role,
        "teamRole": user_team.role,
        "joinedAt": user_team.joined_at.isoformat() if user_team.joined_at else None,
        "leftAt": user_team.left_at.isoformat() if user_team.left_at else None,
        "isActive": user_team.is_active
    }


# ============ Team CRUD ============
@router.get("/my-teams")
async def get_my_teams(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get teams assigned to the current user (for team leads, returns all teams they lead)"""
    
    # Get team IDs using the helper function
    team_ids = get_user_teams(current_user, db)
    
    if not team_ids:
        return {
            "items": [],
            "total": 0
        }
    
    # Fetch full team details
    teams = db.query(Team).options(
        joinedload(Team.states),
        joinedload(Team.products),
        joinedload(Team.fa_names).joinedload(TeamFAName.fa_name)
    ).filter(Team.id.in_(team_ids)).order_by(Team.name).all()
    
    return {
        "items": [serialize_team(team) for team in teams],
        "total": len(teams)
    }


@router.get("")
async def list_teams(
    org_id: Optional[int] = Query(None, alias="orgId", description="Filter by organization"),
    is_active: Optional[bool] = Query(None, alias="isActive", description="Filter by active status"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List teams with organization-based filtering"""
    
    # Build cache key based on user role and filters
    cache_org_id = org_id if current_user.user_role == ROLE_SUPERADMIN else current_user.org_id
    cache_key = cache._build_key(
        cache.PREFIX_TEAMS,
        "list",
        f"org:{cache_org_id}",
        f"active:{is_active}" if is_active is not None else None
    )
    
    # Try to get from cache
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result
    
    query = db.query(Team).options(
        joinedload(Team.states),
        joinedload(Team.products),
        joinedload(Team.fa_names).joinedload(TeamFAName.fa_name)
    )
    
    # Apply role-based filtering
    if current_user.user_role == ROLE_SUPERADMIN:
        if org_id:
            query = query.filter(Team.org_id == org_id)
    elif current_user.user_role in [ROLE_ADMIN, ROLE_TEAM_LEAD, ROLE_EMPLOYEE]:
        # Others can only see their organization's teams
        query = query.filter(Team.org_id == current_user.org_id)
    
    if is_active is not None:
        query = query.filter(Team.is_active == is_active)
    
    teams = query.order_by(Team.name).all()
    
    result = {
        "items": [serialize_team(team) for team in teams],
        "total": len(teams)
    }
    
    # Cache the result
    cache.set(cache_key, result, cache.TTL_USER_LIST)
    
    return result


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_team(
    team_data: TeamCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create new team (Admin or Superadmin)"""
    # Import Organization model
    from app.models.organization import Organization
    
    # Admin can only create teams in their organization
    if current_user.user_role == ROLE_ADMIN:
        if team_data.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create team in different organization"
            )
    
    # Check if organization exists and is active
    organization = db.query(Organization).filter(Organization.id == team_data.org_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    if not organization.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create team for inactive organization"
        )
    
    # Create team
    team = Team(
        name=team_data.name,
        org_id=team_data.org_id,
        team_lead_id=team_data.team_lead_id,
        is_active=team_data.is_active,
        daily_target=team_data.daily_target,
        monthly_target=team_data.monthly_target,
        single_seat_score=team_data.single_seat_score,
        step1_score=team_data.step1_score,
        step2_score=team_data.step2_score
    )
    db.add(team)
    db.flush()  # Get the team ID
    
    # Add team lead to user_teams if specified
    if team_data.team_lead_id:
        # Verify the team lead exists and belongs to the same org
        lead_user = db.query(User).filter(User.id == team_data.team_lead_id).first()
        if lead_user:
            user_team = UserTeam(
                user_id=team_data.team_lead_id,
                team_id=team.id,
                role="lead",
                joined_at=datetime.utcnow(),
                is_active=True
            )
            db.add(user_team)
    
    # Add states
    for state_name in team_data.states:
        team_state = TeamState(team_id=team.id, state=state_name)
        db.add(team_state)
    
    # Add products
    for product in team_data.products:
        team_product = TeamProduct(team_id=team.id, product_type=product)
        db.add(team_product)
    
    # Add FA names by ID
    from app.models.team_fa_name import TeamFAName
    from app.models.fa_name import FAName
    for fa_name_id in team_data.fa_names:
        # Verify FA name exists
        fa_name = db.query(FAName).filter(FAName.id == fa_name_id, FAName.is_active == True).first()
        if not fa_name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"FA name with ID {fa_name_id} not found or inactive"
            )
        team_fa = TeamFAName(team_id=team.id, fa_name_id=fa_name_id, is_active=True)
        db.add(team_fa)
    
    db.commit()
    db.refresh(team)
    
    # Log the creation in audit log
    audit_service = AuditService(db)
    audit_service.log_create(
        entity=team,
        entity_type=AuditEntityType.TEAM,
        current_user=current_user,
        endpoint="/api/v1/teams",
        request_method="POST",
        description=f"Created new team: {team.name} with {len(team_data.states)} states, {len(team_data.products)} products, and {len(team_data.fa_names)} FA names"
    )
    
    # Invalidate teams cache for the organization
    cache.invalidate_team_cache(team.org_id)
    
    return serialize_team(team)


@router.get("/{team_id}")
async def get_team(
    team_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get team by ID with members, states, products, and FA names"""
    team = db.query(Team).options(
        joinedload(Team.states),
        joinedload(Team.products),
        joinedload(Team.fa_names).joinedload(TeamFAName.fa_name)
    ).filter(Team.id == team_id).first()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check access
    has_access = False
    
    # Superadmin has access to everything
    if current_user.user_role == ROLE_SUPERADMIN:
        has_access = True
    # Same organization users have access (check for None)
    elif current_user.org_id is not None and team.org_id == current_user.org_id:
        has_access = True
    # Team lead of this team has access (via Team.team_lead_id)
    elif team.team_lead_id == current_user.id:
        has_access = True
    # Check if user is a member of the team (any role)
    elif db.query(UserTeam).filter(
        UserTeam.team_id == team_id,
        UserTeam.user_id == current_user.id,
        UserTeam.is_active == True
    ).first() is not None:
        has_access = True
    
    if not has_access:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get members (including inactive for historical records)
    members_query = db.query(User, UserTeam).join(
        UserTeam, User.id == UserTeam.user_id
    ).filter(
        UserTeam.team_id == team_id
    ).order_by(UserTeam.is_active.desc(), UserTeam.joined_at).all()
    
    members = [serialize_team_member(m.User, m.UserTeam) for m in members_query]
    
    team_data = serialize_team(team)
    team_data["members"] = members
    
    return team_data


@router.put("/{team_id}")
async def update_team(
    team_id: int,
    team_data: TeamUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update team details (Admin or Superadmin)"""
    team = db.query(Team).options(
        joinedload(Team.states),
        joinedload(Team.products),
        joinedload(Team.fa_names).joinedload(TeamFAName.fa_name)
    ).filter(Team.id == team_id).first()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    if current_user.user_role == ROLE_ADMIN:
        if team.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot update teams from other organizations"
            )
    
    # Capture old snapshot for audit logging
    audit_service = AuditService(db)
    old_snapshot = audit_service._get_entity_snapshot(team)
    
    # Handle team lead change
    old_team_lead_id = team.team_lead_id
    new_team_lead_id = team_data.team_lead_id if hasattr(team_data, 'team_lead_id') else None
    
    # Update basic fields (use by_alias=False to get snake_case keys)
    update_data = team_data.model_dump(exclude_unset=True, exclude={'states', 'products', 'fa_names'}, by_alias=False)
    for field, value in update_data.items():
        setattr(team, field, value)
    
    # If team lead changed, update user_teams
    if new_team_lead_id is not None and new_team_lead_id != old_team_lead_id:
        # Demote old team lead to member (if exists in user_teams)
        if old_team_lead_id:
            old_lead_membership = db.query(UserTeam).filter(
                UserTeam.team_id == team_id,
                UserTeam.user_id == old_team_lead_id,
                UserTeam.is_active == True
            ).first()
            if old_lead_membership:
                old_lead_membership.role = "member"
                old_lead_membership.modified_at = datetime.utcnow()
        
        # Add or promote new team lead
        if new_team_lead_id:
            new_lead_membership = db.query(UserTeam).filter(
                UserTeam.team_id == team_id,
                UserTeam.user_id == new_team_lead_id
            ).first()
            
            if new_lead_membership:
                # User already in team, promote to lead
                new_lead_membership.role = "lead"
                new_lead_membership.is_active = True
                new_lead_membership.left_at = None
                new_lead_membership.modified_at = datetime.utcnow()
            else:
                # Add new user as lead
                lead_user = db.query(User).filter(User.id == new_team_lead_id).first()
                if lead_user:
                    user_team = UserTeam(
                        user_id=new_team_lead_id,
                        team_id=team_id,
                        role="lead",
                        joined_at=datetime.utcnow(),
                        is_active=True
                    )
                    db.add(user_team)
    
    # Update states if provided
    if team_data.states is not None:
        # Remove existing states
        db.query(TeamState).filter(TeamState.team_id == team_id).delete()
        # Add new states
        for state_name in team_data.states:
            team_state = TeamState(team_id=team_id, state=state_name)
            db.add(team_state)
    
    # Update products if provided
    if team_data.products is not None:
        # Remove existing products
        db.query(TeamProduct).filter(TeamProduct.team_id == team_id).delete()
        # Add new products
        for product in team_data.products:
            team_product = TeamProduct(team_id=team_id, product_type=product)
            db.add(team_product)
    
    # Update FA names if provided
    if team_data.fa_names is not None:
        from app.models.team_fa_name import TeamFAName
        from app.models.fa_name import FAName
        # Remove existing FA names
        db.query(TeamFAName).filter(TeamFAName.team_id == team_id).delete()
        # Add new FA names by ID
        for fa_name_id in team_data.fa_names:
            # Verify FA name exists
            fa_name = db.query(FAName).filter(FAName.id == fa_name_id, FAName.is_active == True).first()
            if not fa_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"FA name with ID {fa_name_id} not found or inactive"
                )
            team_fa = TeamFAName(team_id=team_id, fa_name_id=fa_name_id, is_active=True)
            db.add(team_fa)
    
    team.modified_at = datetime.utcnow()
    db.commit()
    db.refresh(team)
    
    # Log the update in audit log
    audit_service.log_update(
        entity=team,
        entity_type=AuditEntityType.TEAM,
        old_snapshot=old_snapshot,
        current_user=current_user,
        endpoint=f"/api/v1/teams/{team_id}",
        request_method="PUT",
        description=f"Updated team: {team.name}"
    )
    
    # Invalidate teams cache for the organization
    cache.invalidate_team_cache(team.org_id)
    
    return serialize_team(team)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Deactivate team (Admin or Superadmin)"""
    team = db.query(Team).filter(Team.id == team_id).first()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    if current_user.user_role == ROLE_ADMIN:
        if team.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete teams from other organizations"
            )
    
    # Soft delete
    team.is_active = False
    team.modified_at = datetime.utcnow()
    db.commit()
    
    # Log the deletion in audit log
    audit_service = AuditService(db)
    audit_service.log_delete(
        entity=team,
        entity_type=AuditEntityType.TEAM,
        current_user=current_user,
        endpoint=f"/api/v1/teams/{team_id}",
        request_method="DELETE",
        description=f"Deleted (deactivated) team: {team.name}",
        is_soft_delete=True
    )
    
    # Invalidate teams cache for the organization
    cache.invalidate_team_cache(team.org_id)


@router.post("/{team_id}/activate")
async def activate_team(
    team_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Reactivate team (Admin or Superadmin)"""
    team = db.query(Team).filter(Team.id == team_id).first()
    
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    if current_user.user_role == ROLE_ADMIN:
        if team.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot activate teams from other organizations"
            )
    
    team.is_active = True
    team.modified_at = datetime.utcnow()
    db.commit()
    
    # Invalidate teams cache for the organization
    cache.invalidate_team_cache(team.org_id)
    
    return {"message": "Team activated successfully"}


# ============ Team States ============
@router.get("/{team_id}/states")
async def get_team_states(
    team_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get states assigned to a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check access
    if current_user.user_role != ROLE_SUPERADMIN and team.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    states = db.query(TeamState).filter(TeamState.team_id == team_id).all()
    return [serialize_team_state(s) for s in states]


@router.post("/{team_id}/states")
async def add_team_state(
    team_id: int,
    state: str = Query(..., max_length=50),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add a state to a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    if current_user.user_role == ROLE_ADMIN and team.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Check if state already exists
    existing = db.query(TeamState).filter(
        TeamState.team_id == team_id,
        TeamState.state == state
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="State already assigned to this team"
        )
    
    team_state = TeamState(team_id=team_id, state=state)
    db.add(team_state)
    db.commit()
    db.refresh(team_state)
    
    return serialize_team_state(team_state)


@router.delete("/{team_id}/states/{state_id}")
async def remove_team_state(
    team_id: int,
    state_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove a state from a team"""
    team_state = db.query(TeamState).filter(
        TeamState.id == state_id,
        TeamState.team_id == team_id
    ).first()
    
    if not team_state:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team state not found"
        )
    
    # Check organization access
    team = db.query(Team).filter(Team.id == team_id).first()
    if current_user.user_role == ROLE_ADMIN and team.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    db.delete(team_state)
    db.commit()
    
    return {"message": "State removed from team"}


# ============ Team Products ============
@router.get("/{team_id}/products")
async def get_team_products(
    team_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get products assigned to a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check access
    if current_user.user_role != ROLE_SUPERADMIN and team.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    products = db.query(TeamProduct).filter(TeamProduct.team_id == team_id).all()
    return [serialize_team_product(p) for p in products]


@router.post("/{team_id}/products")
async def add_team_product(
    team_id: int,
    product_type: str = Query(..., alias="productType", max_length=100),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add a product to a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    if current_user.user_role == ROLE_ADMIN and team.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Check if product already exists
    existing = db.query(TeamProduct).filter(
        TeamProduct.team_id == team_id,
        TeamProduct.product_type == product_type
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product already assigned to this team"
        )
    
    team_product = TeamProduct(team_id=team_id, product_type=product_type)
    db.add(team_product)
    db.commit()
    db.refresh(team_product)
    
    return serialize_team_product(team_product)


@router.delete("/{team_id}/products/{product_id}")
async def remove_team_product(
    team_id: int,
    product_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove a product from a team"""
    team_product = db.query(TeamProduct).filter(
        TeamProduct.id == product_id,
        TeamProduct.team_id == team_id
    ).first()
    
    if not team_product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team product not found"
        )
    
    # Check organization access
    team = db.query(Team).filter(Team.id == team_id).first()
    if current_user.user_role == ROLE_ADMIN and team.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    db.delete(team_product)
    db.commit()
    
    return {"message": "Product removed from team"}


# ============ Team Members ============
@router.get("/{team_id}/members")
async def get_team_members(
    team_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get members of a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check access
    if current_user.user_role != ROLE_SUPERADMIN and team.org_id != current_user.org_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    # Get all members (including inactive for historical records)
    members_query = db.query(User, UserTeam).join(
        UserTeam, User.id == UserTeam.user_id
    ).filter(
        UserTeam.team_id == team_id
    ).order_by(UserTeam.is_active.desc(), UserTeam.joined_at).all()
    
    return [serialize_team_member(m.User, m.UserTeam) for m in members_query]


@router.post("/{team_id}/members")
async def add_team_member(
    team_id: int,
    user_id: int = Query(..., alias="userId"),
    role: str = Query("member"),
    current_user: User = Depends(require_team_lead_or_admin),
    db: Session = Depends(get_db)
):
    """Add a member to a team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check access based on role
    if current_user.user_role == ROLE_TEAM_LEAD:
        # Team lead can only manage members in teams they lead
        if team.team_lead_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only manage members in teams you lead"
            )
        # Team lead can only add users from the same organization
        if user.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only add users from your organization"
            )
    elif current_user.user_role == ROLE_ADMIN:
        if team.org_id != current_user.org_id or user.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Check if membership already exists
    existing = db.query(UserTeam).filter(
        UserTeam.user_id == user_id,
        UserTeam.team_id == team_id
    ).first()
    
    if existing:
        if existing.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this team"
            )
        # Reactivate membership
        existing.is_active = True
        existing.role = role
        existing.left_at = None
        existing.modified_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return serialize_team_member(user, existing)
    
    # Create new membership
    user_team = UserTeam(
        user_id=user_id,
        team_id=team_id,
        role=role,
        joined_at=datetime.utcnow(),
        is_active=True
    )
    
    db.add(user_team)
    db.commit()
    db.refresh(user_team)
    
    return serialize_team_member(user, user_team)


@router.delete("/{team_id}/members/{user_id}")
async def remove_team_member(
    team_id: int,
    user_id: int,
    current_user: User = Depends(require_team_lead_or_admin),
    db: Session = Depends(get_db)
):
    """Remove a member from a team"""
    user_team = db.query(UserTeam).filter(
        UserTeam.user_id == user_id,
        UserTeam.team_id == team_id,
        UserTeam.is_active == True
    ).first()
    
    if not user_team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this team"
        )
    
    # Check access based on role
    team = db.query(Team).filter(Team.id == team_id).first()
    if current_user.user_role == ROLE_TEAM_LEAD:
        # Team lead can only manage members in teams they lead
        if team.team_lead_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only manage members in teams you lead"
            )
    elif current_user.user_role == ROLE_ADMIN:
        if team.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Soft delete membership
    user_team.is_active = False
    user_team.left_at = datetime.utcnow()
    user_team.modified_at = datetime.utcnow()
    db.commit()
    
    return {"message": "User removed from team"}


@router.put("/{team_id}/members/{user_id}")
async def update_team_member_role(
    team_id: int,
    user_id: int,
    role: str = Query(...),
    current_user: User = Depends(require_team_lead_or_admin),
    db: Session = Depends(get_db)
):
    """Update a team member's role"""
    user_team = db.query(UserTeam).filter(
        UserTeam.user_id == user_id,
        UserTeam.team_id == team_id,
        UserTeam.is_active == True
    ).first()
    
    if not user_team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this team"
        )
    
    # Check access based on role
    team = db.query(Team).filter(Team.id == team_id).first()
    if current_user.user_role == ROLE_TEAM_LEAD:
        # Team lead can only manage members in teams they lead
        if team.team_lead_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only manage members in teams you lead"
            )
    elif current_user.user_role == ROLE_ADMIN:
        if team.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    user_team.role = role
    user_team.modified_at = datetime.utcnow()
    db.commit()
    
    user = db.query(User).filter(User.id == user_id).first()
    return serialize_team_member(user, user_team)


@router.get("/{team_id}/fake-names")
async def get_team_fake_names(
    team_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get all active FA names for a team (for order creation dropdown)"""
    # Verify team exists
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check access - users must be part of the team or admins
    if not check_team_access(current_user, team_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this team"
        )
    
    # Get active FA names for the team
    fa_names = db.query(TeamFAName).filter(
        TeamFAName.team_id == team_id,
        TeamFAName.is_active == True
    ).order_by(TeamFAName.fa_name_id).all()
    
    return {
        "items": [
            {
                "id": fn.id,
                "faName": fn.fa_name,
                "teamId": fn.team_id
            }
            for fn in fa_names
        ],
        "total": len(fa_names)
    }

