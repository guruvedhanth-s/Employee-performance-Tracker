"""
Team User Alias API
Endpoints for managing team-specific user aliases (FA names for masking)
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models.user import User
from app.models.team import Team
from app.models.team_user_alias import TeamUserAlias
from app.models.user_team import UserTeam
from app.schemas.team_user_alias import (
    TeamUserAliasCreate,
    TeamUserAliasUpdate,
    TeamUserAliasResponse,
    TeamUserAliasListResponse,
    UserAliasOption
)
from app.core.dependencies import (
    get_current_active_user,
    check_team_access,
    ROLE_SUPERADMIN,
    ROLE_ADMIN,
    ROLE_TEAM_LEAD
)


router = APIRouter()


@router.get("/teams/{team_id}/aliases", response_model=TeamUserAliasListResponse)
async def get_team_aliases(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all user aliases for a specific team"""
    # Verify team exists
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check permissions
    if current_user.user_role not in [ROLE_SUPERADMIN, ROLE_ADMIN]:
        # Team leads can only see their own team's aliases
        if current_user.user_role == ROLE_TEAM_LEAD and team.team_lead_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not authorized to view this team's aliases")
    
    # Get aliases with user info
    aliases = db.query(TeamUserAlias).filter(
        TeamUserAlias.team_id == team_id,
        TeamUserAlias.is_active == True
    ).all()
    
    # Batch query all users to avoid N+1
    user_ids = [alias.user_id for alias in aliases]
    users = {}
    if user_ids:
        users = {u.id: u for u in db.query(User).filter(User.id.in_(user_ids)).all()}
    
    result = []
    for alias in aliases:
        user = users.get(alias.user_id)
        result.append({
            "id": alias.id,
            "teamId": alias.team_id,
            "userId": alias.user_id,
            "faName": alias.fa_name,
            "isActive": alias.is_active,
            "userName": user.user_name if user else None,
            "teamName": team.name
        })
    
    return {"items": result, "total": len(result)}


@router.get("/teams/{team_id}/alias-options", response_model=List[UserAliasOption])
async def get_team_alias_options(
    team_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get user alias options for order creation dropdown - returns users with their FA names"""
    # Verify team exists
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Get active team members with their aliases
    team_members = db.query(UserTeam).filter(
        UserTeam.team_id == team_id,
        UserTeam.is_active == True
    ).all()
    
    # Batch query all users to avoid N+1
    user_ids = [member.user_id for member in team_members]
    users = {}
    if user_ids:
        users = {u.id: u for u in db.query(User).filter(
            User.id.in_(user_ids),
            User.is_active == True
        ).all()}
    
    # Batch query all aliases to avoid N+1
    aliases = {}
    if user_ids:
        alias_rows = db.query(TeamUserAlias).filter(
            TeamUserAlias.team_id == team_id,
            TeamUserAlias.user_id.in_(user_ids),
            TeamUserAlias.is_active == True
        ).all()
        aliases = {a.user_id: a for a in alias_rows}
    
    result = []
    for member in team_members:
        user = users.get(member.user_id)
        if not user:
            continue
        
        alias = aliases.get(user.id)
        result.append({
            "userId": user.id,
            "userName": user.user_name,
            "faName": alias.fa_name if alias else user.user_name  # Fallback to real name if no alias
        })
    
    return result


@router.post("/teams/{team_id}/users/{user_id}/alias", response_model=TeamUserAliasResponse)
async def create_or_update_user_alias(
    team_id: int,
    user_id: int,
    alias_data: TeamUserAliasCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create or update a FA name alias for a user in a team"""
    # Check user has permission (superadmin, admin, or team_lead)
    if current_user.user_role not in [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Verify team exists
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if user is a member of the team
    membership = db.query(UserTeam).filter(
        UserTeam.team_id == team_id,
        UserTeam.user_id == user_id
    ).first()
    if not membership:
        raise HTTPException(status_code=400, detail="User is not a member of this team")
    
    # Check permissions - team leads can only manage their own team
    if current_user.user_role == ROLE_TEAM_LEAD and team.team_lead_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to manage this team's aliases")
    
    # Check if alias already exists
    existing_alias = db.query(TeamUserAlias).filter(
        TeamUserAlias.team_id == team_id,
        TeamUserAlias.user_id == user_id
    ).first()
    
    if existing_alias:
        # Update existing alias
        existing_alias.fa_name = alias_data.fa_name
        existing_alias.is_active = True
        db.commit()
        db.refresh(existing_alias)
        
        return {
            "id": existing_alias.id,
            "teamId": existing_alias.team_id,
            "userId": existing_alias.user_id,
            "faName": existing_alias.fa_name,
            "isActive": existing_alias.is_active,
            "userName": user.user_name,
            "teamName": team.name
        }
    else:
        # Create new alias
        new_alias = TeamUserAlias(
            team_id=team_id,
            user_id=user_id,
            fa_name=alias_data.fa_name
        )
        db.add(new_alias)
        db.commit()
        db.refresh(new_alias)
        
        return {
            "id": new_alias.id,
            "teamId": new_alias.team_id,
            "userId": new_alias.user_id,
            "faName": new_alias.fa_name,
            "isActive": new_alias.is_active,
            "userName": user.user_name,
            "teamName": team.name
        }


@router.delete("/teams/{team_id}/users/{user_id}/alias")
async def delete_user_alias(
    team_id: int,
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Delete a user's FA name alias from a team"""
    # Check user has permission (superadmin, admin, or team_lead)
    if current_user.user_role not in [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    # Verify team exists
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    
    # Check permissions - team leads can only manage their own team
    if current_user.user_role == ROLE_TEAM_LEAD and team.team_lead_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to manage this team's aliases")
    
    # Find and delete the alias
    alias = db.query(TeamUserAlias).filter(
        TeamUserAlias.team_id == team_id,
        TeamUserAlias.user_id == user_id
    ).first()
    
    if not alias:
        raise HTTPException(status_code=404, detail="Alias not found")
    
    db.delete(alias)
    db.commit()
    
    return {"message": "Alias deleted successfully"}
