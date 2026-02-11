"""
Redis Caching Service
Provides caching utilities for the ODS application
"""
import json
import redis
from typing import Any, Optional, Callable, TypeVar
from functools import wraps
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

T = TypeVar('T')


class CacheService:
    """Redis-based caching service"""
    
    # Cache TTL constants (in seconds)
    TTL_SHORT = 60 * 5          # 5 minutes
    TTL_MEDIUM = 60 * 15        # 15 minutes
    TTL_LONG = 60 * 60          # 1 hour
    TTL_REFERENCE = 60 * 60     # 1 hour for reference/lookup data
    TTL_DASHBOARD = 60 * 5      # 5 minutes for dashboard stats
    TTL_USER_LIST = 60 * 5      # 5 minutes for user/team lists
    
    # Cache key prefixes
    PREFIX_REFERENCE = "ref"
    PREFIX_DASHBOARD = "dash"
    PREFIX_METRICS = "metrics"
    PREFIX_USERS = "users"
    PREFIX_TEAMS = "teams"
    PREFIX_ORGS = "orgs"
    
    _instance: Optional['CacheService'] = None
    _redis_client: Optional[redis.Redis] = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._redis_client is None:
            self._connect()
    
    def _connect(self):
        """Establish Redis connection"""
        try:
            self._redis_client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            # Test connection
            self._redis_client.ping()
            logger.info("Redis connection established successfully")
        except redis.ConnectionError as e:
            logger.warning(f"Failed to connect to Redis: {e}. Caching disabled.")
            self._redis_client = None
        except Exception as e:
            logger.warning(f"Redis error: {e}. Caching disabled.")
            self._redis_client = None
    
    @property
    def is_connected(self) -> bool:
        """Check if Redis is connected"""
        if self._redis_client is None:
            return False
        try:
            self._redis_client.ping()
            return True
        except Exception:
            return False
    
    def _build_key(self, prefix: str, *args) -> str:
        """Build a cache key from prefix and arguments"""
        parts = [prefix] + [str(arg) for arg in args if arg is not None]
        return ":".join(parts)
    
    def get(self, key: str) -> Optional[Any]:
        """Get value from cache"""
        if not self.is_connected:
            return None
        try:
            value = self._redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            logger.warning(f"Cache get error for key {key}: {e}")
            return None
    
    def set(self, key: str, value: Any, ttl: int = TTL_SHORT) -> bool:
        """Set value in cache with TTL"""
        if not self.is_connected:
            return False
        try:
            serialized = json.dumps(value, default=str)
            self._redis_client.setex(key, ttl, serialized)
            return True
        except Exception as e:
            logger.warning(f"Cache set error for key {key}: {e}")
            return False
    
    def delete(self, key: str) -> bool:
        """Delete a specific key from cache"""
        if not self.is_connected:
            return False
        try:
            self._redis_client.delete(key)
            return True
        except Exception as e:
            logger.warning(f"Cache delete error for key {key}: {e}")
            return False
    
    def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a pattern"""
        if not self.is_connected:
            return 0
        try:
            keys = self._redis_client.keys(pattern)
            if keys:
                return self._redis_client.delete(*keys)
            return 0
        except Exception as e:
            logger.warning(f"Cache delete pattern error for {pattern}: {e}")
            return 0
    
    def invalidate_reference_cache(self, ref_type: Optional[str] = None):
        """Invalidate reference data cache"""
        if ref_type:
            self.delete_pattern(f"{self.PREFIX_REFERENCE}:{ref_type}:*")
        else:
            self.delete_pattern(f"{self.PREFIX_REFERENCE}:*")
    
    def invalidate_dashboard_cache(self, org_id: Optional[int] = None, user_id: Optional[int] = None):
        """Invalidate dashboard cache"""
        if org_id:
            self.delete_pattern(f"{self.PREFIX_DASHBOARD}:*:org:{org_id}*")
        if user_id:
            self.delete_pattern(f"{self.PREFIX_DASHBOARD}:*:user:{user_id}*")
        if not org_id and not user_id:
            self.delete_pattern(f"{self.PREFIX_DASHBOARD}:*")
    
    def invalidate_user_cache(self, org_id: Optional[int] = None):
        """Invalidate users list cache"""
        if org_id:
            self.delete_pattern(f"{self.PREFIX_USERS}:*:org:{org_id}*")
        else:
            self.delete_pattern(f"{self.PREFIX_USERS}:*")
    
    def invalidate_team_cache(self, org_id: Optional[int] = None):
        """Invalidate teams list cache"""
        if org_id:
            self.delete_pattern(f"{self.PREFIX_TEAMS}:*:org:{org_id}*")
        else:
            self.delete_pattern(f"{self.PREFIX_TEAMS}:*")
    
    def invalidate_all(self):
        """Clear all application cache"""
        if not self.is_connected:
            return
        try:
            self._redis_client.flushdb()
            logger.info("All cache cleared")
        except Exception as e:
            logger.warning(f"Cache flush error: {e}")
    
    # Convenience methods for specific cache types
    def get_reference(self, ref_type: str, is_active: Optional[bool] = None) -> Optional[Any]:
        """Get cached reference data"""
        key = self._build_key(self.PREFIX_REFERENCE, ref_type, f"active:{is_active}")
        return self.get(key)
    
    def set_reference(self, ref_type: str, data: Any, is_active: Optional[bool] = None) -> bool:
        """Cache reference data"""
        key = self._build_key(self.PREFIX_REFERENCE, ref_type, f"active:{is_active}")
        return self.set(key, data, self.TTL_REFERENCE)
    
    def get_dashboard(self, dashboard_type: str, org_id: Optional[int] = None, 
                      user_id: Optional[int] = None, team_ids: Optional[str] = None) -> Optional[Any]:
        """Get cached dashboard data"""
        key = self._build_key(
            self.PREFIX_DASHBOARD, 
            dashboard_type,
            f"org:{org_id}" if org_id else None,
            f"user:{user_id}" if user_id else None,
            f"teams:{team_ids}" if team_ids else None
        )
        return self.get(key)
    
    def set_dashboard(self, dashboard_type: str, data: Any, org_id: Optional[int] = None,
                      user_id: Optional[int] = None, team_ids: Optional[str] = None) -> bool:
        """Cache dashboard data"""
        key = self._build_key(
            self.PREFIX_DASHBOARD,
            dashboard_type,
            f"org:{org_id}" if org_id else None,
            f"user:{user_id}" if user_id else None,
            f"teams:{team_ids}" if team_ids else None
        )
        return self.set(key, data, self.TTL_DASHBOARD)
    
    def get_metrics(self, metric_type: str, org_id: Optional[int] = None, 
                    extra_key: Optional[str] = None) -> Optional[Any]:
        """Get cached metrics data"""
        key = self._build_key(
            self.PREFIX_METRICS,
            metric_type,
            f"org:{org_id}" if org_id else None,
            extra_key
        )
        return self.get(key)
    
    def set_metrics(self, metric_type: str, data: Any, org_id: Optional[int] = None,
                    extra_key: Optional[str] = None, ttl: Optional[int] = None) -> bool:
        """Cache metrics data"""
        key = self._build_key(
            self.PREFIX_METRICS,
            metric_type,
            f"org:{org_id}" if org_id else None,
            extra_key
        )
        return self.set(key, data, ttl or self.TTL_MEDIUM)


# Global cache instance
cache = CacheService()


def cached(prefix: str, ttl: int = CacheService.TTL_SHORT, 
           key_builder: Optional[Callable[..., str]] = None):
    """
    Decorator for caching function results
    
    Usage:
        @cached("users", ttl=300)
        async def get_users(org_id: int):
            ...
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        async def wrapper(*args, **kwargs) -> T:
            # Build cache key
            if key_builder:
                cache_key = key_builder(*args, **kwargs)
            else:
                # Default key builder using function name and arguments
                key_parts = [prefix, func.__name__]
                key_parts.extend(str(arg) for arg in args if arg is not None)
                key_parts.extend(f"{k}:{v}" for k, v in sorted(kwargs.items()) if v is not None)
                cache_key = ":".join(key_parts)
            
            # Try to get from cache
            cached_value = cache.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            cache.set(cache_key, result, ttl)
            return result
        
        return wrapper
    return decorator
