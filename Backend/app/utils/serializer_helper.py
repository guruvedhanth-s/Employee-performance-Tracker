"""
Serializer Helper Utility
Centralizes common serialization patterns for model-to-dict conversion.
Eliminates duplicate serialize_* functions across endpoints.
"""
from typing import Any, Dict, Optional, List
from datetime import datetime
import json


class SerializerHelper:
    """Common serialization utilities for model-to-dict conversion"""
    
    @staticmethod
    def to_camel_case(snake_str: str) -> str:
        """Convert snake_case to camelCase"""
        components = snake_str.split('_')
        return components[0] + ''.join(x.title() for x in components[1:])
    
    @staticmethod
    def serialize_datetime(dt: Optional[datetime]) -> Optional[str]:
        """Convert datetime to ISO format string"""
        return dt.isoformat() if dt else None
    
    @staticmethod
    def serialize_reference_object(obj: Any) -> Optional[Dict[str, Any]]:
        """
        Serialize a reference object (transaction type, order status, etc.)
        with id and name fields.
        """
        if not obj:
            return None
        return {
            "id": obj.id,
            "name": obj.name
        }
    
    @staticmethod
    def serialize_with_relationships(
        obj: Any,
        field_mappings: Dict[str, tuple[str, Optional[callable]]]
    ) -> Dict[str, Any]:
        """
        Generic serializer for models with custom field mappings.
        
        Args:
            obj: Model instance to serialize
            field_mappings: Dict mapping output_key -> (attribute_name, transform_func)
                           transform_func is optional converter (e.g., lambda x: x.isoformat())
                           
        Returns:
            Serialized dictionary with camelCase keys
            
        Example:
            mappings = {
                "id": ("id", None),
                "fileName": ("file_number", None),
                "entryDate": ("entry_date", lambda x: x.isoformat() if x else None),
                "createdAt": ("created_at", lambda x: x.isoformat() if x else None),
            }
            result = SerializerHelper.serialize_with_relationships(order, mappings)
        """
        result = {}
        for output_key, (attr_name, transform_func) in field_mappings.items():
            value = getattr(obj, attr_name, None)
            if transform_func:
                value = transform_func(value)
            result[output_key] = value
        return result
    
    @staticmethod
    def serialize_model_list(
        items: List[Any],
        field_mappings: Dict[str, tuple[str, Optional[callable]]]
    ) -> List[Dict[str, Any]]:
        """
        Serialize a list of models using the same field mappings.
        
        Args:
            items: List of model instances
            field_mappings: Same format as serialize_with_relationships
            
        Returns:
            List of serialized dictionaries
        """
        return [
            SerializerHelper.serialize_with_relationships(item, field_mappings)
            for item in items
        ]
    
    # ============ Domain-Specific Serializers ============
    
    @staticmethod
    def serialize_user_basic(user: Any) -> Dict[str, Any]:
        """Serialize user with basic fields"""
        return {
            "id": user.id,
            "userName": user.user_name,
            "employeeId": user.employee_id,
            "userRole": user.user_role,
            "orgId": user.org_id,
            "isActive": user.is_active,
            "lastLogin": SerializerHelper.serialize_datetime(user.last_login),
            "createdAt": SerializerHelper.serialize_datetime(user.created_at),
        }
    
    @staticmethod
    def serialize_user_full(user: Any) -> Dict[str, Any]:
        """Serialize user with full details"""
        return {
            "id": user.id,
            "userName": user.user_name,
            "employeeId": user.employee_id,
            "userRole": user.user_role,
            "orgId": user.org_id,
            "passwordLastChanged": SerializerHelper.serialize_datetime(user.password_last_changed),
            "mustChangePassword": user.must_change_password if user.must_change_password else False,
            "lastLogin": SerializerHelper.serialize_datetime(user.last_login),
            "isActive": user.is_active,
            "createdAt": SerializerHelper.serialize_datetime(user.created_at),
            "modifiedAt": SerializerHelper.serialize_datetime(user.modified_at),
            "deactivatedAt": SerializerHelper.serialize_datetime(user.deactivated_at),
        }
    
    @staticmethod
    def serialize_team_membership(user_team: Any, team: Any) -> Dict[str, Any]:
        """Serialize user-team membership relationship"""
        return {
            "teamId": user_team.team_id,
            "teamName": team.name,
            "role": user_team.role,
            "joinedAt": SerializerHelper.serialize_datetime(user_team.joined_at),
            "leftAt": SerializerHelper.serialize_datetime(user_team.left_at),
            "isActive": user_team.is_active,
            "teamIsActive": team.is_active,
        }
    
    @staticmethod
    def serialize_order_step_info(order: Any, step_num: int) -> Optional[Dict[str, Any]]:
        """
        Serialize step information from an order.
        
        Args:
            order: Order model instance
            step_num: 1 or 2 for which step to serialize
            
        Returns:
            Serialized step dict or None if step not assigned
        """
        if step_num == 1:
            user_id = order.step1_user_id
            user = order.step1_user if hasattr(order, 'step1_user') else None
            fa_name_obj = order.step1_fa_name if hasattr(order, 'step1_fa_name') else None
            start_time = order.step1_start_time
            end_time = order.step1_end_time
        elif step_num == 2:
            user_id = order.step2_user_id
            user = order.step2_user if hasattr(order, 'step2_user') else None
            fa_name_obj = order.step2_fa_name if hasattr(order, 'step2_fa_name') else None
            start_time = order.step2_start_time
            end_time = order.step2_end_time
        else:
            return None
        
        if not user_id:
            return None
        
        return {
            "userId": user_id,
            "userName": user.user_name if user else None,
            "faName": fa_name_obj.name if fa_name_obj else None,
            "startTime": start_time.isoformat() if start_time else None,
            "endTime": end_time.isoformat() if end_time else None,
        }
    
    @staticmethod
    def serialize_metrics_response(
        total_orders: int,
        orders_completed: int,
        orders_on_hold: int,
        orders_bp_rti: int,
        orders_pending_billing: int,
        total_employees: int,
        active_employees: int,
        total_teams: int,
        avg_completion_time_minutes: Optional[int] = None
    ) -> Dict[str, Any]:
        """Serialize dashboard metrics response"""
        return {
            "totalOrders": total_orders,
            "ordersCompleted": orders_completed,
            "ordersOnHold": orders_on_hold,
            "ordersBpRti": orders_bp_rti,
            "ordersPendingBilling": orders_pending_billing,
            "totalEmployees": total_employees,
            "activeEmployees": active_employees,
            "totalTeams": total_teams,
            "avgCompletionTimeMinutes": avg_completion_time_minutes,
        }
    
    @staticmethod
    def serialize_employee_metrics(metrics: Any, user: Optional[Any] = None, team: Optional[Any] = None) -> Dict[str, Any]:
        """Serialize employee performance metrics"""
        return {
            "id": metrics.id,
            "userId": metrics.user_id,
            "teamId": metrics.team_id,
            "orgId": metrics.org_id,
            "metricDate": SerializerHelper.serialize_datetime(metrics.metric_date),
            "periodType": metrics.period_type,
            "totalOrdersAssigned": metrics.total_orders_assigned,
            "totalStep1Completed": metrics.total_step1_completed,
            "totalStep2Completed": metrics.total_step2_completed,
            "totalSingleSeatCompleted": metrics.total_single_seat_completed,
            "totalOrdersCompleted": metrics.total_orders_completed,
            "totalWorkingMinutes": metrics.total_working_minutes,
            "avgStep1DurationMinutes": metrics.avg_step1_duration_minutes,
            "avgStep2DurationMinutes": metrics.avg_step2_duration_minutes,
            "avgOrderCompletionMinutes": metrics.avg_order_completion_minutes,
            "ordersOnHold": metrics.orders_on_hold,
            "ordersCompleted": metrics.orders_completed,
            "ordersBpRti": metrics.orders_bp_rti,
            "efficiencyScore": float(metrics.efficiency_score) if metrics.efficiency_score else None,
            "qualityScore": float(metrics.quality_score) if metrics.quality_score else None,
            "calculationStatus": metrics.calculation_status,
            "createdAt": SerializerHelper.serialize_datetime(metrics.created_at),
            "modifiedAt": SerializerHelper.serialize_datetime(metrics.modified_at),
            "userName": user.user_name if user else None,
            "teamName": team.name if team else None,
        }
    
    @staticmethod
    def serialize_team_metrics(metrics: Any, team: Optional[Any] = None) -> Dict[str, Any]:
        """Serialize team performance metrics"""
        transaction_breakdown = json.loads(metrics.transaction_breakdown) if metrics.transaction_breakdown else None
        product_breakdown = json.loads(metrics.product_breakdown) if metrics.product_breakdown else None
        state_breakdown = json.loads(metrics.state_breakdown) if metrics.state_breakdown else None
        
        return {
            "id": metrics.id,
            "teamId": metrics.team_id,
            "orgId": metrics.org_id,
            "metricDate": SerializerHelper.serialize_datetime(metrics.metric_date),
            "periodType": metrics.period_type,
            "totalOrdersAssigned": metrics.total_orders_assigned,
            "totalOrdersCompleted": metrics.total_orders_completed,
            "totalOrdersInProgress": metrics.total_orders_in_progress,
            "totalOrdersOnHold": metrics.total_orders_on_hold,
            "totalOrdersBpRti": metrics.total_orders_bp_rti,
            "totalTeamWorkingMinutes": metrics.total_team_working_minutes,
            "avgOrderCompletionMinutes": metrics.avg_order_completion_minutes,
            "activeEmployeesCount": metrics.active_employees_count,
            "teamEfficiencyScore": float(metrics.team_efficiency_score) if metrics.team_efficiency_score else None,
            "ordersPerEmployee": float(metrics.orders_per_employee) if metrics.orders_per_employee else None,
            "completionRate": float(metrics.completion_rate) if metrics.completion_rate else None,
            "transactionBreakdown": transaction_breakdown,
            "productBreakdown": product_breakdown,
            "stateBreakdown": state_breakdown,
            "calculationStatus": metrics.calculation_status,
            "createdAt": SerializerHelper.serialize_datetime(metrics.created_at),
            "modifiedAt": SerializerHelper.serialize_datetime(metrics.modified_at),
            "teamName": team.name if team else None,
        }
