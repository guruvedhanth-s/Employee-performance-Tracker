"""
Performance Metrics Schemas
Pydantic schemas for employee and team performance metrics
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from decimal import Decimal


# ============ Employee Performance Metrics Schemas ============
class EmployeeMetricsBase(BaseModel):
    user_id: int = Field(..., alias="userId")
    team_id: Optional[int] = Field(None, alias="teamId")
    org_id: int = Field(..., alias="orgId")
    metric_date: date = Field(..., alias="metricDate")
    period_type: str = Field(..., alias="periodType")  # daily, weekly, monthly


class EmployeeMetricsCreate(EmployeeMetricsBase):
    total_orders_assigned: int = Field(0, alias="totalOrdersAssigned")
    total_step1_completed: int = Field(0, alias="totalStep1Completed")
    total_step2_completed: int = Field(0, alias="totalStep2Completed")
    total_single_seat_completed: int = Field(0, alias="totalSingleSeatCompleted")
    total_orders_completed: int = Field(0, alias="totalOrdersCompleted")
    total_working_minutes: int = Field(0, alias="totalWorkingMinutes")
    avg_step1_duration_minutes: Optional[int] = Field(None, alias="avgStep1DurationMinutes")
    avg_step2_duration_minutes: Optional[int] = Field(None, alias="avgStep2DurationMinutes")
    avg_order_completion_minutes: Optional[int] = Field(None, alias="avgOrderCompletionMinutes")
    orders_on_hold: int = Field(0, alias="ordersOnHold")
    orders_completed: int = Field(0, alias="ordersCompleted")
    orders_bp_rti: int = Field(0, alias="ordersBpRti")
    efficiency_score: Optional[Decimal] = Field(None, alias="efficiencyScore")
    quality_score: Optional[Decimal] = Field(None, alias="qualityScore")


class EmployeeMetricsResponse(EmployeeMetricsBase):
    id: int
    total_orders_assigned: int = Field(..., alias="totalOrdersAssigned")
    total_step1_completed: int = Field(..., alias="totalStep1Completed")
    total_step2_completed: int = Field(..., alias="totalStep2Completed")
    total_single_seat_completed: int = Field(..., alias="totalSingleSeatCompleted")
    total_orders_completed: int = Field(..., alias="totalOrdersCompleted")
    total_working_minutes: int = Field(..., alias="totalWorkingMinutes")
    avg_step1_duration_minutes: Optional[int] = Field(None, alias="avgStep1DurationMinutes")
    avg_step2_duration_minutes: Optional[int] = Field(None, alias="avgStep2DurationMinutes")
    avg_order_completion_minutes: Optional[int] = Field(None, alias="avgOrderCompletionMinutes")
    orders_on_hold: int = Field(..., alias="ordersOnHold")
    orders_completed: int = Field(..., alias="ordersCompleted")
    orders_bp_rti: int = Field(..., alias="ordersBpRti")
    efficiency_score: Optional[float] = Field(None, alias="efficiencyScore")
    quality_score: Optional[float] = Field(None, alias="qualityScore")
    calculation_status: str = Field(..., alias="calculationStatus")
    created_at: datetime = Field(..., alias="createdAt")
    modified_at: datetime = Field(..., alias="modifiedAt")
    
    # Enriched data
    user_name: Optional[str] = Field(None, alias="userName")
    team_name: Optional[str] = Field(None, alias="teamName")

    class Config:
        from_attributes = True
        populate_by_name = True


class EmployeeMetricsListResponse(BaseModel):
    items: List[EmployeeMetricsResponse]
    total: int


# ============ Team Performance Metrics Schemas ============
class TeamMetricsBase(BaseModel):
    team_id: int = Field(..., alias="teamId")
    org_id: int = Field(..., alias="orgId")
    metric_date: date = Field(..., alias="metricDate")
    period_type: str = Field(..., alias="periodType")  # daily, weekly, monthly


class TeamMetricsCreate(TeamMetricsBase):
    total_orders_assigned: int = Field(0, alias="totalOrdersAssigned")
    total_orders_completed: int = Field(0, alias="totalOrdersCompleted")
    total_orders_in_progress: int = Field(0, alias="totalOrdersInProgress")
    total_orders_on_hold: int = Field(0, alias="totalOrdersOnHold")
    total_orders_bp_rti: int = Field(0, alias="totalOrdersBpRti")
    total_team_working_minutes: int = Field(0, alias="totalTeamWorkingMinutes")
    avg_order_completion_minutes: Optional[int] = Field(None, alias="avgOrderCompletionMinutes")
    active_employees_count: int = Field(0, alias="activeEmployeesCount")
    team_efficiency_score: Optional[Decimal] = Field(None, alias="teamEfficiencyScore")
    orders_per_employee: Optional[Decimal] = Field(None, alias="ordersPerEmployee")
    completion_rate: Optional[Decimal] = Field(None, alias="completionRate")
    transaction_breakdown: Optional[str] = Field(None, alias="transactionBreakdown")
    product_breakdown: Optional[str] = Field(None, alias="productBreakdown")
    state_breakdown: Optional[str] = Field(None, alias="stateBreakdown")


class TeamMetricsResponse(TeamMetricsBase):
    id: int
    total_orders_assigned: int = Field(..., alias="totalOrdersAssigned")
    total_orders_completed: int = Field(..., alias="totalOrdersCompleted")
    total_orders_in_progress: int = Field(..., alias="totalOrdersInProgress")
    total_orders_on_hold: int = Field(..., alias="totalOrdersOnHold")
    total_orders_bp_rti: int = Field(..., alias="totalOrdersBpRti")
    total_team_working_minutes: int = Field(..., alias="totalTeamWorkingMinutes")
    avg_order_completion_minutes: Optional[int] = Field(None, alias="avgOrderCompletionMinutes")
    active_employees_count: int = Field(..., alias="activeEmployeesCount")
    team_efficiency_score: Optional[float] = Field(None, alias="teamEfficiencyScore")
    orders_per_employee: Optional[float] = Field(None, alias="ordersPerEmployee")
    completion_rate: Optional[float] = Field(None, alias="completionRate")
    transaction_breakdown: Optional[Dict[str, Any]] = Field(None, alias="transactionBreakdown")
    product_breakdown: Optional[Dict[str, Any]] = Field(None, alias="productBreakdown")
    state_breakdown: Optional[Dict[str, Any]] = Field(None, alias="stateBreakdown")
    calculation_status: str = Field(..., alias="calculationStatus")
    created_at: datetime = Field(..., alias="createdAt")
    modified_at: datetime = Field(..., alias="modifiedAt")
    
    # Enriched data
    team_name: Optional[str] = Field(None, alias="teamName")

    class Config:
        from_attributes = True
        populate_by_name = True


class TeamMetricsListResponse(BaseModel):
    items: List[TeamMetricsResponse]
    total: int


# ============ Dashboard Metrics Schemas ============
class DashboardStats(BaseModel):
    """Dashboard statistics overview"""
    total_orders: int = Field(..., alias="totalOrders")
    orders_completed: int = Field(..., alias="ordersCompleted")
    orders_on_hold: int = Field(..., alias="ordersOnHold")
    orders_bp_rti: int = Field(..., alias="ordersBpRti")
    orders_pending_billing: int = Field(..., alias="ordersPendingBilling")
    total_employees: int = Field(..., alias="totalEmployees")
    active_employees: int = Field(..., alias="activeEmployees")
    total_teams: int = Field(..., alias="totalTeams")
    avg_completion_time_minutes: Optional[int] = Field(None, alias="avgCompletionTimeMinutes")

    class Config:
        populate_by_name = True


class MetricsFilterParams(BaseModel):
    """Filter parameters for metrics queries"""
    org_id: Optional[int] = Field(None, alias="orgId")
    team_id: Optional[int] = Field(None, alias="teamId")
    user_id: Optional[int] = Field(None, alias="userId")
    period_type: Optional[str] = Field(None, alias="periodType")
    start_date: Optional[date] = Field(None, alias="startDate")
    end_date: Optional[date] = Field(None, alias="endDate")
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=100, alias="pageSize")

    class Config:
        populate_by_name = True
