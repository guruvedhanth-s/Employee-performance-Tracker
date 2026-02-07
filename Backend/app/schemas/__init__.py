"""
Schemas Package
Export all Pydantic schemas for easy importing
"""
# Reference tables
from app.schemas.reference import (
    TransactionTypeBase, TransactionTypeCreate, TransactionTypeUpdate, TransactionTypeResponse,
    ProcessTypeBase, ProcessTypeCreate, ProcessTypeUpdate, ProcessTypeResponse,
    OrderStatusBase, OrderStatusCreate, OrderStatusUpdate, OrderStatusResponse,
    DivisionBase, DivisionCreate, DivisionUpdate, DivisionResponse
)

# Organization
from app.schemas.organization import (
    OrganizationBase, OrganizationCreate, OrganizationUpdate, OrganizationResponse, OrganizationListResponse
)

# User and Auth
from app.schemas.user import (
    UserBase, UserCreate, UserUpdate, UserResponse, UserWithTeamsResponse, UserListResponse,
    LoginRequest, LoginResponse,
    RefreshTokenRequest, RefreshTokenResponse,
    ChangePasswordRequest, ForgotPasswordRequest, ResetPasswordRequest,
    TokenPayload, TeamMembershipResponse
)

# Team
from app.schemas.team import (
    TeamStateBase, TeamStateCreate, TeamStateResponse,
    TeamProductBase, TeamProductCreate, TeamProductResponse,
    TeamBase, TeamCreate, TeamUpdate, TeamResponse, TeamSimpleResponse, TeamListResponse,
    UserTeamBase, UserTeamCreate, UserTeamUpdate, UserTeamResponse,
    TeamMemberResponse, TeamWithMembersResponse
)

# Order
from app.schemas.order import (
    OrderBase, OrderCreate, OrderUpdate, OrderResponse, OrderSimpleResponse, OrderListResponse,
    StepInfo, ReferenceTypeInfo, OrderFilterParams
)

# Order History
from app.schemas.order_history import (
    OrderHistoryBase, OrderHistoryCreate, OrderHistoryResponse, OrderHistoryListResponse
)

# Metrics
from app.schemas.metrics import (
    EmployeeMetricsBase, EmployeeMetricsCreate, EmployeeMetricsResponse, EmployeeMetricsListResponse,
    TeamMetricsBase, TeamMetricsCreate, TeamMetricsResponse, TeamMetricsListResponse,
    DashboardStats, MetricsFilterParams
)

__all__ = [
    # Reference
    "TransactionTypeBase", "TransactionTypeCreate", "TransactionTypeUpdate", "TransactionTypeResponse",
    "ProcessTypeBase", "ProcessTypeCreate", "ProcessTypeUpdate", "ProcessTypeResponse",
    "OrderStatusBase", "OrderStatusCreate", "OrderStatusUpdate", "OrderStatusResponse",
    "DivisionBase", "DivisionCreate", "DivisionUpdate", "DivisionResponse",
    # Organization
    "OrganizationBase", "OrganizationCreate", "OrganizationUpdate", "OrganizationResponse", "OrganizationListResponse",
    # User
    "UserBase", "UserCreate", "UserUpdate", "UserResponse", "UserWithTeamsResponse", "UserListResponse",
    "LoginRequest", "LoginResponse",
    "RefreshTokenRequest", "RefreshTokenResponse",
    "ChangePasswordRequest", "ForgotPasswordRequest", "ResetPasswordRequest",
    "TokenPayload", "TeamMembershipResponse",
    # Team
    "TeamStateBase", "TeamStateCreate", "TeamStateResponse",
    "TeamProductBase", "TeamProductCreate", "TeamProductResponse",
    "TeamBase", "TeamCreate", "TeamUpdate", "TeamResponse", "TeamSimpleResponse", "TeamListResponse",
    "UserTeamBase", "UserTeamCreate", "UserTeamUpdate", "UserTeamResponse",
    "TeamMemberResponse", "TeamWithMembersResponse",
    # Order
    "OrderBase", "OrderCreate", "OrderUpdate", "OrderResponse", "OrderSimpleResponse", "OrderListResponse",
    "StepInfo", "ReferenceTypeInfo", "OrderFilterParams",
    # Order History
    "OrderHistoryBase", "OrderHistoryCreate", "OrderHistoryResponse", "OrderHistoryListResponse",
    # Metrics
    "EmployeeMetricsBase", "EmployeeMetricsCreate", "EmployeeMetricsResponse", "EmployeeMetricsListResponse",
    "TeamMetricsBase", "TeamMetricsCreate", "TeamMetricsResponse", "TeamMetricsListResponse",
    "DashboardStats", "MetricsFilterParams"
]
