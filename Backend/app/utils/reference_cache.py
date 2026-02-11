"""
Reference Data Cache
Caches frequently accessed reference data (order statuses, transaction types, etc).
Eliminates repeated reference data lookups across endpoints.
"""
from sqlalchemy.orm import Session
from typing import Optional, Dict, List, Any
from app.models.reference import OrderStatusType, TransactionType, ProcessType, Division
from app.services.cache_service import cache


class ReferenceDataCache:
    """Centralized reference data caching"""
    
    # Cache these common reference lookups
    @staticmethod
    def get_order_status_id_by_name(name: str, db: Session) -> Optional[int]:
        """
        Get order status ID by name with caching.
        Common usage: getting "Completed" status ID
        
        Args:
            name: Status name (e.g., "Completed", "On Hold")
            db: Database session
            
        Returns:
            Order status ID or None
        """
        cache_key = f"order_status_id:{name}"
        
        # Try cache first
        cached_id = cache.get(cache_key)
        if cached_id is not None:
            return cached_id
        
        # Query database
        status = db.query(OrderStatusType).filter(
            OrderStatusType.name == name
        ).first()
        
        if status:
            # Cache for 1 hour
            cache.set(cache_key, status.id, ttl=3600)
            return status.id
        
        return None
    
    @staticmethod
    def get_all_order_statuses(db: Session) -> List[Dict[str, Any]]:
        """
        Get all order statuses with caching.
        
        Args:
            db: Database session
            
        Returns:
            List of status dicts with id and name
        """
        cache_key = "all_order_statuses"
        
        # Try cache first
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data
        
        # Query database
        statuses = db.query(OrderStatusType).all()
        result = [{"id": s.id, "name": s.name} for s in statuses]
        
        # Cache for 1 hour
        cache.set(cache_key, result, ttl=3600)
        return result
    
    @staticmethod
    def get_transaction_type_id_by_name(name: str, db: Session) -> Optional[int]:
        """
        Get transaction type ID by name with caching.
        
        Args:
            name: Transaction type name
            db: Database session
            
        Returns:
            Transaction type ID or None
        """
        cache_key = f"transaction_type_id:{name}"
        
        cached_id = cache.get(cache_key)
        if cached_id is not None:
            return cached_id
        
        t_type = db.query(TransactionType).filter(
            TransactionType.name == name
        ).first()
        
        if t_type:
            cache.set(cache_key, t_type.id, ttl=3600)
            return t_type.id
        
        return None
    
    @staticmethod
    def get_all_transaction_types(db: Session) -> List[Dict[str, Any]]:
        """
        Get all transaction types with caching.
        
        Args:
            db: Database session
            
        Returns:
            List of transaction type dicts
        """
        cache_key = "all_transaction_types"
        
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data
        
        types = db.query(TransactionType).all()
        result = [{"id": t.id, "name": t.name} for t in types]
        
        cache.set(cache_key, result, ttl=3600)
        return result
    
    @staticmethod
    def get_all_process_types(db: Session) -> List[Dict[str, Any]]:
        """
        Get all process types with caching.
        
        Args:
            db: Database session
            
        Returns:
            List of process type dicts
        """
        cache_key = "all_process_types"
        
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data
        
        types = db.query(ProcessType).all()
        result = [{"id": t.id, "name": t.name} for t in types]
        
        cache.set(cache_key, result, ttl=3600)
        return result
    
    @staticmethod
    def get_all_divisions(db: Session) -> List[Dict[str, Any]]:
        """
        Get all divisions with caching.
        
        Args:
            db: Database session
            
        Returns:
            List of division dicts
        """
        cache_key = "all_divisions"
        
        cached_data = cache.get(cache_key)
        if cached_data is not None:
            return cached_data
        
        divisions = db.query(Division).all()
        result = [{"id": d.id, "name": d.name} for d in divisions]
        
        cache.set(cache_key, result, ttl=3600)
        return result
    
    @staticmethod
    def invalidate_all_reference_caches() -> None:
        """
        Invalidate all reference data caches.
        Call this when reference data is updated.
        """
        cache.delete_pattern("order_status_id:*")
        cache.delete_pattern("process_type_id:*")
        cache.delete_pattern("transaction_type_id:*")
        cache.delete("all_order_statuses")
        cache.delete("all_transaction_types")
        cache.delete("all_process_types")
        cache.delete("all_divisions")
    
    @staticmethod
    def warm_up_cache(db: Session) -> None:
        """
        Pre-populate critical reference caches.
        Call this on application startup.
        
        Args:
            db: Database session
        """
        # Pre-cache all reference data
        ReferenceDataCache.get_all_order_statuses(db)
        ReferenceDataCache.get_all_transaction_types(db)
        ReferenceDataCache.get_all_process_types(db)
        ReferenceDataCache.get_all_divisions(db)
        
        # Pre-cache commonly used status IDs
        for status_name in ["Completed", "On Hold", "BP-RTI", "Pending Billing"]:
            ReferenceDataCache.get_order_status_id_by_name(status_name, db)
