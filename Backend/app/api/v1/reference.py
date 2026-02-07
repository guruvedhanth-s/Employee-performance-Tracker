"""
Reference Tables API Routes
CRUD operations for lookup/configuration tables
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.database import get_db
from app.core.dependencies import (
    get_current_active_user, require_admin,
    ROLE_SUPERADMIN, ROLE_ADMIN
)
from app.models.user import User
from app.models.reference import TransactionType, ProcessType, OrderStatusType, Division
from app.services.cache_service import cache

router = APIRouter()


def serialize_transaction_type(item):
    return {
        "id": item.id,
        "name": item.name,
        "isActive": item.is_active,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
        "modifiedAt": item.modified_at.isoformat() if item.modified_at else None
    }


def serialize_process_type(item):
    return {
        "id": item.id,
        "name": item.name,
        "isActive": item.is_active,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
        "modifiedAt": item.modified_at.isoformat() if item.modified_at else None
    }


def serialize_order_status(item):
    return {
        "id": item.id,
        "name": item.name,
        "isActive": item.is_active,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
        "modifiedAt": item.modified_at.isoformat() if item.modified_at else None
    }


def serialize_division(item):
    return {
        "id": item.id,
        "name": item.name,
        "description": item.description,
        "createdAt": item.created_at.isoformat() if item.created_at else None,
        "modifiedAt": item.modified_at.isoformat() if item.modified_at else None
    }


# ============ Transaction Types ============
@router.get("/transaction-types")
async def list_transaction_types(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all transaction types"""
    # Check cache first
    cached_data = cache.get_reference("transaction_types", is_active)
    if cached_data is not None:
        return cached_data
    
    query = db.query(TransactionType)
    if is_active is not None:
        query = query.filter(TransactionType.is_active == is_active)
    
    result = [serialize_transaction_type(t) for t in query.order_by(TransactionType.name).all()]
    
    # Cache the result
    cache.set_reference("transaction_types", result, is_active)
    return result


@router.get("/transaction-types/{type_id}")
async def get_transaction_type(
    type_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get transaction type by ID"""
    item = db.query(TransactionType).filter(TransactionType.id == type_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction type not found")
    return serialize_transaction_type(item)


@router.post("/transaction-types", status_code=status.HTTP_201_CREATED)
async def create_transaction_type(
    name: str,
    is_active: bool = True,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create new transaction type (Admin or Superadmin only)"""
    existing = db.query(TransactionType).filter(TransactionType.name == name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transaction type name already exists")
    
    item = TransactionType(name=name, is_active=is_active)
    db.add(item)
    db.commit()
    db.refresh(item)
    
    # Invalidate cache
    cache.invalidate_reference_cache("transaction_types")
    return serialize_transaction_type(item)


@router.put("/transaction-types/{type_id}")
async def update_transaction_type(
    type_id: int,
    name: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update transaction type (Admin or Superadmin only)"""
    item = db.query(TransactionType).filter(TransactionType.id == type_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction type not found")
    
    if name is not None:
        existing = db.query(TransactionType).filter(
            TransactionType.name == name,
            TransactionType.id != type_id
        ).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Transaction type name already exists")
        item.name = name
    
    if is_active is not None:
        item.is_active = is_active
    
    db.commit()
    db.refresh(item)
    
    # Invalidate cache
    cache.invalidate_reference_cache("transaction_types")
    return serialize_transaction_type(item)


@router.delete("/transaction-types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_transaction_type(
    type_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Deactivate transaction type (Admin or Superadmin only)"""
    item = db.query(TransactionType).filter(TransactionType.id == type_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction type not found")
    
    item.is_active = False
    db.commit()
    
    # Invalidate cache
    cache.invalidate_reference_cache("transaction_types")


# ============ Process Types ============
@router.get("/process-types")
async def list_process_types(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all process types"""
    # Check cache first
    cached_data = cache.get_reference("process_types", is_active)
    if cached_data is not None:
        return cached_data
    
    query = db.query(ProcessType)
    if is_active is not None:
        query = query.filter(ProcessType.is_active == is_active)
    
    result = [serialize_process_type(t) for t in query.order_by(ProcessType.name).all()]
    
    # Cache the result
    cache.set_reference("process_types", result, is_active)
    return result


@router.get("/process-types/{type_id}")
async def get_process_type(
    type_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get process type by ID"""
    item = db.query(ProcessType).filter(ProcessType.id == type_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Process type not found")
    return serialize_process_type(item)


@router.post("/process-types", status_code=status.HTTP_201_CREATED)
async def create_process_type(
    name: str,
    is_active: bool = True,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create new process type (Admin or Superadmin only)"""
    existing = db.query(ProcessType).filter(ProcessType.name == name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Process type name already exists")
    
    item = ProcessType(name=name, is_active=is_active)
    db.add(item)
    db.commit()
    db.refresh(item)
    
    # Invalidate cache
    cache.invalidate_reference_cache("process_types")
    return serialize_process_type(item)


@router.put("/process-types/{type_id}")
async def update_process_type(
    type_id: int,
    name: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update process type (Admin or Superadmin only)"""
    item = db.query(ProcessType).filter(ProcessType.id == type_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Process type not found")
    
    if name is not None:
        existing = db.query(ProcessType).filter(
            ProcessType.name == name,
            ProcessType.id != type_id
        ).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Process type name already exists")
        item.name = name
    
    if is_active is not None:
        item.is_active = is_active
    
    db.commit()
    db.refresh(item)
    
    # Invalidate cache
    cache.invalidate_reference_cache("process_types")
    return serialize_process_type(item)


@router.delete("/process-types/{type_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_process_type(
    type_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Deactivate process type (Admin or Superadmin only)"""
    item = db.query(ProcessType).filter(ProcessType.id == type_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Process type not found")
    
    item.is_active = False
    db.commit()
    
    # Invalidate cache
    cache.invalidate_reference_cache("process_types")


# ============ Order Status Types ============
@router.get("/order-statuses")
async def list_order_statuses(
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all order status types"""
    # Check cache first
    cached_data = cache.get_reference("order_statuses", is_active)
    if cached_data is not None:
        return cached_data
    
    query = db.query(OrderStatusType)
    if is_active is not None:
        query = query.filter(OrderStatusType.is_active == is_active)
    
    result = [serialize_order_status(t) for t in query.order_by(OrderStatusType.name).all()]
    
    # Cache the result
    cache.set_reference("order_statuses", result, is_active)
    return result


@router.get("/order-statuses/{status_id}")
async def get_order_status(
    status_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get order status by ID"""
    item = db.query(OrderStatusType).filter(OrderStatusType.id == status_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order status not found")
    return serialize_order_status(item)


@router.post("/order-statuses", status_code=status.HTTP_201_CREATED)
async def create_order_status(
    name: str,
    is_active: bool = True,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create new order status (Admin or Superadmin only)"""
    existing = db.query(OrderStatusType).filter(OrderStatusType.name == name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order status name already exists")
    
    item = OrderStatusType(name=name, is_active=is_active)
    db.add(item)
    db.commit()
    db.refresh(item)
    
    # Invalidate cache
    cache.invalidate_reference_cache("order_statuses")
    return serialize_order_status(item)


@router.put("/order-statuses/{status_id}")
async def update_order_status(
    status_id: int,
    name: Optional[str] = None,
    is_active: Optional[bool] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update order status (Admin or Superadmin only)"""
    item = db.query(OrderStatusType).filter(OrderStatusType.id == status_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order status not found")
    
    if name is not None:
        existing = db.query(OrderStatusType).filter(
            OrderStatusType.name == name,
            OrderStatusType.id != status_id
        ).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Order status name already exists")
        item.name = name
    
    if is_active is not None:
        item.is_active = is_active
    
    db.commit()
    db.refresh(item)
    
    # Invalidate cache
    cache.invalidate_reference_cache("order_statuses")
    return serialize_order_status(item)


@router.delete("/order-statuses/{status_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_order_status(
    status_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Deactivate order status (Admin or Superadmin only)"""
    item = db.query(OrderStatusType).filter(OrderStatusType.id == status_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order status not found")
    
    item.is_active = False
    db.commit()
    
    # Invalidate cache
    cache.invalidate_reference_cache("order_statuses")


# ============ Divisions ============
@router.get("/divisions")
async def list_divisions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """List all divisions"""
    # Check cache first
    cached_data = cache.get_reference("divisions", None)
    if cached_data is not None:
        return cached_data
    
    result = [serialize_division(d) for d in db.query(Division).order_by(Division.name).all()]
    
    # Cache the result
    cache.set_reference("divisions", result, None)
    return result


@router.get("/divisions/{division_id}")
async def get_division(
    division_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """Get division by ID"""
    item = db.query(Division).filter(Division.id == division_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Division not found")
    return serialize_division(item)


@router.post("/divisions", status_code=status.HTTP_201_CREATED)
async def create_division(
    name: str,
    description: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create new division (Admin or Superadmin only)"""
    existing = db.query(Division).filter(Division.name == name).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Division name already exists")
    
    item = Division(name=name, description=description)
    db.add(item)
    db.commit()
    db.refresh(item)
    
    # Invalidate cache
    cache.invalidate_reference_cache("divisions")
    return serialize_division(item)


@router.put("/divisions/{division_id}")
async def update_division(
    division_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update division (Admin or Superadmin only)"""
    item = db.query(Division).filter(Division.id == division_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Division not found")
    
    if name is not None:
        existing = db.query(Division).filter(
            Division.name == name,
            Division.id != division_id
        ).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Division name already exists")
        item.name = name
    
    if description is not None:
        item.description = description
    
    db.commit()
    db.refresh(item)
    
    # Invalidate cache
    cache.invalidate_reference_cache("divisions")
    return serialize_division(item)


@router.delete("/divisions/{division_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_division(
    division_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Delete division (Admin or Superadmin only)"""
    item = db.query(Division).filter(Division.id == division_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Division not found")
    
    db.delete(item)
    db.commit()
    
    # Invalidate cache
    cache.invalidate_reference_cache("divisions")
