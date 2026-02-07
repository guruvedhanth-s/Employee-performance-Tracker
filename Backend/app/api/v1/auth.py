"""
Authentication API Routes
Login, logout, token refresh, password management with session management
"""
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
import uuid

from app.database import get_db
from app.models.user import User
from app.models.password_reset import PasswordResetToken
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_token_expiry
)
from app.core.dependencies import get_current_active_user, security
from app.services.session_service import session_service
from app.schemas.user import (
    LoginRequest,
    LoginResponse,
    RefreshTokenRequest,
    RefreshTokenResponse,
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    UserResponse,
    SessionResponse,
    SessionListResponse,
    RevokeSessionRequest,
    RevokeAllSessionsResponse
)

router = APIRouter()


@router.post("/login")
async def login(request: LoginRequest, req: Request, db: Session = Depends(get_db)):
    """
    Authenticate user and return tokens with session management
    
    Features:
    - Rate limiting (5 attempts per 15 minutes)
    - Login attempt tracking
    - Active session creation
    - Device and IP tracking
    """
    # Get client information
    client_ip = req.client.host if req.client else "Unknown"
    user_agent = req.headers.get("user-agent", "Unknown")
    
    # Create identifier for rate limiting (username + IP)
    rate_limit_identifier = f"{request.user_name}:{client_ip}"
    
    # Check if login is blocked due to too many failed attempts
    if session_service.is_login_blocked(rate_limit_identifier):
        remaining_time = session_service.get_login_block_ttl(rate_limit_identifier)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many failed login attempts. Please try again in {remaining_time} seconds."
        )
    
    # Find user by username
    user = db.query(User).filter(User.user_name == request.user_name).first()
    
    if not user:
        # Record failed attempt
        session_service.record_login_attempt(rate_limit_identifier, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if not verify_password(request.password, user.password_hash):
        # Record failed attempt
        session_service.record_login_attempt(rate_limit_identifier, success=False)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated"
        )
    
    # Successful login - clear failed attempts
    session_service.record_login_attempt(rate_limit_identifier, success=True)
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    db.refresh(user)
    
    # Generate unique JTIs for access and refresh tokens
    access_jti = str(uuid.uuid4())
    refresh_jti = str(uuid.uuid4())
    
    # Create tokens with version
    token_data = {
        "sub": str(user.id),
        "role": user.user_role,
        "userName": user.user_name,
        "orgId": user.org_id,
        "version": user.token_version
    }
    
    access_token = create_access_token(token_data, jti=access_jti)
    refresh_token = create_refresh_token(token_data, jti=refresh_jti)
    
    # Create session in Redis
    device_info = user_agent.split()[0] if user_agent != "Unknown" else "Unknown"
    session_service.create_session(
        user_id=user.id,
        jti=access_jti,
        device_info=device_info,
        ip_address=client_ip,
        user_agent=user_agent
    )
    
    # Return camelCase response directly
    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "tokenType": "bearer",
        "user": {
            "id": user.id,
            "userName": user.user_name,
            "employeeId": user.employee_id,
            "userRole": user.user_role,
            "orgId": user.org_id,
            "passwordLastChanged": user.password_last_changed.isoformat() if user.password_last_changed else None,
            "mustChangePassword": user.must_change_password if user.must_change_password else False,
            "lastLogin": user.last_login.isoformat() if user.last_login else None,
            "isActive": user.is_active,
            "createdAt": user.created_at.isoformat() if user.created_at else None,
            "modifiedAt": user.modified_at.isoformat() if user.modified_at else None
        }
    }


@router.post("/refresh")
async def refresh_token(request: RefreshTokenRequest, req: Request, db: Session = Depends(get_db)):
    """
    Refresh access token using refresh token with rotation
    
    Features:
    - One-time use refresh tokens
    - Automatic refresh token rotation
    - Detects token reuse (potential security breach)
    """
    payload = decode_token(request.refresh_token)
    
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    # Check token type
    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )
    
    # Extract JTI and check if already used (one-time use)
    jti = payload.get("jti")
    if jti and session_service.is_refresh_token_used(jti):
        # Token reuse detected - possible security breach
        # Invalidate all user tokens
        user_id = payload.get("sub")
        if user_id:
            session_service.revoke_all_user_sessions(int(user_id))
        
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has already been used. All sessions have been terminated for security."
        )
    
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )
    
    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive"
        )
    
    # Check token version
    token_version = payload.get("version", 0)
    if token_version != user.token_version:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been invalidated. Please login again."
        )
    
    # Mark old refresh token as used
    if jti:
        session_service.mark_refresh_token_used(jti)
    
    # Generate new JTIs
    new_access_jti = str(uuid.uuid4())
    new_refresh_jti = str(uuid.uuid4())
    
    # Get client information for session
    client_ip = req.client.host if req.client else "Unknown"
    user_agent = req.headers.get("user-agent", "Unknown")
    device_info = user_agent.split()[0] if user_agent != "Unknown" else "Unknown"
    
    # Create new tokens with rotation
    token_data = {
        "sub": str(user.id),
        "role": user.user_role,
        "userName": user.user_name,
        "orgId": user.org_id,
        "version": user.token_version
    }
    
    access_token = create_access_token(token_data, jti=new_access_jti)
    refresh_token = create_refresh_token(token_data, jti=new_refresh_jti)
    
    # Create new session for the new access token
    session_service.create_session(
        user_id=user.id,
        jti=new_access_jti,
        device_info=device_info,
        ip_address=client_ip,
        user_agent=user_agent
    )
    
    return {
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "tokenType": "bearer"
    }


@router.post("/logout")
async def logout(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    current_user: User = Depends(get_current_active_user)
):
    """
    Logout current user with proper session termination
    
    Features:
    - Blacklists current access token
    - Removes active session from Redis
    - Prevents token reuse
    """
    token = credentials.credentials
    payload = decode_token(token)
    
    if payload:
        jti = payload.get("jti")
        if jti:
            # Calculate remaining TTL for blacklist
            expiry = get_token_expiry(payload)
            if expiry:
                remaining_seconds = int((expiry - datetime.utcnow()).total_seconds())
                if remaining_seconds > 0:
                    # Blacklist the token
                    session_service.blacklist_token(jti, ttl=remaining_seconds)
            
            # Remove session
            session_service.revoke_session(current_user.id, jti)
    
    return {"message": "Successfully logged out"}


@router.get("/me")
async def get_current_user_info(current_user: User = Depends(get_current_active_user)):
    """Get current authenticated user's information"""
    return {
        "id": current_user.id,
        "userName": current_user.user_name,
        "employeeId": current_user.employee_id,
        "userRole": current_user.user_role,
        "orgId": current_user.org_id,
        "passwordLastChanged": current_user.password_last_changed.isoformat() if current_user.password_last_changed else None,
        "mustChangePassword": current_user.must_change_password if current_user.must_change_password else False,
        "lastLogin": current_user.last_login.isoformat() if current_user.last_login else None,
        "isActive": current_user.is_active,
        "createdAt": current_user.created_at.isoformat() if current_user.created_at else None,
        "modifiedAt": current_user.modified_at.isoformat() if current_user.modified_at else None
    }


@router.post("/change-password")
async def change_password(
    request: ChangePasswordRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Change current user's password with automatic token invalidation
    
    All users can change their own password by providing their current password.
    No approval workflow - password changes are immediate.
    
    Security Features:
    - Invalidates all existing tokens (increments token_version)
    - Revokes all active sessions
    - User must login again with new password
    """
    # Verify current password first
    if not verify_password(request.old_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect"
        )
    
    # Check if new password is same as current
    if verify_password(request.new_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be different from current password"
        )
    
    # Validate new password (minimum 8 characters)
    if len(request.new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters"
        )
    
    # Update password
    current_user.password_hash = get_password_hash(request.new_password)
    current_user.password_last_changed = datetime.utcnow()
    current_user.must_change_password = False  # Clear the flag if it was set
    current_user.modified_at = datetime.utcnow()
    
    # Increment token version to invalidate all existing tokens
    current_user.token_version += 1
    
    db.commit()
    
    # Revoke all user sessions in Redis
    revoked_count = session_service.revoke_all_user_sessions(current_user.id)
    
    return {
        "message": "Password changed successfully. All active sessions have been terminated. Please login again.",
        "sessionsRevoked": revoked_count
    }


@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request password reset"""
    import secrets
    
    user = db.query(User).filter(User.user_name == request.user_name).first()
    
    if not user:
        return {"message": "If the username exists, a reset link will be sent"}
    
    # Generate reset token
    token = secrets.token_urlsafe(32)
    token_hash = get_password_hash(token)
    
    reset_token = PasswordResetToken(
        user_id=user.id,
        token=token_hash,
        expires_at=datetime.utcnow() + timedelta(hours=1)
    )
    
    db.add(reset_token)
    db.commit()
    
    # TODO: Send email with reset link
    return {
        "message": "If the username exists, a reset link will be sent",
        "token": token  # Remove in production
    }


@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password using reset token"""
    reset_tokens = db.query(PasswordResetToken).filter(
        PasswordResetToken.expires_at > datetime.utcnow(),
        PasswordResetToken.used_at.is_(None)
    ).all()
    
    valid_token = None
    for rt in reset_tokens:
        if verify_password(request.token, rt.token):
            valid_token = rt
            break
    
    if not valid_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token"
        )
    
    user = db.query(User).filter(User.id == valid_token.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    user.password_hash = get_password_hash(request.new_password)
    user.password_last_changed = datetime.utcnow()
    user.modified_at = datetime.utcnow()
    valid_token.used_at = datetime.utcnow()
    
    db.commit()
    
    return {"message": "Password reset successfully"}


# ============ Session Management Endpoints ============

@router.get("/sessions", response_model=SessionListResponse)
async def get_active_sessions(current_user: User = Depends(get_current_active_user)):
    """
    Get all active sessions for the current user
    
    Returns list of all active sessions with device info, IP, and last activity
    """
    sessions = session_service.get_user_sessions(current_user.id)
    
    return {
        "sessions": sessions,
        "total": len(sessions)
    }


@router.delete("/sessions/{session_id}")
async def revoke_specific_session(
    session_id: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Revoke a specific session (logout from specific device)
    
    Args:
        session_id: Session ID to revoke
    
    Returns:
        Success message
    """
    # Verify session belongs to current user
    session = session_service.get_session(current_user.id, session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found"
        )
    
    # Revoke the session
    success = session_service.revoke_session(current_user.id, session_id)
    
    if success:
        return {"message": "Session revoked successfully"}
    else:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to revoke session"
        )


@router.delete("/sessions", response_model=RevokeAllSessionsResponse)
async def revoke_all_sessions(
    current_user: User = Depends(get_current_active_user)
):
    """
    Revoke all sessions except current one (logout from all other devices)
    
    Note: This will invalidate all tokens, requiring login on all devices
    """
    # Revoke all sessions
    revoked_count = session_service.revoke_all_user_sessions(current_user.id)
    
    return {
        "message": f"All {revoked_count} sessions have been revoked. You will need to login again on all devices.",
        "sessionsRevoked": revoked_count
    }
