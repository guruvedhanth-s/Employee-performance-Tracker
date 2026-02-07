"""
Users API Routes
CRUD operations for user management with role-based access control
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional
from datetime import datetime
from app.database import get_db
from app.models.user import User
from app.models.user_team import UserTeam
from app.models.team import Team
from app.schemas.user import UserCreate, UserUpdate
from app.core.dependencies import (
    get_current_active_user,
    require_admin,
    require_team_lead,
    check_org_access,
    get_user_teams,
    ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD, ROLE_EMPLOYEE
)
from app.core.security import get_password_hash, verify_password
from app.services.cache_service import cache
from app.services.audit_service import AuditService
from app.models.audit_log import AuditEntityType, AuditAction

router = APIRouter()


def serialize_user(user: User) -> dict:
    """Serialize user to camelCase dict"""
    return {
        "id": user.id,
        "userName": user.user_name,
        "employeeId": user.employee_id,
        "userRole": user.user_role,
        "orgId": user.org_id,
        "passwordLastChanged": user.password_last_changed.isoformat() if user.password_last_changed else None,
        "mustChangePassword": user.must_change_password if user.must_change_password else False,
        "lastLogin": user.last_login.isoformat() if user.last_login else None,
        "isActive": user.is_active,
        "createdAt": user.created_at.isoformat() if user.created_at else None,
        "modifiedAt": user.modified_at.isoformat() if user.modified_at else None,
        "deactivatedAt": user.deactivated_at.isoformat() if user.deactivated_at else None
    }


def serialize_team_membership(user_team: UserTeam, team: Team) -> dict:
    """Serialize team membership to camelCase dict"""
    return {
        "teamId": user_team.team_id,
        "teamName": team.name,
        "role": user_team.role,
        "joinedAt": user_team.joined_at.isoformat() if user_team.joined_at else None,
        "leftAt": user_team.left_at.isoformat() if user_team.left_at else None,
        "isActive": user_team.is_active,  # User's membership status in this team
        "teamIsActive": team.is_active  # Team's active status (not deactivated)
    }


@router.get("")
async def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    role: Optional[str] = Query(None, description="Filter by role"),
    org_id: Optional[int] = Query(None, alias="orgId", description="Filter by organization"),
    team_id: Optional[int] = Query(None, alias="teamId", description="Filter by team membership"),
    is_active: Optional[bool] = Query(None, alias="isActive", description="Filter by active status"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    List users with role-based filtering:
    - Superadmin: Can see all users
    - Admin: Can see users in their organization
    - Team Lead: Can see users in their teams
    - Employee: Cannot access this endpoint
    """
    if current_user.user_role == ROLE_EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Employees cannot list users"
        )
    
    # Build cache key based on user role and filters
    cache_key = cache._build_key(
        cache.PREFIX_USERS,
        "list",
        f"role:{current_user.user_role}",
        f"org:{current_user.org_id if current_user.user_role != ROLE_SUPERADMIN else org_id}",
        f"team:{team_id}" if team_id else None,
        f"filter_role:{role}" if role else None,
        f"active:{is_active}" if is_active is not None else None,
        f"skip:{skip}",
        f"limit:{limit}"
    )
    
    # Try to get from cache
    cached_result = cache.get(cache_key)
    if cached_result is not None:
        return cached_result
    
    query = db.query(User)
    
    # Apply role-based filtering
    if current_user.user_role == ROLE_SUPERADMIN:
        # Superadmin can see all, optionally filter by org
        if org_id:
            query = query.filter(User.org_id == org_id)
    elif current_user.user_role == ROLE_ADMIN:
        # Admin can only see users in their organization
        query = query.filter(User.org_id == current_user.org_id)
    elif current_user.user_role == ROLE_TEAM_LEAD:
        # Team lead can see users in teams they lead or are members of
        accessible_teams = get_user_teams(current_user, db)
        if not accessible_teams:
            return {"items": [], "total": 0}
        
        # Get users who are members of accessible teams
        team_user_ids = db.query(UserTeam.user_id).filter(
            UserTeam.team_id.in_(accessible_teams),
            UserTeam.is_active == True
        ).distinct().all()
        user_ids = [u.user_id for u in team_user_ids]
        
        if team_id and team_id in accessible_teams:
            # Filter to specific team if accessible
            team_members = db.query(UserTeam.user_id).filter(
                UserTeam.team_id == team_id,
                UserTeam.is_active == True
            ).all()
            user_ids = [u.user_id for u in team_members]
        elif team_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have access to this team"
            )
        
        query = query.filter(User.id.in_(user_ids))
    
    # Apply additional filters
    if role:
        query = query.filter(User.user_role == role)
    if is_active is not None:
        query = query.filter(User.is_active == is_active)
    
    # Team filter for admin/superadmin
    if team_id and current_user.user_role in [ROLE_SUPERADMIN, ROLE_ADMIN]:
        team_members = db.query(UserTeam.user_id).filter(
            UserTeam.team_id == team_id,
            UserTeam.is_active == True
        ).all()
        user_ids = [u.user_id for u in team_members]
        query = query.filter(User.id.in_(user_ids))
    
    # Get total count
    total = query.count()
    
    # Get paginated results
    users = query.order_by(User.user_name).offset(skip).limit(limit).all()
    
    result = {
        "items": [serialize_user(user) for user in users],
        "total": total
    }
    
    # Cache the result
    cache.set(cache_key, result, cache.TTL_USER_LIST)
    
    return result


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Create a new user (Admin or Superadmin only)
    
    Permission rules:
    - Superadmin: Can create users with any role
    - Admin: Can only create team_lead and employee users in their org
    - Admin: Cannot create admin or superadmin users
    """
    # Import Organization model
    from app.models.organization import Organization
    
    # Check organization access
    if current_user.user_role == ROLE_ADMIN:
        if user_data.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create user in different organization"
            )
        
        # Admin cannot create admin or superadmin users
        if user_data.user_role in [ROLE_ADMIN, ROLE_SUPERADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot create admin or superadmin users. Contact a superadmin."
            )
    
    # Check if organization is active (for non-superadmin users)
    if user_data.org_id:
        organization = db.query(Organization).filter(Organization.id == user_data.org_id).first()
        if not organization:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Organization not found"
            )
        if not organization.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create user for inactive organization"
            )
    
    # Check if user_name already exists
    existing_user = db.query(User).filter(User.user_name == user_data.user_name).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Auto-generate employee_id if not provided
    employee_id = user_data.employee_id
    if not employee_id:
        # Generate employee ID based on org and sequence
        # Format: ORG_CODE + YYYYMM + 4-digit sequence (e.g., IND202412-0001)
        from datetime import datetime as dt
        year_month = dt.now().strftime("%Y%m")
        
        # Get org code prefix
        org_prefix = "EMP"
        if user_data.org_id:
            from app.models.organization import Organization
            org = db.query(Organization).filter(Organization.id == user_data.org_id).first()
            if org:
                org_prefix = org.code
        
        # Find the highest employee_id for this prefix and year_month
        prefix_pattern = f"{org_prefix}{year_month}-%"
        last_emp = db.query(User).filter(User.employee_id.like(prefix_pattern)).order_by(User.employee_id.desc()).first()
        
        if last_emp and last_emp.employee_id:
            # Extract sequence number and increment
            try:
                last_seq = int(last_emp.employee_id.split('-')[-1])
                next_seq = last_seq + 1
            except (ValueError, IndexError):
                next_seq = 1
        else:
            next_seq = 1
        
        employee_id = f"{org_prefix}{year_month}-{next_seq:04d}"
    else:
        # Check if provided employee_id already exists
        existing_emp = db.query(User).filter(User.employee_id == employee_id).first()
        if existing_emp:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Employee ID already exists"
            )
    
    # Create new user
    new_user = User(
        user_name=user_data.user_name,
        employee_id=employee_id,
        password_hash=get_password_hash(user_data.password),
        user_role=user_data.user_role,
        org_id=user_data.org_id,
        password_last_changed=datetime.utcnow()
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Log the creation in audit log
    audit_service = AuditService(db)
    audit_service.log_create(
        entity=new_user,
        entity_type=AuditEntityType.USER,
        current_user=current_user,
        endpoint="/api/v1/users",
        request_method="POST",
        description=f"Created new user: {new_user.user_name} with role {new_user.user_role}"
    )
    
    # Invalidate users cache for the organization
    cache.invalidate_user_cache(new_user.org_id)
    
    return serialize_user(new_user)


@router.get("/me")
async def get_my_profile(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get current user's profile with team memberships"""
    # Get team memberships
    memberships = db.query(UserTeam, Team).join(
        Team, UserTeam.team_id == Team.id
    ).filter(
        UserTeam.user_id == current_user.id,
        UserTeam.is_active == True
    ).all()
    
    teams = [serialize_team_membership(m.UserTeam, m.Team) for m in memberships]
    
    user_data = serialize_user(current_user)
    user_data["teams"] = teams
    
    return user_data


@router.get("/{user_id}")
async def get_user(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get user by ID with team memberships"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check access
    if current_user.user_role == ROLE_EMPLOYEE:
        if user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own profile"
            )
    elif current_user.user_role == ROLE_ADMIN:
        if user.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot view users from other organizations"
            )
    elif current_user.user_role == ROLE_TEAM_LEAD:
        # Check if user is in any of team lead's teams
        accessible_teams = get_user_teams(current_user, db)
        user_team_ids = db.query(UserTeam.team_id).filter(
            UserTeam.user_id == user_id,
            UserTeam.is_active == True
        ).all()
        user_teams = {t.team_id for t in user_team_ids}
        
        if not user_teams.intersection(set(accessible_teams)) and user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not in your teams"
            )
    
    # Get team memberships (both active and inactive for historical records)
    memberships = db.query(UserTeam, Team).join(
        Team, UserTeam.team_id == Team.id
    ).filter(
        UserTeam.user_id == user_id
    ).order_by(UserTeam.is_active.desc(), UserTeam.joined_at.desc()).all()
    
    teams = [serialize_team_membership(m.UserTeam, m.Team) for m in memberships]
    
    user_data = serialize_user(user)
    user_data["teams"] = teams
    
    return user_data


@router.put("/{user_id}")
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Update user details (Admin or Superadmin only)
    
    Permission rules:
    - Superadmin: Can update any user, can deactivate anyone including self
    - Admin: Can only update team_lead and employee in their org
    - Admin: Cannot update other admins or superadmins
    - Admin: Cannot deactivate themselves
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check organization access for admin
    if current_user.user_role == ROLE_ADMIN:
        if user.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot update users from other organizations"
            )
        
        # Admin cannot edit other admins or superadmins
        if user.user_role in [ROLE_ADMIN, ROLE_SUPERADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot modify other admins or superadmins. Contact a superadmin."
            )
        
        # Admin cannot deactivate themselves
        if user_id == current_user.id:
            update_data_check = user_data.model_dump(exclude_unset=True)
            if 'is_active' in update_data_check and update_data_check['is_active'] == False:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You cannot deactivate your own account"
                )
    
    # Update fields
    update_data = user_data.model_dump(exclude_unset=True)
    
    # Check for username uniqueness if changing
    if 'user_name' in update_data:
        existing = db.query(User).filter(
            User.user_name == update_data['user_name'],
            User.id != user_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
    
    # Capture old snapshot for audit logging
    audit_service = AuditService(db)
    old_snapshot = audit_service._get_entity_snapshot(user)
    
    # Check if user is being deactivated (is_active changing from True to False)
    is_being_deactivated = (
        'is_active' in update_data and 
        update_data['is_active'] == False and 
        user.is_active == True
    )
    
    # Check if user is being reactivated (is_active changing from False to True)
    is_being_reactivated = (
        'is_active' in update_data and 
        update_data['is_active'] == True and 
        user.is_active == False
    )
    
    for field, value in update_data.items():
        setattr(user, field, value)
    
    # Set deactivated_at timestamp when deactivating
    if is_being_deactivated:
        user.deactivated_at = datetime.utcnow()
    
    # Clear deactivated_at when reactivating
    if is_being_reactivated:
        user.deactivated_at = None
    
    # If user is being deactivated, also deactivate all team memberships
    if is_being_deactivated:
        active_memberships = db.query(UserTeam).filter(
            UserTeam.user_id == user_id,
            UserTeam.is_active == True
        ).all()
        
        for membership in active_memberships:
            membership.is_active = False
            membership.left_at = datetime.utcnow()
            membership.modified_at = datetime.utcnow()
    
    user.modified_at = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    # Log the update in audit log
    description = f"Updated user: {user.user_name}"
    if is_being_deactivated:
        description = f"Deactivated user: {user.user_name}"
    elif is_being_reactivated:
        description = f"Reactivated user: {user.user_name}"
    
    audit_service.log_update(
        entity=user,
        entity_type=AuditEntityType.USER,
        old_snapshot=old_snapshot,
        current_user=current_user,
        endpoint=f"/api/v1/users/{user_id}",
        request_method="PUT",
        description=description
    )
    
    # Invalidate users cache - both org-specific and global (for superadmin views)
    cache.invalidate_user_cache(user.org_id)
    cache.invalidate_user_cache()  # Also invalidate global cache for superadmin
    
    # If user was deactivated, also invalidate team cache (since team memberships changed)
    if is_being_deactivated:
        cache.invalidate_team_cache(user.org_id)
        cache.invalidate_team_cache()  # Also invalidate global team cache
    
    return serialize_user(user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Deactivate user (Admin or Superadmin only)
    
    Permission rules:
    - Superadmin: Can deactivate any user including self
    - Admin: Can only deactivate team_lead and employee in their org
    - Admin: Cannot deactivate other admins or superadmins
    - Admin: Cannot deactivate themselves
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check organization access for admin
    if current_user.user_role == ROLE_ADMIN:
        if user.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete users from other organizations"
            )
        
        # Admin cannot deactivate other admins or superadmins
        if user.user_role in [ROLE_ADMIN, ROLE_SUPERADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot deactivate other admins or superadmins. Contact a superadmin."
            )
        
        # Admin cannot deactivate themselves
        if user_id == current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You cannot deactivate your own account"
            )
    
    # Soft delete - deactivate user
    user.is_active = False
    user.deactivated_at = datetime.utcnow()  # Track when user was deactivated
    user.modified_at = datetime.utcnow()
    
    # Deactivate all team memberships for this user
    active_memberships = db.query(UserTeam).filter(
        UserTeam.user_id == user_id,
        UserTeam.is_active == True
    ).all()
    
    for membership in active_memberships:
        membership.is_active = False
        membership.left_at = datetime.utcnow()
        membership.modified_at = datetime.utcnow()
    
    db.commit()
    
    # Log the deletion in audit log
    audit_service = AuditService(db)
    audit_service.log_delete(
        entity=user,
        entity_type=AuditEntityType.USER,
        current_user=current_user,
        endpoint=f"/api/v1/users/{user_id}",
        request_method="DELETE",
        description=f"Deleted (deactivated) user: {user.user_name}",
        is_soft_delete=True
    )
    
    # Invalidate users cache - both org-specific and global (for superadmin views)
    cache.invalidate_user_cache(user.org_id)
    cache.invalidate_user_cache()  # Also invalidate global cache for superadmin
    
    # Also invalidate team cache since team memberships changed
    cache.invalidate_team_cache(user.org_id)
    cache.invalidate_team_cache()  # Also invalidate global team cache


@router.post("/{user_id}/reset-password")
async def reset_user_password(
    user_id: int,
    new_password: str = Query(..., min_length=8, alias="newPassword"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Reset user's password (Admin or Superadmin only)
    Sets a temporary password that the user must change on next login.
    
    Permission rules:
    - Superadmin: Can reset password for admins, team_leads, and employees (NOT other superadmins)
    - Admin: Can only reset password for team_lead and employee in their org
    - Admin: Cannot reset password for other admins or superadmins
    - No one can reset superadmin password through this endpoint
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Cannot reset superadmin password through this endpoint
    if user.user_role == ROLE_SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin password cannot be reset through this system. Please contact database administrator."
        )
    
    # Check organization access for admin
    if current_user.user_role == ROLE_ADMIN:
        if user.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot reset password for users from other organizations"
            )
        
        # Admin cannot reset password for other admins
        if user.user_role == ROLE_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot reset password for other admins. Contact a superadmin."
            )
    
    user.password_hash = get_password_hash(new_password)
    user.password_last_changed = datetime.utcnow()
    user.must_change_password = True  # User must change password on next login
    user.modified_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Temporary password set successfully. User must change password on next login."}


@router.post("/me/change-password")
async def change_own_password(
    current_password: str = Query(..., min_length=1, alias="currentPassword"),
    new_password: str = Query(..., min_length=8, alias="newPassword"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Change own password (any authenticated user)
    
    This endpoint allows users to change their own password.
    - Requires current password verification
    - Sets must_change_password to False after successful change
    """
    # Verify current password
    if not verify_password(current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Check if new password is same as current
    if verify_password(new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    current_user.password_hash = get_password_hash(new_password)
    current_user.password_last_changed = datetime.utcnow()
    current_user.must_change_password = False  # Clear the flag after password change
    current_user.modified_at = datetime.utcnow()
    db.commit()
    
    return {"message": "Password changed successfully"}


@router.post("/{user_id}/activate")
async def activate_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """
    Reactivate user (Admin or Superadmin only)
    
    Permission rules:
    - Superadmin: Can activate any user
    - Admin: Can only activate team_lead and employee in their org
    - Admin: Cannot activate other admins or superadmins
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check organization access for admin
    if current_user.user_role == ROLE_ADMIN:
        if user.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot activate users from other organizations"
            )
        
        # Admin cannot activate other admins or superadmins
        if user.user_role in [ROLE_ADMIN, ROLE_SUPERADMIN]:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admins cannot activate other admins or superadmins. Contact a superadmin."
            )
    
    user.is_active = True
    user.deactivated_at = None  # Clear deactivated_at when reactivating
    user.modified_at = datetime.utcnow()
    db.commit()
    
    # Invalidate users cache for the organization
    cache.invalidate_user_cache(user.org_id)
    
    return {"message": "User activated successfully"}


# ============ User-Team Membership Endpoints ============

@router.post("/{user_id}/teams")
async def add_user_to_team(
    user_id: int,
    team_id: int = Query(..., alias="teamId"),
    role: str = Query("member"),
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Add user to a team (Admin or Superadmin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    
    # Check organization access
    if current_user.user_role == ROLE_ADMIN:
        if user.org_id != current_user.org_id or team.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Validate user and team belong to the same organization
    if user.org_id != team.org_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User and team must belong to the same organization"
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
        return serialize_team_membership(existing, team)
    
    # Create new membership
    membership = UserTeam(
        user_id=user_id,
        team_id=team_id,
        role=role,
        joined_at=datetime.utcnow(),
        is_active=True
    )
    
    db.add(membership)
    db.commit()
    db.refresh(membership)
    
    return serialize_team_membership(membership, team)


@router.delete("/{user_id}/teams/{team_id}")
async def remove_user_from_team(
    user_id: int,
    team_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Remove user from a team (Admin or Superadmin only)"""
    membership = db.query(UserTeam).filter(
        UserTeam.user_id == user_id,
        UserTeam.team_id == team_id,
        UserTeam.is_active == True
    ).first()
    
    if not membership:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User is not a member of this team"
        )
    
    # Check organization access
    if current_user.user_role == ROLE_ADMIN:
        team = db.query(Team).filter(Team.id == team_id).first()
        if team and team.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    # Soft delete - deactivate membership
    membership.is_active = False
    membership.left_at = datetime.utcnow()
    membership.modified_at = datetime.utcnow()
    db.commit()
    
    return {"message": "User removed from team successfully"}


@router.get("/{user_id}/teams")
async def get_user_teams_endpoint(
    user_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get teams for a user"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Check access
    if current_user.user_role == ROLE_EMPLOYEE:
        if user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only view your own teams"
            )
    elif current_user.user_role == ROLE_ADMIN:
        if user.org_id != current_user.org_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
    
    memberships = db.query(UserTeam, Team).join(
        Team, UserTeam.team_id == Team.id
    ).filter(
        UserTeam.user_id == user_id,
        UserTeam.is_active == True
    ).all()
    
    return [serialize_team_membership(m.UserTeam, m.Team) for m in memberships]
