"""
Redis-based Session and Token Management Service
Provides token blacklisting, active session tracking, rate limiting, and refresh token rotation
"""
import json
import redis
import uuid
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)


class SessionService:
    """Redis-based session and token management service"""
    
    # Cache key prefixes for session management
    PREFIX_BLACKLIST = "token:blacklist"
    PREFIX_SESSION = "session"
    PREFIX_REFRESH_USED = "refresh:used"
    PREFIX_RATE_LIMIT = "rate:limit"
    PREFIX_LOGIN_ATTEMPTS = "login:attempts"
    
    # TTL constants (in seconds)
    TTL_ACCESS_TOKEN = 60 * 60  # 1 hour - matches ACCESS_TOKEN_EXPIRE_MINUTES
    TTL_REFRESH_TOKEN = 60 * 60 * 24 * 30  # 30 days - matches REFRESH_TOKEN_EXPIRE_DAYS
    TTL_RATE_LIMIT = 60  # 1 minute
    TTL_LOGIN_ATTEMPTS = 60 * 15  # 15 minutes
    
    # Rate limiting settings
    MAX_REQUESTS_PER_MINUTE = 60
    MAX_LOGIN_ATTEMPTS = 5
    
    _instance: Optional['SessionService'] = None
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
            logger.info("Redis session service connection established successfully")
        except redis.ConnectionError as e:
            logger.error(f"Failed to connect to Redis: {e}. Session management disabled.")
            self._redis_client = None
        except Exception as e:
            logger.error(f"Redis error: {e}. Session management disabled.")
            self._redis_client = None
    
    @property
    def is_connected(self) -> bool:
        """Check if Redis is connected"""
        if self._redis_client is None:
            return False
        try:
            self._redis_client.ping()
            return True
        except:
            return False
    
    def _build_key(self, prefix: str, *args) -> str:
        """Build a cache key from prefix and arguments"""
        parts = [prefix] + [str(arg) for arg in args if arg is not None]
        return ":".join(parts)
    
    # ============ Token Blacklist Management ============
    
    def blacklist_token(self, jti: str, ttl: Optional[int] = None) -> bool:
        """
        Add a token to the blacklist (for logout or token invalidation)
        
        Args:
            jti: Token unique identifier (JWT ID)
            ttl: Time to live in seconds (defaults to access token expiry)
        
        Returns:
            True if successful, False otherwise
        """
        if not self.is_connected:
            logger.warning("Redis not connected. Cannot blacklist token.")
            return False
        
        try:
            key = self._build_key(self.PREFIX_BLACKLIST, jti)
            ttl = ttl or self.TTL_ACCESS_TOKEN
            self._redis_client.setex(key, ttl, "revoked")
            logger.info(f"Token {jti} blacklisted successfully")
            return True
        except Exception as e:
            logger.error(f"Error blacklisting token {jti}: {e}")
            return False
    
    def is_token_blacklisted(self, jti: str) -> bool:
        """
        Check if a token is blacklisted
        
        Args:
            jti: Token unique identifier
        
        Returns:
            True if token is blacklisted, False otherwise
        """
        if not self.is_connected:
            return False
        
        try:
            key = self._build_key(self.PREFIX_BLACKLIST, jti)
            return self._redis_client.exists(key) > 0
        except Exception as e:
            logger.error(f"Error checking token blacklist for {jti}: {e}")
            return False
    
    # ============ Active Session Management ============
    
    def create_session(
        self,
        user_id: int,
        jti: str,
        device_info: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> str:
        """
        Create a new active session
        
        Args:
            user_id: User ID
            jti: Token unique identifier
            device_info: Device information
            ip_address: Client IP address
            user_agent: User agent string
        
        Returns:
            Session ID
        """
        if not self.is_connected:
            logger.warning("Redis not connected. Cannot create session.")
            return jti  # Return JTI as fallback
        
        try:
            session_id = jti  # Use JTI as session ID for consistency
            key = self._build_key(self.PREFIX_SESSION, user_id, session_id)
            
            session_data = {
                "session_id": session_id,
                "user_id": user_id,
                "jti": jti,
                "device_info": device_info or "Unknown",
                "ip_address": ip_address or "Unknown",
                "user_agent": user_agent or "Unknown",
                "created_at": datetime.utcnow().isoformat(),
                "last_activity": datetime.utcnow().isoformat()
            }
            
            serialized = json.dumps(session_data, default=str)
            self._redis_client.setex(key, self.TTL_ACCESS_TOKEN, serialized)
            logger.info(f"Session {session_id} created for user {user_id}")
            return session_id
        except Exception as e:
            logger.error(f"Error creating session for user {user_id}: {e}")
            return jti
    
    def get_session(self, user_id: int, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get session data
        
        Args:
            user_id: User ID
            session_id: Session ID
        
        Returns:
            Session data or None
        """
        if not self.is_connected:
            return None
        
        try:
            key = self._build_key(self.PREFIX_SESSION, user_id, session_id)
            data = self._redis_client.get(key)
            if data:
                return json.loads(data)
            return None
        except Exception as e:
            logger.error(f"Error getting session {session_id} for user {user_id}: {e}")
            return None
    
    def update_session_activity(self, user_id: int, session_id: str) -> bool:
        """
        Update session last activity timestamp and extend TTL
        
        Args:
            user_id: User ID
            session_id: Session ID
        
        Returns:
            True if successful, False otherwise
        """
        if not self.is_connected:
            return False
        
        try:
            session = self.get_session(user_id, session_id)
            if session:
                session["last_activity"] = datetime.utcnow().isoformat()
                key = self._build_key(self.PREFIX_SESSION, user_id, session_id)
                serialized = json.dumps(session, default=str)
                self._redis_client.setex(key, self.TTL_ACCESS_TOKEN, serialized)
                return True
            return False
        except Exception as e:
            logger.error(f"Error updating session activity {session_id}: {e}")
            return False
    
    def get_user_sessions(self, user_id: int) -> List[Dict[str, Any]]:
        """
        Get all active sessions for a user
        
        Args:
            user_id: User ID
        
        Returns:
            List of session data dictionaries
        """
        if not self.is_connected:
            return []
        
        try:
            pattern = self._build_key(self.PREFIX_SESSION, user_id, "*")
            keys = self._redis_client.keys(pattern)
            sessions = []
            
            for key in keys:
                data = self._redis_client.get(key)
                if data:
                    session = json.loads(data)
                    # Add TTL information
                    ttl = self._redis_client.ttl(key)
                    session["expires_in_seconds"] = ttl
                    sessions.append(session)
            
            # Sort by creation time (newest first)
            sessions.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return sessions
        except Exception as e:
            logger.error(f"Error getting sessions for user {user_id}: {e}")
            return []
    
    def revoke_session(self, user_id: int, session_id: str) -> bool:
        """
        Revoke a specific session (logout from specific device)
        
        Args:
            user_id: User ID
            session_id: Session ID
        
        Returns:
            True if successful, False otherwise
        """
        if not self.is_connected:
            return False
        
        try:
            # Get session to extract JTI
            session = self.get_session(user_id, session_id)
            if session:
                jti = session.get("jti")
                if jti:
                    # Blacklist the token
                    self.blacklist_token(jti)
            
            # Delete the session
            key = self._build_key(self.PREFIX_SESSION, user_id, session_id)
            self._redis_client.delete(key)
            logger.info(f"Session {session_id} revoked for user {user_id}")
            return True
        except Exception as e:
            logger.error(f"Error revoking session {session_id} for user {user_id}: {e}")
            return False
    
    def revoke_all_user_sessions(self, user_id: int) -> int:
        """
        Revoke all sessions for a user (logout from all devices)
        
        Args:
            user_id: User ID
        
        Returns:
            Number of sessions revoked
        """
        if not self.is_connected:
            return 0
        
        try:
            sessions = self.get_user_sessions(user_id)
            count = 0
            
            # Blacklist all tokens
            for session in sessions:
                jti = session.get("jti")
                if jti:
                    self.blacklist_token(jti)
                count += 1
            
            # Delete all session keys
            pattern = self._build_key(self.PREFIX_SESSION, user_id, "*")
            keys = self._redis_client.keys(pattern)
            if keys:
                self._redis_client.delete(*keys)
            
            logger.info(f"All {count} sessions revoked for user {user_id}")
            return count
        except Exception as e:
            logger.error(f"Error revoking all sessions for user {user_id}: {e}")
            return 0
    
    # ============ Refresh Token Rotation ============
    
    def mark_refresh_token_used(self, jti: str) -> bool:
        """
        Mark a refresh token as used (for one-time use enforcement)
        
        Args:
            jti: Refresh token unique identifier
        
        Returns:
            True if successful, False otherwise
        """
        if not self.is_connected:
            return False
        
        try:
            key = self._build_key(self.PREFIX_REFRESH_USED, jti)
            self._redis_client.setex(key, self.TTL_REFRESH_TOKEN, "used")
            logger.info(f"Refresh token {jti} marked as used")
            return True
        except Exception as e:
            logger.error(f"Error marking refresh token {jti} as used: {e}")
            return False
    
    def is_refresh_token_used(self, jti: str) -> bool:
        """
        Check if a refresh token has already been used
        
        Args:
            jti: Refresh token unique identifier
        
        Returns:
            True if token was already used, False otherwise
        """
        if not self.is_connected:
            return False
        
        try:
            key = self._build_key(self.PREFIX_REFRESH_USED, jti)
            return self._redis_client.exists(key) > 0
        except Exception as e:
            logger.error(f"Error checking refresh token usage {jti}: {e}")
            return False
    
    # ============ Rate Limiting ============
    
    def check_rate_limit(self, identifier: str, max_requests: Optional[int] = None, window: Optional[int] = None) -> bool:
        """
        Check if rate limit is exceeded
        
        Args:
            identifier: Unique identifier (IP address, user ID, etc.)
            max_requests: Maximum requests allowed (defaults to MAX_REQUESTS_PER_MINUTE)
            window: Time window in seconds (defaults to TTL_RATE_LIMIT)
        
        Returns:
            True if under limit, False if exceeded
        """
        if not self.is_connected:
            return True  # Allow if Redis is down
        
        try:
            max_requests = max_requests or self.MAX_REQUESTS_PER_MINUTE
            window = window or self.TTL_RATE_LIMIT
            
            key = self._build_key(self.PREFIX_RATE_LIMIT, identifier)
            current = self._redis_client.get(key)
            
            if current is None:
                # First request in window
                self._redis_client.setex(key, window, 1)
                return True
            
            count = int(current)
            if count >= max_requests:
                logger.warning(f"Rate limit exceeded for {identifier}")
                return False
            
            # Increment counter
            self._redis_client.incr(key)
            return True
        except Exception as e:
            logger.error(f"Error checking rate limit for {identifier}: {e}")
            return True  # Allow on error
    
    def increment_rate_limit(self, identifier: str, window: Optional[int] = None) -> int:
        """
        Increment rate limit counter
        
        Args:
            identifier: Unique identifier
            window: Time window in seconds
        
        Returns:
            Current count
        """
        if not self.is_connected:
            return 0
        
        try:
            window = window or self.TTL_RATE_LIMIT
            key = self._build_key(self.PREFIX_RATE_LIMIT, identifier)
            
            if not self._redis_client.exists(key):
                self._redis_client.setex(key, window, 1)
                return 1
            
            return self._redis_client.incr(key)
        except Exception as e:
            logger.error(f"Error incrementing rate limit for {identifier}: {e}")
            return 0
    
    # ============ Login Attempt Tracking ============
    
    def record_login_attempt(self, identifier: str, success: bool) -> int:
        """
        Record a login attempt
        
        Args:
            identifier: Unique identifier (username, IP, etc.)
            success: Whether login was successful
        
        Returns:
            Number of failed attempts in current window
        """
        if not self.is_connected:
            return 0
        
        try:
            key = self._build_key(self.PREFIX_LOGIN_ATTEMPTS, identifier)
            
            if success:
                # Clear failed attempts on successful login
                self._redis_client.delete(key)
                return 0
            
            # Increment failed attempts
            if not self._redis_client.exists(key):
                self._redis_client.setex(key, self.TTL_LOGIN_ATTEMPTS, 1)
                return 1
            
            count = self._redis_client.incr(key)
            return count
        except Exception as e:
            logger.error(f"Error recording login attempt for {identifier}: {e}")
            return 0
    
    def get_login_attempts(self, identifier: str) -> int:
        """
        Get number of failed login attempts
        
        Args:
            identifier: Unique identifier
        
        Returns:
            Number of failed attempts
        """
        if not self.is_connected:
            return 0
        
        try:
            key = self._build_key(self.PREFIX_LOGIN_ATTEMPTS, identifier)
            count = self._redis_client.get(key)
            return int(count) if count else 0
        except Exception as e:
            logger.error(f"Error getting login attempts for {identifier}: {e}")
            return 0
    
    def is_login_blocked(self, identifier: str) -> bool:
        """
        Check if login is blocked due to too many failed attempts
        
        Args:
            identifier: Unique identifier
        
        Returns:
            True if blocked, False otherwise
        """
        attempts = self.get_login_attempts(identifier)
        return attempts >= self.MAX_LOGIN_ATTEMPTS
    
    def get_login_block_ttl(self, identifier: str) -> int:
        """
        Get remaining seconds until login block expires
        
        Args:
            identifier: Unique identifier
        
        Returns:
            Seconds remaining, or 0 if not blocked
        """
        if not self.is_connected:
            return 0
        
        try:
            if not self.is_login_blocked(identifier):
                return 0
            
            key = self._build_key(self.PREFIX_LOGIN_ATTEMPTS, identifier)
            ttl = self._redis_client.ttl(key)
            return max(0, ttl)
        except Exception as e:
            logger.error(f"Error getting login block TTL for {identifier}: {e}")
            return 0


# Global session service instance
session_service = SessionService()
