"""
Query Builder Utility
Centralizes common query filtering patterns for role-based access control.
Eliminates duplicate filtering logic across endpoints.
"""
from sqlalchemy.orm import Session, Query
from typing import List, Optional, Any
from app.models.user import User
from app.models.team import Team
from app.models.order import Order
from app.models.user_team import UserTeam
from app.core.dependencies import (
    ROLE_SUPERADMIN,
    ROLE_ADMIN,
    ROLE_TEAM_LEAD,
    ROLE_EMPLOYEE,
    get_user_teams
)


class QueryBuilder:
    """Centralized query builder for common filtering patterns"""
    
    @staticmethod
    def apply_role_based_org_filter(
        query: Query,
        current_user: User,
        model_org_field: Any,
        org_id: Optional[int] = None
    ) -> Query:
        """
        Apply organization-level filtering based on user role.
        
        Args:
            query: SQLAlchemy query object
            current_user: Current authenticated user
            model_org_field: The org_id field on the model (e.g., Order.org_id)
            org_id: Optional org_id filter parameter
            
        Returns:
            Filtered query
            
        Examples:
            query = QueryBuilder.apply_role_based_org_filter(
                db.query(Order), current_user, Order.org_id, org_id=5
            )
        """
        if current_user.user_role == ROLE_SUPERADMIN:
            if org_id:
                query = query.filter(model_org_field == org_id)
        else:  # ADMIN, TEAM_LEAD, EMPLOYEE
            query = query.filter(model_org_field == current_user.org_id)
        return query
    
    @staticmethod
    def apply_role_based_team_filter(
        query: Query,
        current_user: User,
        db: Session,
        model_team_field: Any,
        team_id: Optional[int] = None
    ) -> Query:
        """
        Apply team-level filtering based on user role.
        Supports SUPERADMIN (all teams), ADMIN (org teams), 
        TEAM_LEAD (accessible teams), EMPLOYEE (their teams).
        
        Args:
            query: SQLAlchemy query object
            current_user: Current authenticated user
            db: Database session
            model_team_field: The team_id field on the model (e.g., Order.team_id)
            team_id: Optional specific team_id filter
            
        Returns:
            Filtered query
        """
        if current_user.user_role == ROLE_SUPERADMIN:
            if team_id:
                query = query.filter(model_team_field == team_id)
        elif current_user.user_role == ROLE_ADMIN:
            # Admins see teams in their org only
            org_teams = db.query(Team.id).filter(Team.org_id == current_user.org_id).all()
            org_team_ids = [t.id for t in org_teams]
            if team_id:
                if team_id in org_team_ids:
                    query = query.filter(model_team_field == team_id)
                else:
                    query = query.filter(False)  # No access
            else:
                query = query.filter(model_team_field.in_(org_team_ids))
        elif current_user.user_role == ROLE_TEAM_LEAD:
            # Team leads see accessible teams only
            accessible_teams = get_user_teams(current_user, db)
            if accessible_teams:
                if team_id:
                    if team_id in accessible_teams:
                        query = query.filter(model_team_field == team_id)
                    else:
                        query = query.filter(False)  # No access
                else:
                    query = query.filter(model_team_field.in_(accessible_teams))
            else:
                query = query.filter(False)  # No accessible teams
        else:  # EMPLOYEE
            # Employees see their teams only
            user_teams = db.query(UserTeam.team_id).filter(
                UserTeam.user_id == current_user.id,
                UserTeam.is_active == True
            ).all()
            user_team_ids = [t.team_id for t in user_teams]
            if user_team_ids:
                if team_id:
                    if team_id in user_team_ids:
                        query = query.filter(model_team_field == team_id)
                    else:
                        query = query.filter(False)  # No access
                else:
                    query = query.filter(model_team_field.in_(user_team_ids))
            else:
                query = query.filter(False)  # No teams
        
        return query
    
    @staticmethod
    def apply_role_based_user_filter(
        query: Query,
        current_user: User,
        model_user_field: Any
    ) -> Query:
        """
        Apply user-level filtering based on role.
        Used for endpoints that filter by specific user_id.
        
        Args:
            query: SQLAlchemy query object
            current_user: Current authenticated user
            model_user_field: The user_id field on the model
            
        Returns:
            Filtered query (EMPLOYEE gets filtered to self, others unrestricted)
        """
        if current_user.user_role == ROLE_EMPLOYEE:
            query = query.filter(model_user_field == current_user.id)
        # SUPERADMIN, ADMIN, TEAM_LEAD have no additional filter
        return query
    
    @staticmethod
    def get_accessible_order_filter(
        current_user: User,
        db: Session,
        my_orders: bool = False
    ) -> Optional[Any]:
        """
        Get filter clause for orders based on user role and access level.
        Used for scenarios where orders appear in step1 or step2.
        
        Args:
            current_user: Current authenticated user
            db: Database session
            my_orders: If True, filter to current user's orders (step1 or step2)
            
        Returns:
            Filter clause or None if no restrictions
        """
        from sqlalchemy import or_
        
        if current_user.user_role == ROLE_EMPLOYEE:
            if my_orders:
                return or_(
                    Order.step1_user_id == current_user.id,
                    Order.step2_user_id == current_user.id
                )
            else:
                # Employees can only see orders they worked on
                return or_(
                    Order.step1_user_id == current_user.id,
                    Order.step2_user_id == current_user.id
                )
        
        # SUPERADMIN, ADMIN, TEAM_LEAD: No additional filter on orders themselves
        return None
    
    @staticmethod
    def apply_pagination(
        query: Query,
        skip: int = 0,
        limit: int = 100
    ) -> tuple[Query, int]:
        """
        Apply pagination to query and return total count.
        
        Args:
            query: SQLAlchemy query object
            skip: Number of records to skip
            limit: Number of records to return
            
        Returns:
            Tuple of (paginated_query, total_count)
        """
        total = query.count()
        query = query.offset(skip).limit(limit)
        return query, total
    
    @staticmethod
    def build_user_list_filter(
        current_user: User,
        db: Session,
        org_id: Optional[int] = None,
        team_id: Optional[int] = None
    ) -> Query:
        """
        Build base query for user listing based on role and filters.
        Centralizes the complex user filtering logic from users.py.
        
        Args:
            current_user: Current authenticated user
            db: Database session
            org_id: Optional org filter (superadmin only)
            team_id: Optional team filter
            
        Returns:
            Base query ready for additional filters
        """
        query = db.query(User)
        
        if current_user.user_role == ROLE_SUPERADMIN:
            if org_id:
                query = query.filter(User.org_id == org_id)
        elif current_user.user_role == ROLE_ADMIN:
            query = query.filter(User.org_id == current_user.org_id)
        elif current_user.user_role == ROLE_TEAM_LEAD:
            # Get users in accessible teams
            accessible_teams = get_user_teams(current_user, db)
            if not accessible_teams:
                return query.filter(False)  # No users visible
            
            team_user_ids = db.query(UserTeam.user_id).filter(
                UserTeam.team_id.in_(accessible_teams),
                UserTeam.is_active == True
            ).distinct().all()
            user_ids = [u.user_id for u in team_user_ids]
            
            if team_id and team_id in accessible_teams:
                # Specific team filter
                specific_team_members = db.query(UserTeam.user_id).filter(
                    UserTeam.team_id == team_id,
                    UserTeam.is_active == True
                ).all()
                user_ids = [u.user_id for u in specific_team_members]
            elif team_id:
                return query.filter(False)  # No access to this team
            
            query = query.filter(User.id.in_(user_ids))
        
        return query
