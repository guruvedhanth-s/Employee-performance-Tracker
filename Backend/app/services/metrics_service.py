"""
Metrics Service
Business logic for calculating and storing performance metrics
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import date, datetime, timedelta
from typing import Optional, Dict, List, Any
import json
from app.models.order import Order
from app.models.user import User
from app.models.team import Team
from app.models.user_team import UserTeam
from app.models.metrics import EmployeePerformanceMetrics, TeamPerformanceMetrics
from app.models.reference import OrderStatusType


class MetricsService:
    """Service for calculating and storing performance metrics"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_status_id(self, status_name: str) -> Optional[int]:
        """Get order status ID by name"""
        status = self.db.query(OrderStatusType).filter(
            OrderStatusType.name == status_name
        ).first()
        return status.id if status else None
    
    def calculate_employee_daily_metrics(
        self,
        user_id: int,
        metric_date: date,
        team_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Calculate daily metrics for an employee"""
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {}
        
        # Build date range
        start_of_day = datetime.combine(metric_date, datetime.min.time())
        end_of_day = datetime.combine(metric_date, datetime.max.time())
        
        # Base query for orders where user worked
        base_query = self.db.query(Order).filter(
            Order.deleted_at == None,
            or_(
                Order.step1_user_id == user_id,
                Order.step2_user_id == user_id
            )
        )
        
        if team_id:
            base_query = base_query.filter(Order.team_id == team_id)
        
        # Step 1 completions
        step1_completed = base_query.filter(
            Order.step1_user_id == user_id,
            Order.step1_end_time >= start_of_day,
            Order.step1_end_time <= end_of_day
        ).count()
        
        # Step 2 completions
        step2_completed = base_query.filter(
            Order.step2_user_id == user_id,
            Order.step2_end_time >= start_of_day,
            Order.step2_end_time <= end_of_day
        ).count()
        
        # Single seat completions (user did both steps)
        single_seat_completed = base_query.filter(
            Order.step1_user_id == user_id,
            Order.step2_user_id == user_id,
            Order.step2_end_time >= start_of_day,
            Order.step2_end_time <= end_of_day
        ).count()
        
        # Total working minutes (sum of step durations)
        total_minutes = 0
        
        # Step 1 durations
        step1_orders = base_query.filter(
            Order.step1_user_id == user_id,
            Order.step1_start_time != None,
            Order.step1_end_time != None,
            Order.step1_end_time >= start_of_day,
            Order.step1_end_time <= end_of_day
        ).all()
        
        step1_durations = []
        for order in step1_orders:
            duration = (order.step1_end_time - order.step1_start_time).total_seconds() / 60
            total_minutes += int(duration)
            step1_durations.append(duration)
        
        # Step 2 durations
        step2_orders = base_query.filter(
            Order.step2_user_id == user_id,
            Order.step2_start_time != None,
            Order.step2_end_time != None,
            Order.step2_end_time >= start_of_day,
            Order.step2_end_time <= end_of_day
        ).all()
        
        step2_durations = []
        for order in step2_orders:
            duration = (order.step2_end_time - order.step2_start_time).total_seconds() / 60
            total_minutes += int(duration)
            step2_durations.append(duration)
        
        # Status counts
        completed_id = self.get_status_id("Completed")
        on_hold_id = self.get_status_id("On-hold")
        bp_rti_id = self.get_status_id("BP and RTI")
        
        orders_completed = base_query.filter(
            Order.order_status_id == completed_id
        ).count() if completed_id else 0
        
        orders_on_hold = base_query.filter(
            Order.order_status_id == on_hold_id
        ).count() if on_hold_id else 0
        
        orders_bp_rti = base_query.filter(
            Order.order_status_id == bp_rti_id
        ).count() if bp_rti_id else 0
        
        return {
            "user_id": user_id,
            "team_id": team_id,
            "org_id": user.org_id,
            "metric_date": metric_date,
            "period_type": "daily",
            "total_orders_assigned": step1_completed + step2_completed - single_seat_completed,
            "total_step1_completed": step1_completed,
            "total_step2_completed": step2_completed,
            "total_single_seat_completed": single_seat_completed,
            "total_orders_completed": step1_completed + step2_completed - single_seat_completed,
            "total_working_minutes": total_minutes,
            "avg_step1_duration_minutes": int(sum(step1_durations) / len(step1_durations)) if step1_durations else None,
            "avg_step2_duration_minutes": int(sum(step2_durations) / len(step2_durations)) if step2_durations else None,
            "orders_on_hold": orders_on_hold,
            "orders_completed": orders_completed,
            "orders_bp_rti": orders_bp_rti,
            "calculation_status": "calculated"
        }
    
    def calculate_team_daily_metrics(
        self,
        team_id: int,
        metric_date: date
    ) -> Dict[str, Any]:
        """Calculate daily metrics for a team"""
        team = self.db.query(Team).filter(Team.id == team_id).first()
        if not team:
            return {}
        
        # Build date range
        start_of_day = datetime.combine(metric_date, datetime.min.time())
        end_of_day = datetime.combine(metric_date, datetime.max.time())
        
        # Orders for this team
        base_query = self.db.query(Order).filter(
            Order.team_id == team_id,
            Order.deleted_at == None
        )
        
        # Total orders
        total_orders = base_query.filter(
            Order.entry_date == metric_date
        ).count()
        
        # Status counts
        completed_id = self.get_status_id("Completed")
        on_hold_id = self.get_status_id("On-hold")
        bp_rti_id = self.get_status_id("BP and RTI")
        
        completed = base_query.filter(
            Order.order_status_id == completed_id,
            Order.entry_date == metric_date
        ).count() if completed_id else 0
        
        on_hold = base_query.filter(
            Order.order_status_id == on_hold_id
        ).count() if on_hold_id else 0
        
        bp_rti = base_query.filter(
            Order.order_status_id == bp_rti_id
        ).count() if bp_rti_id else 0
        
        # In progress (not completed, not on hold, not bp_rti)
        in_progress = base_query.filter(
            Order.order_status_id.notin_([
                s for s in [completed_id, on_hold_id, bp_rti_id] if s
            ])
        ).count()
        
        # Active employees in team
        active_employees = self.db.query(UserTeam).filter(
            UserTeam.team_id == team_id,
            UserTeam.is_active == True
        ).count()
        
        # Completion rate
        completion_rate = None
        if total_orders > 0:
            completion_rate = (completed / total_orders) * 100
        
        # Orders per employee
        orders_per_emp = None
        if active_employees > 0:
            orders_per_emp = completed / active_employees
        
        return {
            "team_id": team_id,
            "org_id": team.org_id,
            "metric_date": metric_date,
            "period_type": "daily",
            "total_orders_assigned": total_orders,
            "total_orders_completed": completed,
            "total_orders_in_progress": in_progress,
            "total_orders_on_hold": on_hold,
            "total_orders_bp_rti": bp_rti,
            "active_employees_count": active_employees,
            "completion_rate": completion_rate,
            "orders_per_employee": orders_per_emp,
            "calculation_status": "calculated"
        }
    
    def save_employee_metrics(self, metrics_data: Dict[str, Any]) -> EmployeePerformanceMetrics:
        """Save or update employee metrics"""
        existing = self.db.query(EmployeePerformanceMetrics).filter(
            EmployeePerformanceMetrics.user_id == metrics_data["user_id"],
            EmployeePerformanceMetrics.metric_date == metrics_data["metric_date"],
            EmployeePerformanceMetrics.period_type == metrics_data["period_type"]
        ).first()
        
        if existing:
            for key, value in metrics_data.items():
                setattr(existing, key, value)
            self.db.commit()
            return existing
        
        metrics = EmployeePerformanceMetrics(**metrics_data)
        self.db.add(metrics)
        self.db.commit()
        self.db.refresh(metrics)
        return metrics
    
    def save_team_metrics(self, metrics_data: Dict[str, Any]) -> TeamPerformanceMetrics:
        """Save or update team metrics"""
        existing = self.db.query(TeamPerformanceMetrics).filter(
            TeamPerformanceMetrics.team_id == metrics_data["team_id"],
            TeamPerformanceMetrics.metric_date == metrics_data["metric_date"],
            TeamPerformanceMetrics.period_type == metrics_data["period_type"]
        ).first()
        
        if existing:
            for key, value in metrics_data.items():
                setattr(existing, key, value)
            self.db.commit()
            return existing
        
        metrics = TeamPerformanceMetrics(**metrics_data)
        self.db.add(metrics)
        self.db.commit()
        self.db.refresh(metrics)
        return metrics
