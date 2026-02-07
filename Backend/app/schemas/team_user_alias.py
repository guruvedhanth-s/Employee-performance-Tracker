"""
Team User Alias Schemas
Pydantic schemas for team-specific user aliases (FA names)
"""
from pydantic import BaseModel, Field, ConfigDict
from typing import Optional


# ============ Team User Alias Schemas ============
class TeamUserAliasBase(BaseModel):
    team_id: int = Field(..., alias="teamId")
    user_id: int = Field(..., alias="userId")
    fa_name: str = Field(..., max_length=200, alias="faName")
    
    model_config = ConfigDict(populate_by_name=True)


class TeamUserAliasCreate(TeamUserAliasBase):
    pass


class TeamUserAliasUpdate(BaseModel):
    fa_name: Optional[str] = Field(None, max_length=200, alias="faName")
    is_active: Optional[bool] = Field(None, alias="isActive")
    
    model_config = ConfigDict(populate_by_name=True)


class TeamUserAliasResponse(TeamUserAliasBase):
    id: int
    is_active: bool = Field(alias="isActive")
    
    # Optional enriched data
    user_name: Optional[str] = Field(None, alias="userName")
    team_name: Optional[str] = Field(None, alias="teamName")
    
    model_config = ConfigDict(from_attributes=True, populate_by_name=True)


class TeamUserAliasListResponse(BaseModel):
    items: list[TeamUserAliasResponse]
    total: int


# ============ Schemas for Order Creation ============
class UserAliasOption(BaseModel):
    """User with their FA name for dropdown selection during order creation"""
    user_id: int = Field(..., alias="userId")
    user_name: str = Field(..., alias="userName")  # Real username
    fa_name: str = Field(..., alias="faName")  # FA/masked name
    
    model_config = ConfigDict(populate_by_name=True)
