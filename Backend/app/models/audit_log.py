"""
Audit Log Model for tracking all CUD (Create, Update, Delete) operations
across all entities in the system.

This model provides:
- Centralized audit logging for all database entities
- Before/after snapshots of data changes
- User tracking (who made the change)
- Action type tracking (create/update/delete)
- Timestamp tracking (when the change occurred)
- IP address and user agent tracking
- Searchable and filterable audit trail
"""

from sqlalchemy import Column, Integer, String, DateTime, JSON, Text, Index, BigInteger
from sqlalchemy.sql import func
from app.database import Base


class AuditLog(Base):
    """
    Generic audit log table for tracking all CUD operations.
    
    Stores:
    - Entity information (type, ID)
    - Action type (create, update, delete, restore)
    - Before/after state (JSON snapshots)
    - User information (who made the change)
    - Context information (IP, user agent, endpoint)
    - Timestamp (when the change occurred)
    """
    __tablename__ = "audit_logs"
    
    # Primary key
    id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # Entity information
    entity_type = Column(String(100), nullable=False, index=True, comment="Type of entity (User, Team, Order, etc.)")
    entity_id = Column(String(100), nullable=False, index=True, comment="ID of the entity that was modified")
    entity_name = Column(String(255), nullable=True, comment="Human-readable name/identifier of the entity")
    
    # Action information
    action = Column(
        String(50), 
        nullable=False, 
        index=True,
        comment="Action performed: create, update, delete, restore, deactivate, activate"
    )
    
    # Change details
    changes = Column(JSON, nullable=True, comment="Dictionary of field changes: {field_name: {old: value, new: value}}")
    old_values = Column(JSON, nullable=True, comment="Complete snapshot of entity before change")
    new_values = Column(JSON, nullable=True, comment="Complete snapshot of entity after change")
    
    # User information
    user_id = Column(Integer, nullable=True, index=True, comment="ID of user who made the change (null for system)")
    username = Column(String(255), nullable=True, comment="Username of user who made the change")
    user_role = Column(String(50), nullable=True, comment="Role of user at time of change")
    
    # Context information
    ip_address = Column(String(45), nullable=True, comment="IP address of the request (IPv4 or IPv6)")
    user_agent = Column(Text, nullable=True, comment="User agent string from the request")
    endpoint = Column(String(255), nullable=True, comment="API endpoint that triggered the change")
    request_method = Column(String(10), nullable=True, comment="HTTP method (GET, POST, PUT, DELETE, PATCH)")
    
    # Additional metadata
    description = Column(Text, nullable=True, comment="Human-readable description of the change")
    reason = Column(Text, nullable=True, comment="Reason for the change (optional, provided by user)")
    
    # Timestamp
    created_at = Column(
        DateTime(timezone=True), 
        nullable=False, 
        server_default=func.now(),
        index=True,
        comment="When the change occurred"
    )
    
    # Organization context (for multi-tenant filtering)
    organization_id = Column(Integer, nullable=True, index=True, comment="Organization ID for multi-tenant filtering")
    
    # Indexes for common queries
    __table_args__ = (
        # Composite indexes for common query patterns
        Index('idx_audit_entity_action', 'entity_type', 'action'),
        Index('idx_audit_entity_id_created', 'entity_type', 'entity_id', 'created_at'),
        Index('idx_audit_user_created', 'user_id', 'created_at'),
        Index('idx_audit_org_created', 'organization_id', 'created_at'),
        Index('idx_audit_created_desc', 'created_at'),
        
        # For searching by entity
        Index('idx_audit_entity_lookup', 'entity_type', 'entity_id', 'action'),
    )
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, entity={self.entity_type}:{self.entity_id}, action={self.action}, user={self.username}, created_at={self.created_at})>"
    
    def to_dict(self):
        """Convert audit log to dictionary for API responses"""
        return {
            "id": self.id,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "entity_name": self.entity_name,
            "action": self.action,
            "changes": self.changes,
            "old_values": self.old_values,
            "new_values": self.new_values,
            "user_id": self.user_id,
            "username": self.username,
            "user_role": self.user_role,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "endpoint": self.endpoint,
            "request_method": self.request_method,
            "description": self.description,
            "reason": self.reason,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "organization_id": self.organization_id
        }


# Action types (enum for reference)
class AuditAction:
    """Standardized action types for audit logging"""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    RESTORE = "restore"
    DEACTIVATE = "deactivate"
    ACTIVATE = "activate"
    ASSIGN = "assign"
    UNASSIGN = "unassign"
    ADD_MEMBER = "add_member"
    REMOVE_MEMBER = "remove_member"
    CHANGE_ROLE = "change_role"
    CHANGE_PASSWORD = "change_password"
    LOGIN = "login"
    LOGOUT = "logout"
    FAILED_LOGIN = "failed_login"
    LOCK = "lock"
    UNLOCK = "unlock"
    BULK_UPDATE = "bulk_update"
    BULK_DELETE = "bulk_delete"
    IMPORT = "import"
    EXPORT = "export"


# Entity types (enum for reference)
class AuditEntityType:
    """Standardized entity types for audit logging"""
    USER = "User"
    TEAM = "Team"
    ORGANIZATION = "Organization"
    ORDER = "Order"
    QUALITY_AUDIT = "QualityAudit"
    BILLING = "Billing"
    TRANSACTION_TYPE = "TransactionType"
    PROCESS_TYPE = "ProcessType"
    ORDER_STATUS = "OrderStatus"
    DIVISION = "Division"
    EMPLOYEE_WEEKLY_TARGET = "EmployeeWeeklyTarget"
    PERFORMANCE_METRIC = "PerformanceMetric"
    TEAM_STATE = "TeamState"
    TEAM_PRODUCT = "TeamProduct"
    FA_NAME = "FAName"
