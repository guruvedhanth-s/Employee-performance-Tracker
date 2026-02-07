"""
Metrics API Routes
Performance metrics for employees and teams, dashboard stats
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from typing import List, Optional, Dict, Any
from datetime import date
import json
from app.database import get_db
from app.core.dependencies import (
    get_current_active_user, require_admin, require_team_lead,
    check_org_access, check_team_access, get_user_teams,
    ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD, ROLE_EMPLOYEE
)
from app.models.user import User
from app.models.team import Team
from app.models.order import Order
from app.models.user_team import UserTeam
from app.models.metrics import EmployeePerformanceMetrics, TeamPerformanceMetrics
from app.models.reference import OrderStatusType
from app.models.quality_audit import QualityAudit
from app.services.cache_service import cache
from app.services.productivity_service import ProductivityService

router = APIRouter()


# ============ Serializer Functions ============

def serialize_dashboard_stats(
    total_orders: int,
    orders_completed: int,
    orders_on_hold: int,
    orders_bp_rti: int,
    orders_pending_billing: int,
    total_employees: int,
    active_employees: int,
    total_teams: int,
    avg_completion_time_minutes: Optional[int] = None
) -> dict:
    """Serialize dashboard stats to camelCase dict"""
    return {
        "totalOrders": total_orders,
        "ordersCompleted": orders_completed,
        "ordersOnHold": orders_on_hold,
        "ordersBpRti": orders_bp_rti,
        "ordersPendingBilling": orders_pending_billing,
        "totalEmployees": total_employees,
        "activeEmployees": active_employees,
        "totalTeams": total_teams,
        "avgCompletionTimeMinutes": avg_completion_time_minutes
    }


def serialize_employee_metrics(m, user: Optional[User] = None, team: Optional[Team] = None) -> dict:
    """Serialize employee metrics to camelCase dict"""
    return {
        "id": m.id,
        "userId": m.user_id,
        "teamId": m.team_id,
        "orgId": m.org_id,
        "metricDate": m.metric_date.isoformat() if m.metric_date else None,
        "periodType": m.period_type,
        "totalOrdersAssigned": m.total_orders_assigned,
        "totalStep1Completed": m.total_step1_completed,
        "totalStep2Completed": m.total_step2_completed,
        "totalSingleSeatCompleted": m.total_single_seat_completed,
        "totalOrdersCompleted": m.total_orders_completed,
        "totalWorkingMinutes": m.total_working_minutes,
        "avgStep1DurationMinutes": m.avg_step1_duration_minutes,
        "avgStep2DurationMinutes": m.avg_step2_duration_minutes,
        "avgOrderCompletionMinutes": m.avg_order_completion_minutes,
        "ordersOnHold": m.orders_on_hold,
        "ordersCompleted": m.orders_completed,
        "ordersBpRti": m.orders_bp_rti,
        "efficiencyScore": float(m.efficiency_score) if m.efficiency_score else None,
        "qualityScore": float(m.quality_score) if m.quality_score else None,
        "calculationStatus": m.calculation_status,
        "createdAt": m.created_at.isoformat() if m.created_at else None,
        "modifiedAt": m.modified_at.isoformat() if m.modified_at else None,
        "userName": user.user_name if user else None,
        "userName": user.user_name if user else None,
        "teamName": team.name if team else None
    }


def serialize_team_metrics(m, team: Optional[Team] = None) -> dict:
    """Serialize team metrics to camelCase dict"""
    return {
        "id": m.id,
        "teamId": m.team_id,
        "orgId": m.org_id,
        "metricDate": m.metric_date.isoformat() if m.metric_date else None,
        "periodType": m.period_type,
        "totalOrdersAssigned": m.total_orders_assigned,
        "totalOrdersCompleted": m.total_orders_completed,
        "totalOrdersInProgress": m.total_orders_in_progress,
        "totalOrdersOnHold": m.total_orders_on_hold,
        "totalOrdersBpRti": m.total_orders_bp_rti,
        "totalTeamWorkingMinutes": m.total_team_working_minutes,
        "avgOrderCompletionMinutes": m.avg_order_completion_minutes,
        "activeEmployeesCount": m.active_employees_count,
        "teamEfficiencyScore": float(m.team_efficiency_score) if m.team_efficiency_score else None,
        "ordersPerEmployee": float(m.orders_per_employee) if m.orders_per_employee else None,
        "completionRate": float(m.completion_rate) if m.completion_rate else None,
        "transactionBreakdown": json.loads(m.transaction_breakdown) if m.transaction_breakdown else None,
        "productBreakdown": json.loads(m.product_breakdown) if m.product_breakdown else None,
        "stateBreakdown": json.loads(m.state_breakdown) if m.state_breakdown else None,
        "calculationStatus": m.calculation_status,
        "createdAt": m.created_at.isoformat() if m.created_at else None,
        "modifiedAt": m.modified_at.isoformat() if m.modified_at else None,
        "teamName": team.name if team else None
    }


# ============ Dashboard Stats ============
@router.get("/dashboard")
async def get_dashboard_stats(
    org_id: Optional[int] = Query(None, description="Filter by organization"),
    team_id: Optional[int] = Query(None, description="Filter by team"),
    month: Optional[int] = Query(None, ge=1, le=12, description="Filter by month (1-12)"),
    year: Optional[int] = Query(None, ge=2000, le=2100, description="Filter by year"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get dashboard statistics based on user role"""
    # Build cache key based on user role and filters
    cache_key_extra = f"role:{current_user.user_role}:org:{org_id}:team:{team_id}:month:{month}:year:{year}:user:{current_user.id}"
    cached_data = cache.get_metrics("dashboard", org_id=org_id, extra_key=cache_key_extra)
    if cached_data is not None:
        return cached_data
    
    # Base order query (exclude deleted)
    order_query = db.query(Order).filter(Order.deleted_at == None)
    
    # Apply role-based filtering
    if current_user.user_role == ROLE_SUPERADMIN:
        if org_id:
            order_query = order_query.filter(Order.org_id == org_id)
    elif current_user.user_role == ROLE_ADMIN:
        order_query = order_query.filter(Order.org_id == current_user.org_id)
    elif current_user.user_role == ROLE_TEAM_LEAD:
        accessible_teams = get_user_teams(current_user, db)
        if accessible_teams:
            order_query = order_query.filter(Order.team_id.in_(accessible_teams))
        else:
            order_query = order_query.filter(False)  # No results
    else:  # Employee - show their orders only
        order_query = order_query.filter(
            or_(
                Order.step1_user_id == current_user.id,
                Order.step2_user_id == current_user.id
            )
        )
    
    if team_id:
        order_query = order_query.filter(Order.team_id == team_id)
    
    # Apply month/year filtering on entry_date
    if month:
        order_query = order_query.filter(func.extract('month', Order.entry_date) == month)
    if year:
        order_query = order_query.filter(func.extract('year', Order.entry_date) == year)
    
    # Get counts
    total_orders = order_query.count()
    
    # Status counts - need to join with order_status table
    completed_status = db.query(OrderStatusType).filter(OrderStatusType.name == "Completed").first()
    on_hold_status = db.query(OrderStatusType).filter(OrderStatusType.name == "On-hold").first()
    bp_rti_status = db.query(OrderStatusType).filter(OrderStatusType.name == "BP and RTI").first()
    
    orders_completed = order_query.filter(Order.order_status_id == completed_status.id).count() if completed_status else 0
    orders_on_hold = order_query.filter(Order.order_status_id == on_hold_status.id).count() if on_hold_status else 0
    orders_bp_rti = order_query.filter(Order.order_status_id == bp_rti_status.id).count() if bp_rti_status else 0
    orders_pending_billing = order_query.filter(Order.billing_status == "pending").count()
    
    # User/Team counts based on same filters (not filtered by month/year - these are current totals)
    user_query = db.query(User)
    team_query = db.query(Team)
    
    if current_user.user_role == ROLE_SUPERADMIN:
        if org_id:
            user_query = user_query.filter(User.org_id == org_id)
            team_query = team_query.filter(Team.org_id == org_id)
    elif current_user.user_role in [ROLE_ADMIN, ROLE_TEAM_LEAD, ROLE_EMPLOYEE]:
        user_query = user_query.filter(User.org_id == current_user.org_id)
        team_query = team_query.filter(Team.org_id == current_user.org_id)
    
    # Count all staff (excluding superadmin) - matches Employee Management page
    total_employees = user_query.filter(User.user_role != ROLE_SUPERADMIN).count()
    active_employees = user_query.filter(User.user_role != ROLE_SUPERADMIN, User.is_active == True).count()
    total_teams = team_query.filter(Team.is_active == True).count()
    
    result = serialize_dashboard_stats(
        total_orders=total_orders,
        orders_completed=orders_completed,
        orders_on_hold=orders_on_hold,
        orders_bp_rti=orders_bp_rti,
        orders_pending_billing=orders_pending_billing,
        total_employees=total_employees,
        active_employees=active_employees,
        total_teams=total_teams,
        avg_completion_time_minutes=None  # Would need calculation from actual time data
    )
    
    # Cache the result
    cache.set_metrics("dashboard", result, org_id=org_id, extra_key=cache_key_extra)
    return result


# ============ Employee Metrics ============
@router.get("/employees")
async def list_employee_metrics(
    org_id: Optional[int] = Query(None, description="Filter by organization"),
    team_id: Optional[int] = Query(None, description="Filter by team"),
    user_id: Optional[int] = Query(None, description="Filter by user"),
    period_type: Optional[str] = Query(None, description="Filter by period type (daily, weekly, monthly)"),
    start_date: Optional[date] = Query(None, description="Filter start date"),
    end_date: Optional[date] = Query(None, description="Filter end date"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List employee performance metrics"""
    query = db.query(EmployeePerformanceMetrics).filter(
        EmployeePerformanceMetrics.deleted_at == None
    )
    
    # Apply role-based filtering
    if current_user.user_role == ROLE_SUPERADMIN:
        if org_id:
            query = query.filter(EmployeePerformanceMetrics.org_id == org_id)
    elif current_user.user_role == ROLE_ADMIN:
        query = query.filter(EmployeePerformanceMetrics.org_id == current_user.org_id)
    elif current_user.user_role == ROLE_TEAM_LEAD:
        accessible_teams = get_user_teams(current_user, db)
        if accessible_teams:
            query = query.filter(EmployeePerformanceMetrics.team_id.in_(accessible_teams))
        else:
            return {"items": [], "total": 0}
    else:  # Employee - only their own metrics
        query = query.filter(EmployeePerformanceMetrics.user_id == current_user.id)
    
    # Apply filters
    if team_id:
        query = query.filter(EmployeePerformanceMetrics.team_id == team_id)
    if user_id:
        query = query.filter(EmployeePerformanceMetrics.user_id == user_id)
    if period_type:
        query = query.filter(EmployeePerformanceMetrics.period_type == period_type)
    if start_date:
        query = query.filter(EmployeePerformanceMetrics.metric_date >= start_date)
    if end_date:
        query = query.filter(EmployeePerformanceMetrics.metric_date <= end_date)
    
    total = query.count()
    offset = (page - 1) * page_size
    
    metrics = query.order_by(
        EmployeePerformanceMetrics.metric_date.desc()
    ).offset(offset).limit(page_size).all()
    
    # Enrich with user and team names, and add productivity and quality data
    result_items = []
    productivity_service = ProductivityService(db)
    
    for m in metrics:
        user = db.query(User).filter(User.id == m.user_id).first()
        team = db.query(Team).filter(Team.id == m.team_id).first() if m.team_id else None
        
        # Serialize base metrics
        item = serialize_employee_metrics(m, user, team)
        
        # Add productivity data if user is an employee
        if user and user.user_role == 'employee':
            try:
                productivity_data = productivity_service.calculate_employee_score(
                    user_id=m.user_id,
                    start_date=m.metric_date,
                    end_date=m.metric_date
                )
                if "error" not in productivity_data:
                    item["productivityScore"] = productivity_data.get("productivityPercent")
                    item["productivityTarget"] = productivity_data.get("expectedTarget")
            except Exception as e:
                item["productivityScore"] = None
                item["productivityTarget"] = None
        else:
            item["productivityScore"] = None
            item["productivityTarget"] = None
        
        # Add quality audit data for the same date
        quality_audits = db.query(QualityAudit).filter(
            QualityAudit.examiner_id == m.user_id,
            QualityAudit.audit_date == m.metric_date,
            QualityAudit.deleted_at == None
        ).all()
        
        if quality_audits:
            # Calculate average quality scores
            fb_quality_scores = [qa.fb_quality for qa in quality_audits if qa.fb_quality is not None]
            ofe_quality_scores = [qa.ofe_quality for qa in quality_audits if qa.ofe_quality is not None]
            cce_quality_scores = [qa.cce_quality for qa in quality_audits if qa.cce_quality is not None]
            
            item["qualityFbScore"] = round(sum(fb_quality_scores) / len(fb_quality_scores) * 100, 2) if fb_quality_scores else None
            item["qualityOfeScore"] = round(sum(ofe_quality_scores) / len(ofe_quality_scores) * 100, 2) if ofe_quality_scores else None
            item["qualityCceScore"] = round(sum(cce_quality_scores) / len(cce_quality_scores) * 100, 2) if cce_quality_scores else None
            item["qualityAuditCount"] = len(quality_audits)
        else:
            item["qualityFbScore"] = None
            item["qualityOfeScore"] = None
            item["qualityCceScore"] = None
            item["qualityAuditCount"] = 0
        
        result_items.append(item)
    
    return {"items": result_items, "total": total}


@router.get("/employees/{user_id}/summary")
async def get_employee_metrics_summary(
    user_id: int,
    period_type: str = Query("monthly", description="Period type (daily, weekly, monthly)"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get summarized metrics for a specific employee"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    
    # Check access
    if current_user.user_role == ROLE_EMPLOYEE:
        if current_user.id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    elif current_user.user_role == ROLE_ADMIN:
        if user.org_id != current_user.org_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    elif current_user.user_role == ROLE_TEAM_LEAD:
        # Check if user is in team lead's teams
        accessible_teams = get_user_teams(current_user, db)
        user_teams = db.query(UserTeam.team_id).filter(
            UserTeam.user_id == user_id,
            UserTeam.is_active == True
        ).all()
        user_team_ids = [t.team_id for t in user_teams]
        if not any(t in accessible_teams for t in user_team_ids):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    
    query = db.query(EmployeePerformanceMetrics).filter(
        EmployeePerformanceMetrics.user_id == user_id,
        EmployeePerformanceMetrics.period_type == period_type,
        EmployeePerformanceMetrics.deleted_at == None
    )
    
    if start_date:
        query = query.filter(EmployeePerformanceMetrics.metric_date >= start_date)
    if end_date:
        query = query.filter(EmployeePerformanceMetrics.metric_date <= end_date)
    
    metrics = query.order_by(EmployeePerformanceMetrics.metric_date.desc()).limit(12).all()
    
    # Initialize services
    productivity_service = ProductivityService(db)
    
    # Build metrics response with productivity and quality data
    metrics_with_extras = []
    for m in metrics:
        metric_data = {
            "metricDate": m.metric_date.isoformat() if m.metric_date else None,
            "totalOrdersCompleted": m.total_orders_completed,
            "totalStep1Completed": m.total_step1_completed,
            "totalStep2Completed": m.total_step2_completed,
            "totalWorkingMinutes": m.total_working_minutes,
            "efficiencyScore": float(m.efficiency_score) if m.efficiency_score else None
        }
        
        # Add productivity data
        if user.user_role == 'employee':
            try:
                productivity_data = productivity_service.calculate_employee_score(
                    user_id=user_id,
                    start_date=m.metric_date,
                    end_date=m.metric_date
                )
                if "error" not in productivity_data:
                    metric_data["productivityScore"] = productivity_data.get("productivityPercent")
                    metric_data["productivityTarget"] = productivity_data.get("expectedTarget")
            except Exception:
                metric_data["productivityScore"] = None
                metric_data["productivityTarget"] = None
        else:
            metric_data["productivityScore"] = None
            metric_data["productivityTarget"] = None
        
        # Add quality audit data
        quality_audits = db.query(QualityAudit).filter(
            QualityAudit.examiner_id == user_id,
            QualityAudit.audit_date == m.metric_date,
            QualityAudit.deleted_at == None
        ).all()
        
        if quality_audits:
            fb_quality_scores = [qa.fb_quality for qa in quality_audits if qa.fb_quality is not None]
            ofe_quality_scores = [qa.ofe_quality for qa in quality_audits if qa.ofe_quality is not None]
            cce_quality_scores = [qa.cce_quality for qa in quality_audits if qa.cce_quality is not None]
            
            metric_data["qualityFbScore"] = round(sum(fb_quality_scores) / len(fb_quality_scores) * 100, 2) if fb_quality_scores else None
            metric_data["qualityOfeScore"] = round(sum(ofe_quality_scores) / len(ofe_quality_scores) * 100, 2) if ofe_quality_scores else None
            metric_data["qualityCceScore"] = round(sum(cce_quality_scores) / len(cce_quality_scores) * 100, 2) if cce_quality_scores else None
        else:
            metric_data["qualityFbScore"] = None
            metric_data["qualityOfeScore"] = None
            metric_data["qualityCceScore"] = None
        
        metrics_with_extras.append(metric_data)
    
    return {
        "userId": user_id,
        "userName": user.user_name,
        "userName": user.user_name,
        "periodType": period_type,
        "metrics": metrics_with_extras
    }


# ============ Team Metrics ============
@router.get("/teams")
async def list_team_metrics(
    org_id: Optional[int] = Query(None, description="Filter by organization"),
    team_id: Optional[int] = Query(None, description="Filter by team"),
    period_type: Optional[str] = Query(None, description="Filter by period type"),
    start_date: Optional[date] = Query(None, description="Filter start date"),
    end_date: Optional[date] = Query(None, description="Filter end date"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List team performance metrics"""
    query = db.query(TeamPerformanceMetrics).filter(
        TeamPerformanceMetrics.deleted_at == None
    )
    
    # Apply role-based filtering
    if current_user.user_role == ROLE_SUPERADMIN:
        if org_id:
            query = query.filter(TeamPerformanceMetrics.org_id == org_id)
    elif current_user.user_role == ROLE_ADMIN:
        query = query.filter(TeamPerformanceMetrics.org_id == current_user.org_id)
    elif current_user.user_role == ROLE_TEAM_LEAD:
        accessible_teams = get_user_teams(current_user, db)
        if accessible_teams:
            query = query.filter(TeamPerformanceMetrics.team_id.in_(accessible_teams))
        else:
            return {"items": [], "total": 0}
    else:  # Employee - their teams only
        user_teams = db.query(UserTeam.team_id).filter(
            UserTeam.user_id == current_user.id,
            UserTeam.is_active == True
        ).all()
        team_ids = [t.team_id for t in user_teams]
        if team_ids:
            query = query.filter(TeamPerformanceMetrics.team_id.in_(team_ids))
        else:
            return {"items": [], "total": 0}
    
    # Apply filters
    if team_id:
        query = query.filter(TeamPerformanceMetrics.team_id == team_id)
    if period_type:
        query = query.filter(TeamPerformanceMetrics.period_type == period_type)
    if start_date:
        query = query.filter(TeamPerformanceMetrics.metric_date >= start_date)
    if end_date:
        query = query.filter(TeamPerformanceMetrics.metric_date <= end_date)
    
    total = query.count()
    offset = (page - 1) * page_size
    
    metrics = query.order_by(
        TeamPerformanceMetrics.metric_date.desc()
    ).offset(offset).limit(page_size).all()
    
    # Enrich with team names and add productivity data
    result_items = []
    productivity_service = ProductivityService(db)
    
    for m in metrics:
        team = db.query(Team).filter(Team.id == m.team_id).first()
        item = serialize_team_metrics(m, team)
        
        # Add team productivity data for the same date
        try:
            productivity_data = productivity_service.calculate_team_productivity(
                team_id=m.team_id,
                start_date=m.metric_date,
                end_date=m.metric_date
            )
            if "error" not in productivity_data:
                item["teamProductivityScore"] = productivity_data.get("teamProductivityPercent")
                item["teamProductivityTarget"] = productivity_data.get("totalExpectedTarget")
        except Exception:
            item["teamProductivityScore"] = None
            item["teamProductivityTarget"] = None
        
        # Add average quality audit data for team members
        team_members = db.query(UserTeam).filter(
            UserTeam.team_id == m.team_id,
            UserTeam.is_active == True
        ).all()
        
        team_member_ids = [tm.user_id for tm in team_members]
        
        if team_member_ids:
            quality_audits = db.query(QualityAudit).filter(
                QualityAudit.examiner_id.in_(team_member_ids),
                QualityAudit.audit_date == m.metric_date,
                QualityAudit.deleted_at == None
            ).all()
            
            if quality_audits:
                fb_quality_scores = [qa.fb_quality for qa in quality_audits if qa.fb_quality is not None]
                ofe_quality_scores = [qa.ofe_quality for qa in quality_audits if qa.ofe_quality is not None]
                cce_quality_scores = [qa.cce_quality for qa in quality_audits if qa.cce_quality is not None]
                
                item["qualityFbScore"] = round(sum(fb_quality_scores) / len(fb_quality_scores) * 100, 2) if fb_quality_scores else None
                item["qualityOfeScore"] = round(sum(ofe_quality_scores) / len(ofe_quality_scores) * 100, 2) if ofe_quality_scores else None
                item["qualityCceScore"] = round(sum(cce_quality_scores) / len(cce_quality_scores) * 100, 2) if cce_quality_scores else None
                item["qualityAuditCount"] = len(quality_audits)
            else:
                item["qualityFbScore"] = None
                item["qualityOfeScore"] = None
                item["qualityCceScore"] = None
                item["qualityAuditCount"] = 0
        else:
            item["qualityFbScore"] = None
            item["qualityOfeScore"] = None
            item["qualityCceScore"] = None
            item["qualityAuditCount"] = 0
        
        result_items.append(item)
    
    return {"items": result_items, "total": total}


@router.get("/teams/{team_id}/summary")
async def get_team_metrics_summary(
    team_id: int,
    period_type: str = Query("monthly", description="Period type"),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get summarized metrics for a specific team"""
    team = db.query(Team).filter(Team.id == team_id).first()
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team not found")
    
    # Check access
    if current_user.user_role == ROLE_ADMIN:
        if team.org_id != current_user.org_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    elif current_user.user_role in [ROLE_TEAM_LEAD, ROLE_EMPLOYEE]:
        if not check_team_access(current_user, team_id, db):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    
    query = db.query(TeamPerformanceMetrics).filter(
        TeamPerformanceMetrics.team_id == team_id,
        TeamPerformanceMetrics.period_type == period_type,
        TeamPerformanceMetrics.deleted_at == None
    )
    
    if start_date:
        query = query.filter(TeamPerformanceMetrics.metric_date >= start_date)
    if end_date:
        query = query.filter(TeamPerformanceMetrics.metric_date <= end_date)
    
    metrics = query.order_by(TeamPerformanceMetrics.metric_date.desc()).limit(12).all()
    
    # Initialize services
    productivity_service = ProductivityService(db)
    
    # Build metrics response with productivity and quality data
    metrics_with_extras = []
    for m in metrics:
        metric_data = {
            "metricDate": m.metric_date.isoformat() if m.metric_date else None,
            "totalOrdersCompleted": m.total_orders_completed,
            "totalOrdersAssigned": m.total_orders_assigned,
            "activeEmployeesCount": m.active_employees_count,
            "completionRate": float(m.completion_rate) if m.completion_rate else None,
            "teamEfficiencyScore": float(m.team_efficiency_score) if m.team_efficiency_score else None
        }
        
        # Add team productivity data
        try:
            productivity_data = productivity_service.calculate_team_productivity(
                team_id=team_id,
                start_date=m.metric_date,
                end_date=m.metric_date
            )
            if "error" not in productivity_data:
                metric_data["teamProductivityScore"] = productivity_data.get("teamProductivityPercent")
                metric_data["teamProductivityTarget"] = productivity_data.get("totalExpectedTarget")
        except Exception:
            metric_data["teamProductivityScore"] = None
            metric_data["teamProductivityTarget"] = None
        
        # Add average quality audit data for team members
        team_members = db.query(UserTeam).filter(
            UserTeam.team_id == team_id,
            UserTeam.is_active == True
        ).all()
        
        team_member_ids = [tm.user_id for tm in team_members]
        
        if team_member_ids:
            quality_audits = db.query(QualityAudit).filter(
                QualityAudit.examiner_id.in_(team_member_ids),
                QualityAudit.audit_date == m.metric_date,
                QualityAudit.deleted_at == None
            ).all()
            
            if quality_audits:
                fb_quality_scores = [qa.fb_quality for qa in quality_audits if qa.fb_quality is not None]
                ofe_quality_scores = [qa.ofe_quality for qa in quality_audits if qa.ofe_quality is not None]
                cce_quality_scores = [qa.cce_quality for qa in quality_audits if qa.cce_quality is not None]
                
                metric_data["qualityFbScore"] = round(sum(fb_quality_scores) / len(fb_quality_scores) * 100, 2) if fb_quality_scores else None
                metric_data["qualityOfeScore"] = round(sum(ofe_quality_scores) / len(ofe_quality_scores) * 100, 2) if ofe_quality_scores else None
                metric_data["qualityCceScore"] = round(sum(cce_quality_scores) / len(cce_quality_scores) * 100, 2) if cce_quality_scores else None
            else:
                metric_data["qualityFbScore"] = None
                metric_data["qualityOfeScore"] = None
                metric_data["qualityCceScore"] = None
        else:
            metric_data["qualityFbScore"] = None
            metric_data["qualityOfeScore"] = None
            metric_data["qualityCceScore"] = None
        
        metrics_with_extras.append(metric_data)
    
    return {
        "teamId": team_id,
        "teamName": team.name,
        "periodType": period_type,
        "metrics": metrics_with_extras
    }
