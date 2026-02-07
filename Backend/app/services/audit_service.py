"""
Audit Service for centralized audit logging of all CUD operations.

This service provides:
- Automatic change detection between old and new entity states
- Standardized audit log creation
- Support for all entity types
- JSON serialization of complex objects
- Context tracking (user, IP, endpoint)
"""

from typing import Optional, Dict, Any, Type
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy.inspection import inspect
from decimal import Decimal
import json

from app.models.audit_log import AuditLog, AuditAction, AuditEntityType
from app.models.user import User


class AuditService:
    """
    Service for creating and managing audit logs.
    
    Usage:
        audit_service = AuditService(db)
        audit_service.log_create(
            entity=user_instance,
            entity_type="User",
            current_user=current_user,
            ip_address=request.client.host
        )
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def _serialize_value(self, value: Any) -> Any:
        """
        Convert a value to a JSON-serializable format.
        
        Args:
            value: The value to serialize
            
        Returns:
            JSON-serializable representation of the value
        """
        if value is None:
            return None
        elif isinstance(value, datetime):
            return value.isoformat()
        elif isinstance(value, Decimal):
            return float(value)
        elif isinstance(value, (str, int, float, bool)):
            return value
        elif isinstance(value, (list, tuple)):
            return [self._serialize_value(item) for item in value]
        elif isinstance(value, dict):
            return {k: self._serialize_value(v) for k, v in value.items()}
        elif hasattr(value, '__dict__'):
            # For SQLAlchemy objects, get their attributes
            return str(value)
        else:
            return str(value)
    
    def _get_entity_snapshot(self, entity: Any, exclude_fields: Optional[list] = None) -> Dict[str, Any]:
        """
        Create a JSON-serializable snapshot of an entity's current state.
        
        Args:
            entity: The SQLAlchemy model instance
            exclude_fields: List of field names to exclude from snapshot
            
        Returns:
            Dictionary of field names to serialized values
        """
        if exclude_fields is None:
            exclude_fields = ['password_hash', 'password', '_sa_instance_state']
        
        snapshot = {}
        
        # Get all columns using SQLAlchemy inspection
        mapper = inspect(entity.__class__)
        
        for column in mapper.columns:
            field_name = column.key
            
            # Skip excluded fields
            if field_name in exclude_fields:
                continue
            
            # Get the value
            try:
                value = getattr(entity, field_name, None)
                snapshot[field_name] = self._serialize_value(value)
            except Exception:
                # If we can't get the value, skip it
                continue
        
        return snapshot
    
    def _detect_changes(self, old_snapshot: Dict[str, Any], new_snapshot: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
        """
        Detect changes between two entity snapshots.
        
        Args:
            old_snapshot: Snapshot of entity before change
            new_snapshot: Snapshot of entity after change
            
        Returns:
            Dictionary of changed fields: {field_name: {old: value, new: value}}
        """
        changes = {}
        
        # Check all fields in new snapshot
        for field_name, new_value in new_snapshot.items():
            old_value = old_snapshot.get(field_name)
            
            # If values are different, record the change
            if old_value != new_value:
                changes[field_name] = {
                    "old": old_value,
                    "new": new_value
                }
        
        # Check for removed fields (present in old but not in new)
        for field_name in old_snapshot:
            if field_name not in new_snapshot:
                changes[field_name] = {
                    "old": old_snapshot[field_name],
                    "new": None
                }
        
        return changes
    
    def _get_entity_identifier(self, entity: Any) -> str:
        """
        Get a human-readable identifier for an entity.
        
        Args:
            entity: The SQLAlchemy model instance
            
        Returns:
            Human-readable string identifying the entity
        """
        # Try common name fields
        for field in ['user_name', 'username', 'name', 'email', 'title', 'org_name', 'team_name', 'employee_name']:
            if hasattr(entity, field):
                value = getattr(entity, field, None)
                if value:
                    return str(value)
        
        # Fallback to ID
        if hasattr(entity, 'id'):
            return f"ID: {getattr(entity, 'id')}"
        
        return "Unknown"
    
    def _get_entity_id(self, entity: Any) -> str:
        """Get the entity's ID as a string"""
        if hasattr(entity, 'id'):
            return str(getattr(entity, 'id'))
        return "unknown"
    
    def log_create(
        self,
        entity: Any,
        entity_type: str,
        current_user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        request_method: Optional[str] = "POST",
        description: Optional[str] = None,
        reason: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> AuditLog:
        """
        Log a CREATE operation.
        
        Args:
            entity: The created entity instance
            entity_type: Type of entity (User, Team, Order, etc.)
            current_user: User who performed the action
            ip_address: IP address of the request
            user_agent: User agent string
            endpoint: API endpoint that was called
            request_method: HTTP method (POST, PUT, etc.)
            description: Human-readable description of the action
            reason: Optional reason for the action
            organization_id: Organization ID for multi-tenant filtering
            
        Returns:
            Created AuditLog instance
        """
        snapshot = self._get_entity_snapshot(entity)
        
        audit_log = AuditLog(
            entity_type=entity_type,
            entity_id=self._get_entity_id(entity),
            entity_name=self._get_entity_identifier(entity),
            action=AuditAction.CREATE,
            changes=None,  # No changes for create
            old_values=None,  # No old values for create
            new_values=snapshot,
            user_id=current_user.id if current_user else None,
            username=current_user.user_name if current_user else "system",
            user_role=current_user.user_role if current_user else None,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_method=request_method,
            description=description or f"Created {entity_type}: {self._get_entity_identifier(entity)}",
            reason=reason,
            organization_id=organization_id or (current_user.org_id if current_user and hasattr(current_user, 'org_id') else None)
        )
        
        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(audit_log)
        
        return audit_log
    
    def log_update(
        self,
        entity: Any,
        entity_type: str,
        old_snapshot: Dict[str, Any],
        current_user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        request_method: Optional[str] = "PUT",
        description: Optional[str] = None,
        reason: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> Optional[AuditLog]:
        """
        Log an UPDATE operation.
        
        Args:
            entity: The updated entity instance (with new values)
            entity_type: Type of entity (User, Team, Order, etc.)
            old_snapshot: Snapshot of entity before the update
            current_user: User who performed the action
            ip_address: IP address of the request
            user_agent: User agent string
            endpoint: API endpoint that was called
            request_method: HTTP method (PUT, PATCH, etc.)
            description: Human-readable description of the action
            reason: Optional reason for the action
            organization_id: Organization ID for multi-tenant filtering
            
        Returns:
            Created AuditLog instance, or None if no changes detected
        """
        new_snapshot = self._get_entity_snapshot(entity)
        changes = self._detect_changes(old_snapshot, new_snapshot)
        
        # Don't log if there are no changes
        if not changes:
            return None
        
        audit_log = AuditLog(
            entity_type=entity_type,
            entity_id=self._get_entity_id(entity),
            entity_name=self._get_entity_identifier(entity),
            action=AuditAction.UPDATE,
            changes=changes,
            old_values=old_snapshot,
            new_values=new_snapshot,
            user_id=current_user.id if current_user else None,
            username=current_user.user_name if current_user else "system",
            user_role=current_user.user_role if current_user else None,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_method=request_method,
            description=description or f"Updated {entity_type}: {self._get_entity_identifier(entity)}",
            reason=reason,
            organization_id=organization_id or (current_user.org_id if current_user and hasattr(current_user, 'org_id') else None)
        )
        
        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(audit_log)
        
        return audit_log
    
    def log_delete(
        self,
        entity: Any,
        entity_type: str,
        current_user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        request_method: Optional[str] = "DELETE",
        description: Optional[str] = None,
        reason: Optional[str] = None,
        organization_id: Optional[int] = None,
        is_soft_delete: bool = True
    ) -> AuditLog:
        """
        Log a DELETE operation.
        
        Args:
            entity: The entity instance before deletion
            entity_type: Type of entity (User, Team, Order, etc.)
            current_user: User who performed the action
            ip_address: IP address of the request
            user_agent: User agent string
            endpoint: API endpoint that was called
            request_method: HTTP method (DELETE, etc.)
            description: Human-readable description of the action
            reason: Optional reason for the action
            organization_id: Organization ID for multi-tenant filtering
            is_soft_delete: Whether this is a soft delete (deactivation) or hard delete
            
        Returns:
            Created AuditLog instance
        """
        snapshot = self._get_entity_snapshot(entity)
        
        action = AuditAction.DEACTIVATE if is_soft_delete else AuditAction.DELETE
        
        audit_log = AuditLog(
            entity_type=entity_type,
            entity_id=self._get_entity_id(entity),
            entity_name=self._get_entity_identifier(entity),
            action=action,
            changes=None,
            old_values=snapshot,
            new_values=None,
            user_id=current_user.id if current_user else None,
            username=current_user.user_name if current_user else "system",
            user_role=current_user.user_role if current_user else None,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_method=request_method,
            description=description or f"{'Deactivated' if is_soft_delete else 'Deleted'} {entity_type}: {self._get_entity_identifier(entity)}",
            reason=reason,
            organization_id=organization_id or (current_user.org_id if current_user and hasattr(current_user, 'org_id') else None)
        )
        
        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(audit_log)
        
        return audit_log
    
    def log_custom_action(
        self,
        entity: Any,
        entity_type: str,
        action: str,
        current_user: Optional[User] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        endpoint: Optional[str] = None,
        request_method: Optional[str] = None,
        description: Optional[str] = None,
        reason: Optional[str] = None,
        organization_id: Optional[int] = None,
        old_values: Optional[Dict[str, Any]] = None,
        new_values: Optional[Dict[str, Any]] = None,
        changes: Optional[Dict[str, Dict[str, Any]]] = None
    ) -> AuditLog:
        """
        Log a custom action (restore, activate, lock, unlock, etc.).
        
        Args:
            entity: The entity instance
            entity_type: Type of entity (User, Team, Order, etc.)
            action: Custom action type (restore, activate, lock, unlock, etc.)
            current_user: User who performed the action
            ip_address: IP address of the request
            user_agent: User agent string
            endpoint: API endpoint that was called
            request_method: HTTP method
            description: Human-readable description of the action
            reason: Optional reason for the action
            organization_id: Organization ID for multi-tenant filtering
            old_values: Optional old values snapshot
            new_values: Optional new values snapshot
            changes: Optional changes dictionary
            
        Returns:
            Created AuditLog instance
        """
        audit_log = AuditLog(
            entity_type=entity_type,
            entity_id=self._get_entity_id(entity),
            entity_name=self._get_entity_identifier(entity),
            action=action,
            changes=changes,
            old_values=old_values,
            new_values=new_values,
            user_id=current_user.id if current_user else None,
            username=current_user.user_name if current_user else "system",
            user_role=current_user.user_role if current_user else None,
            ip_address=ip_address,
            user_agent=user_agent,
            endpoint=endpoint,
            request_method=request_method,
            description=description or f"{action.title()} {entity_type}: {self._get_entity_identifier(entity)}",
            reason=reason,
            organization_id=organization_id or (current_user.org_id if current_user and hasattr(current_user, 'org_id') else None)
        )
        
        self.db.add(audit_log)
        self.db.commit()
        self.db.refresh(audit_log)
        
        return audit_log
    
    def get_entity_audit_logs(
        self,
        entity_type: str,
        entity_id: str,
        limit: int = 100,
        offset: int = 0
    ) -> tuple[list[AuditLog], int]:
        """
        Get audit logs for a specific entity.
        
        Args:
            entity_type: Type of entity (User, Team, Order, etc.)
            entity_id: ID of the entity
            limit: Maximum number of records to return
            offset: Number of records to skip
            
        Returns:
            Tuple of (list of AuditLog instances, total count)
        """
        query = self.db.query(AuditLog).filter(
            AuditLog.entity_type == entity_type,
            AuditLog.entity_id == str(entity_id)
        ).order_by(AuditLog.created_at.desc())
        
        total = query.count()
        logs = query.limit(limit).offset(offset).all()
        
        return logs, total
    
    def get_user_audit_logs(
        self,
        user_id: int,
        limit: int = 100,
        offset: int = 0
    ) -> tuple[list[AuditLog], int]:
        """
        Get all actions performed by a specific user.
        
        Args:
            user_id: ID of the user
            limit: Maximum number of records to return
            offset: Number of records to skip
            
        Returns:
            Tuple of (list of AuditLog instances, total count)
        """
        query = self.db.query(AuditLog).filter(
            AuditLog.user_id == user_id
        ).order_by(AuditLog.created_at.desc())
        
        total = query.count()
        logs = query.limit(limit).offset(offset).all()
        
        return logs, total
    
    def get_recent_audit_logs(
        self,
        limit: int = 100,
        offset: int = 0,
        entity_type: Optional[str] = None,
        action: Optional[str] = None,
        organization_id: Optional[int] = None
    ) -> tuple[list[AuditLog], int]:
        """
        Get recent audit logs with optional filtering.
        
        Args:
            limit: Maximum number of records to return
            offset: Number of records to skip
            entity_type: Optional filter by entity type
            action: Optional filter by action type
            organization_id: Optional filter by organization
            
        Returns:
            Tuple of (list of AuditLog instances, total count)
        """
        query = self.db.query(AuditLog)
        
        if entity_type:
            query = query.filter(AuditLog.entity_type == entity_type)
        
        if action:
            query = query.filter(AuditLog.action == action)
        
        if organization_id:
            query = query.filter(AuditLog.organization_id == organization_id)
        
        query = query.order_by(AuditLog.created_at.desc())
        
        total = query.count()
        logs = query.limit(limit).offset(offset).all()
        
        return logs, total


# Helper function for easy access
def get_audit_service(db: Session) -> AuditService:
    """Get an instance of AuditService"""
    return AuditService(db)
