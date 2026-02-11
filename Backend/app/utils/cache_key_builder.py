"""
Cache Key Builder Utility
Centralizes cache key generation patterns.
Eliminates duplicate cache key building logic across services and endpoints.
"""
from typing import Optional, List
from app.core.dependencies import ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_TEAM_LEAD


class CacheKeyBuilder:
    """Standardized cache key generation"""
    
    # Cache key prefixes (matching cache_service.py)
    PREFIX_REFERENCE = "ref"
    PREFIX_DASHBOARD = "dash"
    PREFIX_METRICS = "metrics"
    PREFIX_USERS = "users"
    PREFIX_TEAMS = "teams"
    PREFIX_ORGS = "orgs"
    PREFIX_ORDERS = "orders"
    
    @staticmethod
    def build_key(prefix: str, *args: str) -> str:
        """
        Build a cache key from prefix and arguments.
        
        Args:
            prefix: Cache prefix (e.g., PREFIX_DASHBOARD)
            *args: Additional key components (will be converted to strings)
            
        Returns:
            Complete cache key joined with colons
            
        Example:
            key = CacheKeyBuilder.build_key("dash", "admin", "org:5", "month:3")
            # Returns: "dash:admin:org:5:month:3"
        """
        parts = [prefix] + [str(arg) for arg in args if arg is not None]
        return ":".join(parts)
    
    @staticmethod
    def build_reference_key(
        ref_type: str,
        is_active: Optional[bool] = None
    ) -> str:
        """
        Build cache key for reference data (transaction types, order statuses, etc).
        
        Args:
            ref_type: Type of reference (e.g., "transaction_type", "order_status")
            is_active: Optional filter for active/inactive (None = both)
            
        Returns:
            Cache key
            
        Example:
            key = CacheKeyBuilder.build_reference_key("order_status", is_active=True)
        """
        active_suffix = f"active:{is_active}" if is_active is not None else "all"
        return CacheKeyBuilder.build_key(CacheKeyBuilder.PREFIX_REFERENCE, ref_type, active_suffix)
    
    @staticmethod
    def build_dashboard_key(
        dashboard_type: str,
        role: str,
        org_id: Optional[int] = None,
        user_id: Optional[int] = None,
        team_ids: Optional[str] = None,
        month: Optional[int] = None,
        year: Optional[int] = None
    ) -> str:
        """
        Build cache key for dashboard data.
        
        Args:
            dashboard_type: Type of dashboard (e.g., "admin", "teamlead", "employee")
            role: User role for cache context
            org_id: Optional org filter
            user_id: Optional user filter
            team_ids: Optional team IDs (comma-separated string)
            month: Optional month filter
            year: Optional year filter
            
        Returns:
            Cache key
        """
        parts = [CacheKeyBuilder.PREFIX_DASHBOARD, dashboard_type, f"role:{role}"]
        
        if org_id:
            parts.append(f"org:{org_id}")
        if user_id:
            parts.append(f"user:{user_id}")
        if team_ids:
            parts.append(f"teams:{team_ids}")
        if month:
            parts.append(f"month:{month}")
        if year:
            parts.append(f"year:{year}")
        
        return ":".join(parts)
    
    @staticmethod
    def build_metrics_key(
        metrics_type: str,
        org_id: Optional[int] = None,
        team_id: Optional[int] = None,
        user_id: Optional[int] = None,
        period_type: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        extra_key: Optional[str] = None
    ) -> str:
        """
        Build cache key for metrics data.
        
        Args:
            metrics_type: Type of metrics (e.g., "dashboard", "employee", "team")
            org_id: Optional org filter
            team_id: Optional team filter
            user_id: Optional user filter
            period_type: Optional period type (daily, weekly, monthly)
            start_date: Optional start date (ISO format string)
            end_date: Optional end date (ISO format string)
            extra_key: Additional context string
            
        Returns:
            Cache key
        """
        parts = [CacheKeyBuilder.PREFIX_METRICS, metrics_type]
        
        if org_id:
            parts.append(f"org:{org_id}")
        if team_id:
            parts.append(f"team:{team_id}")
        if user_id:
            parts.append(f"user:{user_id}")
        if period_type:
            parts.append(f"period:{period_type}")
        if start_date:
            parts.append(f"start:{start_date}")
        if end_date:
            parts.append(f"end:{end_date}")
        if extra_key:
            parts.append(extra_key)
        
        return ":".join(parts)
    
    @staticmethod
    def build_users_list_key(
        role: str,
        org_id: Optional[int] = None,
        team_id: Optional[int] = None,
        filter_role: Optional[str] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100
    ) -> str:
        """
        Build cache key for user listing.
        
        Args:
            role: Current user's role (for access context)
            org_id: Optional org filter
            team_id: Optional team filter
            filter_role: Optional role filter (employee, team_lead, etc)
            is_active: Optional active filter
            skip: Pagination offset
            limit: Pagination limit
            
        Returns:
            Cache key
        """
        parts = [CacheKeyBuilder.PREFIX_USERS, "list", f"role:{role}"]
        
        if org_id:
            parts.append(f"org:{org_id}")
        if team_id:
            parts.append(f"team:{team_id}")
        if filter_role:
            parts.append(f"filter_role:{filter_role}")
        if is_active is not None:
            parts.append(f"active:{is_active}")
        
        parts.extend([f"skip:{skip}", f"limit:{limit}"])
        
        return ":".join(parts)
    
    @staticmethod
    def build_teams_list_key(
        role: str,
        org_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        skip: int = 0,
        limit: int = 100
    ) -> str:
        """
        Build cache key for team listing.
        
        Args:
            role: Current user's role
            org_id: Optional org filter
            is_active: Optional active filter
            skip: Pagination offset
            limit: Pagination limit
            
        Returns:
            Cache key
        """
        parts = [CacheKeyBuilder.PREFIX_TEAMS, "list", f"role:{role}"]
        
        if org_id:
            parts.append(f"org:{org_id}")
        if is_active is not None:
            parts.append(f"active:{is_active}")
        
        parts.extend([f"skip:{skip}", f"limit:{limit}"])
        
        return ":".join(parts)
    
    @staticmethod
    def build_orders_list_key(
        role: str,
        org_id: Optional[int] = None,
        team_id: Optional[int] = None,
        user_id: Optional[int] = None,
        status_id: Optional[int] = None,
        skip: int = 0,
        limit: int = 100,
        my_orders: bool = False
    ) -> str:
        """
        Build cache key for orders listing.
        
        Args:
            role: Current user's role
            org_id: Optional org filter
            team_id: Optional team filter
            user_id: Optional user filter
            status_id: Optional status filter
            skip: Pagination offset
            limit: Pagination limit
            my_orders: If True, filter to current user's orders
            
        Returns:
            Cache key
        """
        parts = [CacheKeyBuilder.PREFIX_ORDERS, "list", f"role:{role}"]
        
        if org_id:
            parts.append(f"org:{org_id}")
        if team_id:
            parts.append(f"team:{team_id}")
        if user_id:
            parts.append(f"user:{user_id}")
        if status_id:
            parts.append(f"status:{status_id}")
        if my_orders:
            parts.append("my_orders:true")
        
        parts.extend([f"skip:{skip}", f"limit:{limit}"])
        
        return ":".join(parts)
    
    @staticmethod
    def build_invalidation_pattern(prefix: str, **filters) -> str:
        """
        Build a Redis pattern for cache invalidation.
        Used with KEYS pattern matching for bulk deletion.
        
        Args:
            prefix: Cache prefix to invalidate
            **filters: Filter keys as kwargs (will be converted to pattern)
            
        Returns:
            Redis pattern string (with * wildcards)
            
        Example:
            pattern = CacheKeyBuilder.build_invalidation_pattern(
                "dash", role="*", org="5"
            )
            # Returns: "dash:*:role:*:org:5*"
        """
        parts = [prefix]
        for key, value in filters.items():
            if value is None or value == "*":
                parts.append("*")
            else:
                parts.append(f"{key}:{value}")
        
        return ":".join(parts) + "*"
    
    @staticmethod
    def get_invalidation_patterns_for_user_org(org_id: int) -> List[str]:
        """
        Get all cache invalidation patterns when org data changes.
        
        Args:
            org_id: Organization that changed
            
        Returns:
            List of patterns to invalidate
        """
        return [
            f"{CacheKeyBuilder.PREFIX_DASHBOARD}:*:org:{org_id}*",
            f"{CacheKeyBuilder.PREFIX_METRICS}:*:org:{org_id}*",
            f"{CacheKeyBuilder.PREFIX_USERS}:*:org:{org_id}*",
            f"{CacheKeyBuilder.PREFIX_TEAMS}:*:org:{org_id}*",
            f"{CacheKeyBuilder.PREFIX_ORDERS}:*:org:{org_id}*",
        ]
    
    @staticmethod
    def get_invalidation_patterns_for_team(team_id: int) -> List[str]:
        """
        Get all cache invalidation patterns when team data changes.
        
        Args:
            team_id: Team that changed
            
        Returns:
            List of patterns to invalidate
        """
        return [
            f"{CacheKeyBuilder.PREFIX_DASHBOARD}:*:teams:{team_id}*",
            f"{CacheKeyBuilder.PREFIX_METRICS}:*:team:{team_id}*",
            f"{CacheKeyBuilder.PREFIX_TEAMS}:*:*team:{team_id}*",
            f"{CacheKeyBuilder.PREFIX_ORDERS}:*:team:{team_id}*",
        ]
    
    @staticmethod
    def get_invalidation_patterns_for_user(user_id: int) -> List[str]:
        """
        Get all cache invalidation patterns when user data changes.
        
        Args:
            user_id: User that changed
            
        Returns:
            List of patterns to invalidate
        """
        return [
            f"{CacheKeyBuilder.PREFIX_DASHBOARD}:*:user:{user_id}*",
            f"{CacheKeyBuilder.PREFIX_METRICS}:*:user:{user_id}*",
            f"{CacheKeyBuilder.PREFIX_USERS}:*:*",  # All user lists may be affected
            f"{CacheKeyBuilder.PREFIX_ORDERS}:*:user:{user_id}*",
        ]
