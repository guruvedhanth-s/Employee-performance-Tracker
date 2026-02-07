"""
Dashboard API Routes
Dashboard statistics for different user roles
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.core.dependencies import (
    get_current_active_user, get_user_teams,
    ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD, ROLE_EMPLOYEE
)
from app.models.user import User
from app.models.team import Team
from app.models.order import Order
from app.models.reference import OrderStatusType
from app.models.organization import Organization
from app.services.cache_service import cache
from typing import Dict, Any
from datetime import datetime

router = APIRouter()


@router.get("/admin")
async def admin_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Admin dashboard statistics"""
    if current_user.user_role not in [ROLE_ADMIN, ROLE_SUPERADMIN]:
        raise HTTPException(status_code=403, detail="Access forbidden")
    
    # Check cache first
    org_id = current_user.org_id if current_user.user_role == ROLE_ADMIN else None
    cached_data = cache.get_dashboard("admin", org_id=org_id)
    if cached_data is not None:
        return cached_data
    
    # Base queries filtered by organization for ADMIN
    if current_user.user_role == ROLE_ADMIN:
        user_query = db.query(User).filter(User.org_id == current_user.org_id)
        team_query = db.query(Team).filter(Team.org_id == current_user.org_id)
        order_query = db.query(Order).filter(Order.org_id == current_user.org_id, Order.deleted_at == None)
    else:  # SUPERADMIN sees all
        user_query = db.query(User)
        team_query = db.query(Team)
        order_query = db.query(Order).filter(Order.deleted_at == None)
    
    # Get statistics
    total_employees = user_query.filter(User.user_role == ROLE_EMPLOYEE).count()
    active_teams = team_query.filter(Team.is_active == True).count()
    
    # Get completed status ID
    completed_status = db.query(OrderStatusType).filter(OrderStatusType.name == "Completed").first()
    completed_status_id = completed_status.id if completed_status else None
    
    completed_orders = 0
    if completed_status_id:
        completed_orders = order_query.filter(Order.order_status_id == completed_status_id).count()
    
    # Get this month's orders
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    monthly_orders = order_query.filter(
        func.extract('month', Order.entry_date) == current_month,
        func.extract('year', Order.entry_date) == current_year
    ).count()
    
    result = {
        "totalEmployees": total_employees,
        "activeTeams": active_teams,
        "completedOrders": completed_orders,
        "monthlyOrders": monthly_orders
    }
    
    # Cache the result
    cache.set_dashboard("admin", result, org_id=org_id)
    return result


@router.get("/teamlead")
async def teamlead_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Team Lead dashboard statistics"""
    if current_user.user_role != ROLE_TEAM_LEAD:
        raise HTTPException(status_code=403, detail="Access forbidden")
    
    # Get teams the team lead manages
    accessible_teams = get_user_teams(current_user, db)
    
    if not accessible_teams:
        return {
            "teamMembers": 0,
            "totalOrders": 0,
            "completedOrders": 0
        }
    
    # Check cache first
    team_ids_key = ",".join(str(t) for t in sorted(accessible_teams))
    cached_data = cache.get_dashboard("teamlead", user_id=current_user.id, team_ids=team_ids_key)
    if cached_data is not None:
        return cached_data
    
    # Import UserTeam model
    from app.models.user_team import UserTeam
    
    # Get team members across all managed teams
    team_members = db.query(User).join(UserTeam).filter(
        UserTeam.team_id.in_(accessible_teams),
        UserTeam.is_active == True
    ).distinct().count()
    
    # Get team orders
    team_orders = db.query(Order).filter(
        Order.team_id.in_(accessible_teams),
        Order.deleted_at == None
    ).count()
    
    # Get completed status ID
    completed_status = db.query(OrderStatusType).filter(OrderStatusType.name == "Completed").first()
    completed_status_id = completed_status.id if completed_status else None
    
    completed_orders = 0
    if completed_status_id:
        completed_orders = db.query(Order).filter(
            Order.team_id.in_(accessible_teams),
            Order.order_status_id == completed_status_id,
            Order.deleted_at == None
        ).count()
    
    result = {
        "teamMembers": team_members,
        "totalOrders": team_orders,
        "completedOrders": completed_orders
    }
    
    # Cache the result
    cache.set_dashboard("teamlead", result, user_id=current_user.id, team_ids=team_ids_key)
    return result


@router.get("/employee")
async def employee_dashboard(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Employee dashboard statistics"""
    
    # Check cache first
    cached_data = cache.get_dashboard("employee", user_id=current_user.id)
    if cached_data is not None:
        return cached_data
    
    # Get completed status ID
    completed_status = db.query(OrderStatusType).filter(OrderStatusType.name == "Completed").first()
    completed_status_id = completed_status.id if completed_status else None
    
    # Get employee's orders (where they did step1 or step2)
    my_orders_query = db.query(Order).filter(
        or_(
            Order.step1_user_id == current_user.id,
            Order.step2_user_id == current_user.id
        ),
        Order.deleted_at == None
    )
    
    my_orders = my_orders_query.count()
    
    completed_orders = 0
    pending_orders = 0
    if completed_status_id:
        completed_orders = my_orders_query.filter(
            Order.order_status_id == completed_status_id
        ).count()
        
        pending_orders = my_orders_query.filter(
            Order.order_status_id != completed_status_id
        ).count()
    else:
        pending_orders = my_orders
    
    result = {
        "myOrders": my_orders,
        "completedOrders": completed_orders,
        "pendingOrders": pending_orders
    }
    
    # Cache the result
    cache.set_dashboard("employee", result, user_id=current_user.id)
    return result


@router.get("/stats")
async def get_dashboard_stats(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get general dashboard stats based on user role - redirects to role-specific endpoint"""
    if current_user.user_role in [ROLE_ADMIN, ROLE_SUPERADMIN]:
        return await admin_dashboard(current_user, db)
    elif current_user.user_role == ROLE_TEAM_LEAD:
        return await teamlead_dashboard(current_user, db)
    else:
        return await employee_dashboard(current_user, db)
