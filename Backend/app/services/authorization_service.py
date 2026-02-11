"""
Authorization Service
Centralizes authorization/access control logic for teams and resources.
Eliminates duplicate authorization checks across endpoints.
"""
from fastapi import HTTPException, status
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.team import Team
from app.models.user_team import UserTeam
from app.core.dependencies import (
    ROLE_SUPERADMIN,
    ROLE_ADMIN,
    ROLE_TEAM_LEAD,
    ROLE_EMPLOYEE,
    get_user_teams
)


class AuthorizationService:
    """Centralized authorization checks"""
    
    @staticmethod
    def check_team_access(
        current_user: User,
        team_id: int,
        db: Session,
        raise_exception: bool = True
    ) -> bool:
        """
        Check if user has access to a specific team.
        
        Args:
            current_user: The current user
            team_id: Team ID to check access for
            db: Database session
            raise_exception: If True, raises HTTPException on access denied
            
        Returns:
            True if user has access, False otherwise
            
        Raises:
            HTTPException if raise_exception=True and access denied
        """
        if current_user.user_role == ROLE_SUPERADMIN:
            return True
        
        if current_user.user_role == ROLE_ADMIN:
            # Admin must have team in their org
            team = db.query(Team).filter(Team.id == team_id).first()
            if not team or team.org_id != current_user.org_id:
                if raise_exception:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Cannot access this team"
                    )
                return False
            return True
        
        if current_user.user_role == ROLE_TEAM_LEAD:
            # Team lead must be a member/lead of the team
            accessible_teams = get_user_teams(current_user, db)
            if team_id not in accessible_teams:
                if raise_exception:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Cannot access this team"
                    )
                return False
            return True
        
        # EMPLOYEE cannot manage teams
        if raise_exception:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Employees cannot access this resource"
            )
        return False
    
    @staticmethod
    def check_team_lead_team(
        current_user: User,
        team_id: int,
        db: Session,
        raise_exception: bool = True
    ) -> bool:
        """
        Check if a team lead is the leader of a specific team.
        Specific to the team_lead_id ownership check.
        
        Args:
            current_user: Must be a TEAM_LEAD
            team_id: Team ID to check ownership
            db: Database session
            raise_exception: If True, raises HTTPException on failure
            
        Returns:
            True if current_user is the lead of the team
        """
        team = db.query(Team).filter(Team.id == team_id).first()
        
        if not team:
            if raise_exception:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Team not found"
                )
            return False
        
        if team.team_lead_id != current_user.id:
            if raise_exception:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You can only manage your own team"
                )
            return False
        
        return True
    
    @staticmethod
    def check_employee_readonly_access(
        current_user: User,
        target_user_id: int,
        raise_exception: bool = True
    ) -> bool:
        """
        Check if current user can view another user's data (employees can only view self).
        
        Args:
            current_user: The current user
            target_user_id: The user ID being accessed
            raise_exception: If True, raises HTTPException on access denied
            
        Returns:
            True if access allowed
        """
        if current_user.user_role == ROLE_EMPLOYEE and current_user.id != target_user_id:
            if raise_exception:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Employees can only view their own data"
                )
            return False
        return True
    
    @staticmethod
    def check_team_lead_team_member_access(
        current_user: User,
        target_user_id: int,
        team_id: int,
        db: Session,
        raise_exception: bool = True
    ) -> bool:
        """
        Check if a team lead can access a team member.
        Team leads can only access members of their teams.
        
        Args:
            current_user: Must be TEAM_LEAD
            target_user_id: User ID to check access for
            team_id: Team context
            db: Database session
            raise_exception: If True, raises HTTPException on access denied
            
        Returns:
            True if team lead can access this user in this team
        """
        # Check if target user is member of the team
        membership = db.query(UserTeam).filter(
            UserTeam.user_id == target_user_id,
            UserTeam.team_id == team_id,
            UserTeam.is_active == True
        ).first()
        
        if not membership:
            if raise_exception:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User is not a member of this team"
                )
            return False
        
        return True
    
    @staticmethod
    def check_user_in_team(
        user_id: int,
        team_id: int,
        db: Session,
        must_be_active: bool = True,
        raise_exception: bool = True
    ) -> bool:
        """
        Check if a user is a member of a team.
        
        Args:
            user_id: User to check
            team_id: Team to check membership in
            db: Database session
            must_be_active: If True, membership must be active
            raise_exception: If True, raises HTTPException if not a member
            
        Returns:
            True if user is a member
        """
        query = db.query(UserTeam).filter(
            UserTeam.user_id == user_id,
            UserTeam.team_id == team_id
        )
        
        if must_be_active:
            query = query.filter(UserTeam.is_active == True)
        
        membership = query.first()
        
        if not membership:
            if raise_exception:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="User is not a member of this team"
                )
            return False
        
        return True
    
    @staticmethod
    def check_org_membership(
        current_user: User,
        org_id: int,
        raise_exception: bool = True
    ) -> bool:
        """
        Check if an admin belongs to an organization.
        
        Args:
            current_user: Must not be SUPERADMIN
            org_id: Organization to check
            raise_exception: If True, raises HTTPException if not member
            
        Returns:
            True if user is member of org
        """
        if current_user.user_role == ROLE_SUPERADMIN:
            return True
        
        if current_user.org_id != org_id:
            if raise_exception:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not have access to this organization"
                )
            return False
        
        return True
    
    @staticmethod
    def require_team_lead_or_admin(
        current_user: User,
        raise_exception: bool = True
    ) -> bool:
        """
        Check if user is TEAM_LEAD or ADMIN (or SUPERADMIN).
        
        Args:
            current_user: User to check
            raise_exception: If True, raises HTTPException if check fails
            
        Returns:
            True if user is team lead or admin
        """
        allowed_roles = [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD]
        if current_user.user_role not in allowed_roles:
            if raise_exception:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Team lead or admin access required"
                )
            return False
        return True
