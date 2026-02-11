"""
Orders API Routes
CRUD operations for order management with step-based workflow
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_
from typing import List, Optional
from datetime import date, datetime
from app.database import get_db
from app.core.dependencies import (
    get_current_active_user, require_admin, require_team_lead,
    check_org_access, check_team_access, get_user_teams,
    ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD, ROLE_EMPLOYEE
)
from app.models.user import User
from app.models.order import Order
from app.models.order_history import OrderHistory
from app.models.team import Team
from app.models.user_team import UserTeam
from app.schemas.order import OrderCreate, OrderUpdate
from app.services.cache_service import cache

router = APIRouter()


# ============ Serializer Functions ============

def serialize_step_info(order, step_num: int) -> Optional[dict]:
    """Serialize step information to camelCase dict"""
    if step_num == 1:
        user_id = order.step1_user_id
        user = order.step1_user if hasattr(order, 'step1_user') else None
        fa_name_obj = order.step1_fa_name if hasattr(order, 'step1_fa_name') else None
        fa_name = fa_name_obj.name if fa_name_obj else None
        start_time = order.step1_start_time
        end_time = order.step1_end_time
    else:
        user_id = order.step2_user_id
        user = order.step2_user if hasattr(order, 'step2_user') else None
        fa_name_obj = order.step2_fa_name if hasattr(order, 'step2_fa_name') else None
        fa_name = fa_name_obj.name if fa_name_obj else None
        start_time = order.step2_start_time
        end_time = order.step2_end_time
    
    if not user_id:
        return None
    
    return {
        "userId": user_id,
        "userName": user.user_name if user else None,
        "faName": fa_name,
        "startTime": start_time.isoformat() if start_time else None,
        "endTime": end_time.isoformat() if end_time else None
    }


def serialize_reference_type(ref_obj) -> Optional[dict]:
    """Serialize reference type (transaction type, process type, etc.) to dict"""
    if not ref_obj:
        return None
    return {
        "id": ref_obj.id,
        "name": ref_obj.name
    }


def serialize_order(order: Order, include_steps: bool = True) -> dict:
    """Serialize order to camelCase dict"""
    # Get the process type name for display
    effective_process_type_name = order.process_type.name if order.process_type else "Unknown"
    
    # Create a modified process type object for display
    process_type_display = None
    if hasattr(order, 'process_type') and order.process_type:
        process_type_display = {
            "id": order.process_type.id,
            "name": effective_process_type_name  # Use effective name instead of original
        }
    
    result = {
        "id": order.id,
        "fileNumber": order.file_number,
        "entryDate": order.entry_date.isoformat() if order.entry_date else None,
        "transactionTypeId": order.transaction_type_id,
        "transactionType": serialize_reference_type(order.transaction_type) if hasattr(order, 'transaction_type') else None,
        "processTypeId": order.process_type_id,
        "processType": process_type_display,  # Use the modified process type with effective name
        "orderStatusId": order.order_status_id,
        "orderStatus": serialize_reference_type(order.order_status) if hasattr(order, 'order_status') else None,
        "divisionId": order.division_id,
        "division": serialize_reference_type(order.division) if hasattr(order, 'division') else None,
        "state": order.state,
        "county": order.county,
        "productType": order.product_type,
        "teamId": order.team_id,
        "orgId": order.org_id,
        "billingStatus": order.billing_status,
        "createdBy": order.created_by,
        "modifiedBy": order.modified_by,
        "createdAt": order.created_at.isoformat() if order.created_at else None,
        "modifiedAt": order.modified_at.isoformat() if order.modified_at else None,
        "deletedAt": order.deleted_at.isoformat() if order.deleted_at else None,
        "deletedBy": order.deleted_by
    }
    
    if include_steps:
        result["step1"] = serialize_step_info(order, 1)
        result["step2"] = serialize_step_info(order, 2)
    
    return result


def serialize_simple_order(order: Order) -> dict:
    """Serialize order to simplified camelCase dict for lists"""
    # Get the process type name for display
    effective_process_type_name = order.process_type.name if order.process_type else "Unknown"
    
    return {
        "id": order.id,
        "fileNumber": order.file_number,
        "entryDate": order.entry_date.isoformat() if order.entry_date else None,
        "state": order.state,
        "county": order.county,
        "productType": order.product_type,
        "transactionTypeName": order.transaction_type.name if order.transaction_type else None,
        "processTypeName": effective_process_type_name,  # Use effective name instead of original
        "orderStatusName": order.order_status.name if order.order_status else None,
        "divisionName": order.division.name if order.division else None,
        "teamId": order.team_id,
        "billingStatus": order.billing_status,
        "createdAt": order.created_at.isoformat() if order.created_at else None,
        "modifiedAt": order.modified_at.isoformat() if order.modified_at else None,
        # Step user IDs for productivity calculation
        "step1UserId": order.step1_user_id,
        "step2UserId": order.step2_user_id
    }


def serialize_order_history(h: OrderHistory) -> dict:
    """Serialize order history to camelCase dict"""
    return {
        "id": h.id,
        "orderId": h.order_id,
        "changedBy": h.changed_by,
        "changedByName": h.changed_by_user.user_name if h.changed_by_user else None,
        "fieldName": h.field_name,
        "oldValue": h.old_value,
        "newValue": h.new_value,
        "changeType": h.change_type,
        "changedAt": h.changed_at.isoformat() if h.changed_at else None
    }


def log_order_change(
    db: Session,
    order_id: int,
    changed_by: int,
    field_name: str,
    old_value: Optional[str],
    new_value: Optional[str],
    change_type: str
):
    """Log a change to the order history"""
    history = OrderHistory(
        order_id=order_id,
        changed_by=changed_by,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value,
        change_type=change_type
    )
    db.add(history)


def validate_user_for_step_assignment(
    db: Session,
    user_id: int,
    team_id: int,
    step_name: str
) -> None:
    """
    Validate that a user can be assigned to an order step.
    Checks:
    1. User exists
    2. User is globally active (not resigned/deactivated from the system)
    3. User is an active member of the specific team (team-level membership status)
    
    Note: A user can be inactive in one team but active in others.
    The team membership tracks join/leave dates for historical records.
    
    Raises HTTPException if validation fails.
    """
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User with ID {user_id} not found for {step_name}"
        )
    
    # Check if user is globally active (not resigned from company)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign user '{user.user_name}' to {step_name}. User has resigned or been deactivated from the system."
        )
    
    # Check if user is an active member of this specific team
    # A user can be removed from one team but still active in others
    user_team = db.query(UserTeam).filter(
        UserTeam.user_id == user_id,
        UserTeam.team_id == team_id
    ).first()
    
    if not user_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign user '{user.user_name}' to {step_name}. User has never been a member of this team."
        )
    
    if not user_team.is_active:
        # User was removed from this specific team
        left_date = user_team.left_at.strftime("%Y-%m-%d") if user_team.left_at else "unknown date"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot assign user '{user.user_name}' to {step_name}. User was removed from this team on {left_date}."
        )


# ============ Routes ============

@router.get("")
async def list_orders(
    org_id: Optional[int] = Query(None, alias="orgId", description="Filter by organization"),
    team_id: Optional[int] = Query(None, alias="teamId", description="Filter by team"),
    order_status_id: Optional[int] = Query(None, alias="orderStatusId", description="Filter by status"),
    step1_user_id: Optional[int] = Query(None, alias="step1UserId", description="Filter by step1 user"),
    step2_user_id: Optional[int] = Query(None, alias="step2UserId", description="Filter by step2 user"),
    my_orders: bool = Query(False, alias="myOrders", description="Filter orders where current user worked on step1 OR step2"),
    process_type_id: Optional[int] = Query(None, alias="processTypeId", description="Filter by process type"),
    division_id: Optional[int] = Query(None, alias="divisionId", description="Filter by division"),
    billing_status: Optional[str] = Query(None, alias="billingStatus", description="Filter by billing status"),
    state: Optional[str] = Query(None, description="Filter by state"),
    fake_name: Optional[str] = Query(None, alias="faName", description="Filter by FA name (step1 or step2)"),
    start_date: Optional[date] = Query(None, alias="startDate", description="Filter by entry date start"),
    end_date: Optional[date] = Query(None, alias="endDate", description="Filter by entry date end"),
    include_deleted: bool = Query(False, alias="includeDeleted", description="Include soft-deleted orders"),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=10000, alias="pageSize"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List orders with filtering based on role"""
    from sqlalchemy import or_
    
    query = db.query(Order).options(
        joinedload(Order.transaction_type),
        joinedload(Order.process_type),
        joinedload(Order.order_status),
        joinedload(Order.division)
    )
    
    # Exclude soft-deleted by default
    if not include_deleted:
        query = query.filter(Order.deleted_at == None)
    
    # Apply role-based filtering
    if current_user.user_role == ROLE_SUPERADMIN:
        if org_id:
            query = query.filter(Order.org_id == org_id)
    elif current_user.user_role == ROLE_ADMIN:
        query = query.filter(Order.org_id == current_user.org_id)
    elif current_user.user_role == ROLE_TEAM_LEAD:
        # Team leads see orders from teams they lead or are members of
        accessible_teams = get_user_teams(current_user, db)
        if not accessible_teams:
            return {"items": [], "total": 0}
        query = query.filter(Order.team_id.in_(accessible_teams))
    else:  # Employee
        # Employees see ALL orders from teams they are members of
        # This allows them to view team orders and add their step to existing files
        accessible_teams = get_user_teams(current_user, db)
        if not accessible_teams:
            return {"items": [], "total": 0}
        query = query.filter(Order.team_id.in_(accessible_teams))
    
    # Apply additional filters
    if team_id:
        query = query.filter(Order.team_id == team_id)
    if order_status_id:
        query = query.filter(Order.order_status_id == order_status_id)
    
    # myOrders filter - show orders where user worked on step1 OR step2
    if my_orders:
        query = query.filter(
            or_(
                Order.step1_user_id == current_user.id,
                Order.step2_user_id == current_user.id
            )
        )
    else:
        # Individual step filters (only apply if myOrders is not set)
        if step1_user_id:
            query = query.filter(Order.step1_user_id == step1_user_id)
        if step2_user_id:
            query = query.filter(Order.step2_user_id == step2_user_id)
    
    if billing_status:
        query = query.filter(Order.billing_status == billing_status)
    if process_type_id:
        query = query.filter(Order.process_type_id == process_type_id)
    if division_id:
        query = query.filter(Order.division_id == division_id)
    if state:
        query = query.filter(Order.state == state.upper())
    if fake_name:
        # Filter by FA name (either step1 or step2)
        query = query.filter(
            or_(
                Order.step1_fa_name == fake_name,
                Order.step2_fa_name == fake_name
            )
        )
    if start_date:
        query = query.filter(Order.entry_date >= start_date)
    if end_date:
        query = query.filter(Order.entry_date <= end_date)
    
    # Get total count
    total = query.count()
    
    # Paginate - Sort by modified_at DESC (newest activity first), then by id DESC
    offset = (page - 1) * page_size
    orders = query.order_by(Order.modified_at.desc(), Order.id.desc()).offset(offset).limit(page_size).all()
    
    return {
        "items": [serialize_simple_order(o) for o in orders],
        "total": total
    }


@router.get("/check-file/{file_number}")
async def check_file_number(
    file_number: str,
    team_id: int = Query(..., alias="teamId"),
    product_type: str = Query(..., alias="productType"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Check if a file number + product type combination exists for a specific team.
    The combination must be unique per team.
    Exception: If Step 1 is done, user can add Step 2 (and vice versa).
    """
    # Check team access (still needed to validate the team_id parameter)
    if not check_team_access(current_user, team_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot access this team"
        )
    
    # Check if file_number + product_type + team_id combination exists
    existing = db.query(Order).options(
        joinedload(Order.step1_user),
        joinedload(Order.step2_user),
        joinedload(Order.process_type)
    ).filter(
        Order.file_number == file_number,
        Order.product_type == product_type,
        Order.team_id == team_id,
        Order.deleted_at == None
    ).first()
    
    if not existing:
        # File + product_type + team combination doesn't exist - new order allowed
        return {
            "exists": False,
            "fileNumber": file_number,
            "productType": product_type,
            "step1Completed": False,
            "step2Completed": False,
            "orderId": None,
            "sameTeam": True  # Always true since we're checking within the same team
        }
    
    # File + product_type + team combination exists - check if Step 1 or Step 2 can be added
    step1_completed = existing.step1_user_id is not None
    step2_completed = existing.step2_user_id is not None
    
    return {
        "exists": True,
        "fileNumber": file_number,
        "productType": product_type,
        "orderId": existing.id,
        "step1Completed": step1_completed,
        "step2Completed": step2_completed,
        "step1UserId": existing.step1_user_id,
        "step1UserName": existing.step1_user.user_name if existing.step1_user else None,
        "step2UserId": existing.step2_user_id,
        "step2UserName": existing.step2_user.user_name if existing.step2_user else None,
        "sameTeam": True,  # Always true since we're checking within the same team
        "teamId": existing.team_id,
        # Include existing order details so frontend can use them if adding Step 2
        "existingOrderDetails": {
            "state": existing.state,
            "county": existing.county,
            "productType": existing.product_type,
            "transactionTypeId": existing.transaction_type_id,
            "orderStatusId": existing.order_status_id,
            "divisionId": existing.division_id,
            "entryDate": existing.entry_date.isoformat() if existing.entry_date else None
        }
    }


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_order(
    order_data: OrderCreate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Create new order or update existing order with the other step.
    
    Logic:
    - If file_number doesn't exist: create new order
    - If file_number exists and user is adding a different step: update existing order
    - If file_number exists with same step: reject (duplicate)
    """
    # Import Organization model
    from app.models.organization import Organization
    from app.models.reference import ProcessType
    
    # Check organization access
    if not check_org_access(current_user, order_data.org_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create order in this organization"
        )
    
    # Check if organization is active
    organization = db.query(Organization).filter(Organization.id == order_data.org_id).first()
    if not organization:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )
    if not organization.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create order for inactive organization"
        )
    
    # Check team access
    if not check_team_access(current_user, order_data.team_id, db):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create order for this team"
        )
    
    # Check if team is active
    team = db.query(Team).filter(Team.id == order_data.team_id).first()
    if not team:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found"
        )
    if not team.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot create order for inactive team"
        )
    
    # Get the process type name to determine step logic
    process_type = db.query(ProcessType).filter(ProcessType.id == order_data.process_type_id).first()
    if not process_type:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Process type not found"
        )
    
    # Check if file_number + product_type + team_id combination already exists
    # The database has a unique constraint on (file_number, product_type, team_id)
    # Different teams CAN have the same file_number + product_type
    existing = db.query(Order).filter(
        Order.file_number == order_data.file_number,
        Order.product_type == order_data.product_type,
        Order.team_id == order_data.team_id,
        Order.deleted_at == None
    ).first()
    
    if existing:
        # File number + product_type + team_id combination exists in THIS team
        # Determine if we should merge or reject
        is_admin_or_higher = current_user.user_role in [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD]
        
        # Determine what step the user is trying to add
        adding_step1 = order_data.step1_user_id is not None
        adding_step2 = order_data.step2_user_id is not None
        
        # For Single Seat, user adds both steps - reject if order exists (unless admin)
        if process_type.name == 'Single Seat':
            if not is_admin_or_higher:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"File number '{order_data.file_number}' with product type '{order_data.product_type}' already exists. Cannot create a Single Seat order."
                )
            # Admin can override - just reject
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File number '{order_data.file_number}' with product type '{order_data.product_type}' already exists"
            )
        
        # Check if user is trying to add step1 but it's already done by someone else
        if adding_step1 and existing.step1_user_id is not None:
            if existing.step1_user_id != current_user.id and not is_admin_or_higher:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Step 1 for file '{order_data.file_number}' is already completed by {existing.step1_user.user_name if existing.step1_user else 'another user'}"
                )
        
        # Check if user is trying to add step2 but it's already done by someone else
        if adding_step2 and existing.step2_user_id is not None:
            if existing.step2_user_id != current_user.id and not is_admin_or_higher:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Step 2 for file '{order_data.file_number}' is already completed by {existing.step2_user.user_name if existing.step2_user else 'another user'}"
                )
        
        # Validate the user being assigned
        if adding_step1 and order_data.step1_user_id:
            validate_user_for_step_assignment(
                db, order_data.step1_user_id, order_data.team_id, "Step 1"
            )
        if adding_step2 and order_data.step2_user_id:
            validate_user_for_step_assignment(
                db, order_data.step2_user_id, order_data.team_id, "Step 2"
            )
        
        # Merge the step data into existing order
        if adding_step1:
            if existing.step1_user_id is None or existing.step1_user_id == current_user.id or is_admin_or_higher:
                log_order_change(db, existing.id, current_user.id, "step1_user_id", 
                               str(existing.step1_user_id) if existing.step1_user_id else None, 
                               str(order_data.step1_user_id), "update")
                existing.step1_user_id = order_data.step1_user_id
                
                # Set the FA name from request data
                if order_data.step1_fa_name_id:
                    existing.step1_fa_name_id = order_data.step1_fa_name_id
                
                if order_data.step1_start_time:
                    log_order_change(db, existing.id, current_user.id, "step1_start_time",
                                   str(existing.step1_start_time) if existing.step1_start_time else None,
                                   str(order_data.step1_start_time), "update")
                    existing.step1_start_time = order_data.step1_start_time
                if order_data.step1_end_time:
                    log_order_change(db, existing.id, current_user.id, "step1_end_time",
                                   str(existing.step1_end_time) if existing.step1_end_time else None,
                                   str(order_data.step1_end_time), "update")
                    existing.step1_end_time = order_data.step1_end_time
        
        if adding_step2:
            if existing.step2_user_id is None or existing.step2_user_id == current_user.id or is_admin_or_higher:
                log_order_change(db, existing.id, current_user.id, "step2_user_id",
                               str(existing.step2_user_id) if existing.step2_user_id else None,
                               str(order_data.step2_user_id), "update")
                existing.step2_user_id = order_data.step2_user_id
                
                # Set the FA name from request data
                if order_data.step2_fa_name_id:
                    existing.step2_fa_name_id = order_data.step2_fa_name_id
                
                if order_data.step2_start_time:
                    log_order_change(db, existing.id, current_user.id, "step2_start_time",
                                   str(existing.step2_start_time) if existing.step2_start_time else None,
                                   str(order_data.step2_start_time), "update")
                    existing.step2_start_time = order_data.step2_start_time
                if order_data.step2_end_time:
                    log_order_change(db, existing.id, current_user.id, "step2_end_time",
                                   str(existing.step2_end_time) if existing.step2_end_time else None,
                                   str(order_data.step2_end_time), "update")
                    existing.step2_end_time = order_data.step2_end_time
        
        existing.modified_by = current_user.id
        db.commit()
        
        # Invalidate dashboard caches for this organization
        cache.invalidate_dashboard_cache(org_id=order_data.org_id)
        
        # Reload with relationships
        order = db.query(Order).options(
            joinedload(Order.transaction_type),
            joinedload(Order.process_type),
            joinedload(Order.order_status),
            joinedload(Order.division),
            joinedload(Order.step1_user),
            joinedload(Order.step2_user),
            joinedload(Order.step1_fa_name),
            joinedload(Order.step2_fa_name)
        ).filter(Order.id == existing.id).first()
        
        return serialize_order(order)
    
    # File number doesn't exist - create new order
    # Validate step1 user assignment (if provided)
    if order_data.step1_user_id:
        validate_user_for_step_assignment(
            db, order_data.step1_user_id, order_data.team_id, "Step 1"
        )
    
    # Validate step2 user assignment (if provided)
    if order_data.step2_user_id:
        validate_user_for_step_assignment(
            db, order_data.step2_user_id, order_data.team_id, "Step 2"
        )
    
    # Create order
    order = Order(
        file_number=order_data.file_number,
        entry_date=order_data.entry_date,
        transaction_type_id=order_data.transaction_type_id,
        process_type_id=order_data.process_type_id,
        order_status_id=order_data.order_status_id,
        division_id=order_data.division_id,
        state=order_data.state.upper(),
        county=order_data.county,
        product_type=order_data.product_type,
        team_id=order_data.team_id,
        org_id=order_data.org_id,
        step1_user_id=order_data.step1_user_id,
        step1_fa_name_id=order_data.step1_fa_name_id,
        step1_start_time=order_data.step1_start_time,
        step1_end_time=order_data.step1_end_time,
        step2_user_id=order_data.step2_user_id,
        step2_fa_name_id=order_data.step2_fa_name_id,
        step2_start_time=order_data.step2_start_time,
        step2_end_time=order_data.step2_end_time,
        created_by=current_user.id
    )
    
    db.add(order)
    db.flush()
    
    # Log creation
    log_order_change(db, order.id, current_user.id, "order", None, order_data.file_number, "create")
    
    db.commit()
    
    # Invalidate dashboard caches for this organization
    cache.invalidate_dashboard_cache(org_id=order_data.org_id)
    
    # Reload with relationships
    order = db.query(Order).options(
        joinedload(Order.transaction_type),
        joinedload(Order.process_type),
        joinedload(Order.order_status),
        joinedload(Order.division),
        joinedload(Order.step1_user),
        joinedload(Order.step2_user),
        joinedload(Order.step1_fa_name),
        joinedload(Order.step2_fa_name)
    ).filter(Order.id == order.id).first()
    
    return serialize_order(order)


@router.get("/{order_id}")
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get order by ID with full details"""
    order = db.query(Order).options(
        joinedload(Order.transaction_type),
        joinedload(Order.process_type),
        joinedload(Order.order_status),
        joinedload(Order.division),
        joinedload(Order.step1_user),
        joinedload(Order.step2_user)
    ).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    
    # Check access - team members can view all orders in their team
    if current_user.user_role == ROLE_SUPERADMIN:
        pass  # Full access
    elif current_user.user_role == ROLE_ADMIN:
        if order.org_id != current_user.org_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    elif current_user.user_role == ROLE_TEAM_LEAD:
        if not check_team_access(current_user, order.team_id, db):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    else:  # Employee
        # Employees can view any order in their team
        if not check_team_access(current_user, order.team_id, db):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    
    # Add edit permissions info to the response
    order_dict = serialize_order(order)
    order_dict["editPermissions"] = get_edit_permissions(order, current_user)
    
    return order_dict


def get_edit_permissions(order: Order, user: User) -> dict:
    """
    Determine what a user can edit on an order.
    
    Rules:
    - Superadmin/Admin/Team Lead: Can edit everything
    - Employee:
      - Single Seat orders: Only the assigned user can edit (no one else)
      - Step1/Step2 orders: Steps are INDEPENDENT
        - Can edit Step 1 if: they did it OR it's not done yet
        - Can edit Step 2 if: they did it OR it's not done yet
        - Cannot edit someone else's completed step
    """
    process_type_name = order.process_type.name if order.process_type else None
    
    # Admin/Team Lead have full access
    if user.user_role in [ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD]:
        return {
            "canEdit": True,
            "canEditStep1": True,
            "canEditStep2": True,
            "canEditOrderDetails": True,
            "reason": "Full access"
        }
    
    # Employee permissions
    is_step1_user = order.step1_user_id == user.id
    is_step2_user = order.step2_user_id == user.id
    step1_done = order.step1_user_id is not None
    step2_done = order.step2_user_id is not None
    
    # Single Seat - only the assigned user can edit
    if process_type_name == "Single Seat":
        if is_step1_user:  # step1_user_id == step2_user_id for Single Seat
            return {
                "canEdit": True,
                "canEditStep1": True,
                "canEditStep2": True,
                "canEditOrderDetails": False,
                "reason": "You completed this Single Seat order"
            }
        else:
            return {
                "canEdit": False,
                "canEditStep1": False,
                "canEditStep2": False,
                "canEditOrderDetails": False,
                "reason": "Single Seat order completed by another employee"
            }
    
    # Step1/Step2 process types - STEPS ARE INDEPENDENT
    # Can edit a step if: user did it themselves OR it's not done yet
    can_edit_step1 = is_step1_user or (not step1_done)
    can_edit_step2 = is_step2_user or (not step2_done)
    
    can_edit = can_edit_step1 or can_edit_step2
    
    reasons = []
    if can_edit_step1:
        if is_step1_user:
            reasons.append("You completed Step 1")
        elif not step1_done:
            reasons.append("Step 1 is available")
    if can_edit_step2:
        if is_step2_user:
            reasons.append("You completed Step 2")
        elif not step2_done:
            reasons.append("Step 2 is available")
    
    if not can_edit:
        reason = "Both steps completed by other employees"
    else:
        reason = "; ".join(reasons) if reasons else "No edit access"
    
    return {
        "canEdit": can_edit,
        "canEditStep1": can_edit_step1,
        "canEditStep2": can_edit_step2,
        "canEditOrderDetails": False,  # Employees cannot edit order details
        "reason": reason
    }


@router.put("/{order_id}")
async def update_order(
    order_id: int,
    order_data: OrderUpdate,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Update order with role-based edit restrictions"""
    order = db.query(Order).options(
        joinedload(Order.transaction_type),
        joinedload(Order.process_type),
        joinedload(Order.order_status),
        joinedload(Order.division),
        joinedload(Order.step1_user),
        joinedload(Order.step2_user),
        joinedload(Order.step1_fa_name),
        joinedload(Order.step2_fa_name)
    ).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    # Check soft delete
    if order.deleted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot update deleted order")
    
    # Get edit permissions for this user
    edit_perms = get_edit_permissions(order, current_user)
    
    if not edit_perms["canEdit"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=f"Cannot edit this order: {edit_perms['reason']}"
        )
    
    update_data = order_data.model_dump(exclude_unset=True)
    
    # Define field categories
    step1_fields = ['step1_user_id', 'step1_fa_name_id', 'step1_start_time', 'step1_end_time']
    step2_fields = ['step2_user_id', 'step2_fa_name_id', 'step2_start_time', 'step2_end_time']
    order_detail_fields = ['entry_date', 'transaction_type_id', 'process_type_id', 
                          'order_status_id', 'division_id', 'state', 'county', 
                          'product_type', 'team_id', 'billing_status']
    
    # Validate field access for employees
    # We need to check if values are actually changing, not just if they're present
    if current_user.user_role == ROLE_EMPLOYEE:
        fields_to_remove = []  # Track fields that aren't actually changing
        
        for field, new_value in update_data.items():
            old_value = getattr(order, field)
            value_is_changing = old_value != new_value
            
            # Check order detail fields - only block if value is actually changing
            if field in order_detail_fields and not edit_perms["canEditOrderDetails"]:
                if value_is_changing:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Employees cannot modify order details ({field})"
                    )
                else:
                    # Value isn't changing, remove from update to skip unnecessary processing
                    fields_to_remove.append(field)
            
            # Check step1 fields
            if field in step1_fields and not edit_perms["canEditStep1"]:
                if value_is_changing:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Cannot modify Step 1 - it was completed by another employee"
                    )
                else:
                    fields_to_remove.append(field)
            
            # Check step2 fields
            if field in step2_fields and not edit_perms["canEditStep2"]:
                if value_is_changing:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail=f"Cannot modify Step 2 - it was completed by another employee"
                    )
                else:
                    fields_to_remove.append(field)
        
        # Remove unchanged fields that employee shouldn't modify
        for field in fields_to_remove:
            del update_data[field]
    
    # Determine the team_id to use for validation (could be updated or existing)
    team_id_for_validation = update_data.get('team_id', order.team_id)
    
    # Validate step1 user assignment (if being updated)
    if 'step1_user_id' in update_data and update_data['step1_user_id'] is not None:
        validate_user_for_step_assignment(
            db, update_data['step1_user_id'], team_id_for_validation, "Step 1"
        )
    
    # Validate step2 user assignment (if being updated)
    if 'step2_user_id' in update_data and update_data['step2_user_id'] is not None:
        validate_user_for_step_assignment(
            db, update_data['step2_user_id'], team_id_for_validation, "Step 2"
        )
    
    # Log changes and update
    for field, new_value in update_data.items():
        old_value = getattr(order, field)
        if old_value != new_value:
            log_order_change(
                db, order.id, current_user.id, field,
                str(old_value) if old_value else None,
                str(new_value) if new_value else None,
                "update"
            )
            setattr(order, field, new_value)
    
    order.modified_by = current_user.id
    db.commit()
    db.refresh(order)
    
    # Invalidate dashboard caches for this organization
    cache.invalidate_dashboard_cache(org_id=order.org_id)
    
    # Return with updated edit permissions
    order_dict = serialize_order(order)
    order_dict["editPermissions"] = get_edit_permissions(order, current_user)
    
    return order_dict


@router.post("/bulk/billing-status")
async def bulk_update_billing_status(
    data: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Bulk update billing status for multiple orders (Admin or Superadmin only)"""
    order_ids = data.get("orderIds", [])
    billing_status = data.get("billingStatus")
    
    if not order_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No order IDs provided"
        )
    
    if billing_status not in ["pending", "done"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid billing status. Must be 'pending' or 'done'"
        )
    
    # Get orders
    query = db.query(Order).filter(Order.id.in_(order_ids), Order.deleted_at == None)
    
    # Admin can only update orders in their organization
    if current_user.user_role == ROLE_ADMIN:
        query = query.filter(Order.org_id == current_user.org_id)
    
    orders = query.all()
    
    if not orders:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No orders found with the provided IDs"
        )
    
    updated_count = 0
    for order in orders:
        if order.billing_status != billing_status:
            log_order_change(
                db, order.id, current_user.id, "billing_status",
                order.billing_status, billing_status, "update"
            )
            order.billing_status = billing_status
            order.modified_by = current_user.id
            updated_count += 1
    
    db.commit()
    
    # Invalidate dashboard caches for affected organizations
    if updated_count > 0:
        cache.invalidate_dashboard_cache()  # Invalidate all dashboard caches since orders could be from different orgs
    
    return {"message": f"Updated billing status for {updated_count} orders"}


@router.delete("/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order(
    order_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Soft delete an order (Admin or Superadmin only)"""
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    if order.deleted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order is already deleted")
    
    # Check organization access for admin
    if current_user.user_role == ROLE_ADMIN:
        if order.org_id != current_user.org_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    
    # Soft delete
    order.deleted_at = datetime.utcnow()
    order.deleted_by = current_user.id
    order.modified_by = current_user.id
    
    log_order_change(db, order.id, current_user.id, "deleted_at", None, str(order.deleted_at), "delete")
    
    db.commit()
    
    # Invalidate dashboard caches for this organization
    cache.invalidate_dashboard_cache(org_id=order.org_id)


@router.post("/{order_id}/restore")
async def restore_order(
    order_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Restore a soft-deleted order (Admin or Superadmin only)"""
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    if not order.deleted_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order is not deleted")
    
    # Check organization access for admin
    if current_user.user_role == ROLE_ADMIN:
        if order.org_id != current_user.org_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    
    # Restore
    old_deleted_at = str(order.deleted_at)
    order.deleted_at = None
    order.deleted_by = None
    order.modified_by = current_user.id
    
    log_order_change(db, order.id, current_user.id, "deleted_at", old_deleted_at, None, "restore")
    
    db.commit()
    
    # Invalidate dashboard caches for this organization
    cache.invalidate_dashboard_cache(org_id=order.org_id)
    
    # Reload with relationships
    order = db.query(Order).options(
        joinedload(Order.transaction_type),
        joinedload(Order.process_type),
        joinedload(Order.order_status),
        joinedload(Order.division),
        joinedload(Order.step1_user),
        joinedload(Order.step2_user)
    ).filter(Order.id == order_id).first()
    
    return serialize_order(order)


@router.get("/{order_id}/history")
async def get_order_history(
    order_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get audit history for an order"""
    order = db.query(Order).filter(Order.id == order_id).first()
    
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
    
    # Check access
    if current_user.user_role == ROLE_ADMIN:
        if order.org_id != current_user.org_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    elif current_user.user_role == ROLE_TEAM_LEAD:
        if not check_team_access(current_user, order.team_id, db):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    elif current_user.user_role == ROLE_EMPLOYEE:
        if order.step1_user_id != current_user.id and order.step2_user_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access forbidden")
    
    history = db.query(OrderHistory).options(
        joinedload(OrderHistory.changed_by_user)
    ).filter(
        OrderHistory.order_id == order_id
    ).order_by(OrderHistory.changed_at.desc()).all()
    
    return [serialize_order_history(h) for h in history]
