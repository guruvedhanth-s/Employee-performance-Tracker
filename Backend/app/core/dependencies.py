"""
Dependencies Module
Authentication and authorization dependencies for FastAPI routes
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import List, Optional, Any
from app.core.security import decode_token
from app.database import get_db
from app.models.user import User, UserRole
from app.services.session_service import session_service

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Get current authenticated user from JWT token with session validation
    
    Validates:
    - Token signature and expiration
    - Token is not blacklisted
    - User exists and is active
    - Token version matches user's current version
    """
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Extract JTI and check if token is blacklisted
    jti = payload.get("jti")
    if jti and session_service.is_token_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    
    # Check token version (invalidates all tokens when password changes)
    token_version = payload.get("version", 0)
    if token_version != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been invalidated. Please login again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Update session activity if JTI exists
    if jti:
        session_service.update_session_activity(user.id, jti)
    
    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure user is active"""
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user"
        )
    return current_user


class RoleChecker:
    """Dependency class to check if user has required role(s)"""
    
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles
    
    def __call__(self, user: User = Depends(get_current_active_user)) -> User:
        if user.user_role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User with role '{user.user_role}' is not authorized to access this resource"
            )
        return user


# Role constants for easier checking
ROLE_SUPERADMIN = "superadmin"
ROLE_ADMIN = "admin"
ROLE_TEAM_LEAD = "team_lead"
ROLE_EMPLOYEE = "employee"


# Convenience dependencies for specific roles
def require_superadmin(user: User = Depends(get_current_active_user)) -> User:
    """Require user to be a superadmin"""
    if user.user_role != ROLE_SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Superadmin access required"
        )
    return user


def require_admin(user: User = Depends(get_current_active_user)) -> User:
    """Require user to be an admin or superadmin"""
    if user.user_role not in [ROLE_SUPERADMIN, ROLE_ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return user


def require_team_lead(user: User = Depends(get_current_active_user)) -> User:
    """Require user to be at least a team lead"""
    allowed = [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD]
    if user.user_role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team lead or higher access required"
        )
    return user


def require_team_lead_or_admin(user: User = Depends(get_current_active_user)) -> User:
    """Require user to be team lead or admin"""
    allowed = [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD]
    if user.user_role not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team lead or admin access required"
        )
    return user


def check_org_access(user: User, org_id: int) -> bool:
    """Check if user has access to a specific organization"""
    # Superadmin has access to all organizations
    if user.user_role == ROLE_SUPERADMIN:
        return True
    # Others only have access to their own organization
    return user.org_id == org_id


def verify_org_access(org_id: int, user: User = Depends(get_current_active_user)) -> User:
    """Verify user has access to the specified organization"""
    if not check_org_access(user, org_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this organization"
        )
    return user


def check_team_access(user: User, team_id: int, db: Session) -> bool:
    """Check if user has access to a specific team"""
    from app.models.team import Team
    from app.models.user_team import UserTeam
    
    # Superadmin has access to all teams
    if user.user_role == ROLE_SUPERADMIN:
        return True
    
    # Admin has access to all teams in their organization
    if user.user_role == ROLE_ADMIN:
        team = db.query(Team).filter(Team.id == team_id).first()
        if team and team.org_id == user.org_id:
            return True
        return False
    
    # Team lead has access to teams they lead
    if user.user_role == ROLE_TEAM_LEAD:
        team = db.query(Team).filter(Team.id == team_id).first()
        if team and team.team_lead_id == user.id:
            return True
    
    # Check if user is a member of the team
    membership = db.query(UserTeam).filter(
        UserTeam.user_id == user.id,
        UserTeam.team_id == team_id,
        UserTeam.is_active == True
    ).first()
    
    return membership is not None


def get_user_teams(user: User, db: Session) -> List[int]:
    """Get list of team IDs the user has access to"""
    from app.models.team import Team
    from app.models.user_team import UserTeam
    
    # Superadmin has access to all teams
    if user.user_role == ROLE_SUPERADMIN:
        teams = db.query(Team.id).all()
        return [t.id for t in teams]
    
    # Admin has access to all teams in their organization
    if user.user_role == ROLE_ADMIN:
        teams = db.query(Team.id).filter(Team.org_id == user.org_id).all()
        return [t.id for t in teams]
    
    # Team lead has access to teams they lead (where team_lead_id = user.id)
    if user.user_role == ROLE_TEAM_LEAD:
        teams = db.query(Team.id).filter(
            Team.team_lead_id == user.id,
            Team.is_active == True
        ).all()
        return [t.id for t in teams]
    
    # Employees have access to teams they're members of
    memberships = db.query(UserTeam.team_id).filter(
        UserTeam.user_id == user.id,
        UserTeam.is_active == True
    ).all()
    
    return [m.team_id for m in memberships]
