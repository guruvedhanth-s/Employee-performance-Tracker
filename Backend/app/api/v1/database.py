"""
Database reset API endpoint
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.user import User, UserRole
from app.core.security import get_password_hash
from app.models.organization import Organization
from app.models.team import Team
from app.database import Base
from app.core.dependencies import get_current_active_user
from sqlalchemy import text

router = APIRouter()

@router.post("/reset-database")
async def reset_database(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    """
    Reset the entire database (Super Admin only)
    Drops all tables and recreates them with initial data
    """
    # Only superadmin can reset database
    if current_user.role != UserRole.SUPERADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only superadmin can reset the database"
        )
    
    try:
        # Drop all tables
        Base.metadata.drop_all(bind=db.get_bind())
        
        # Recreate all tables
        Base.metadata.create_all(bind=db.get_bind())
        
        # Create initial data
        await create_initial_data(db)
        
        # Reset sequences
        await reset_sequences(db)
        
        return {
            "message": "Database reset successfully",
            "details": {
                "organizations": 2,
                "admin_users": 3,
                "teams": 5
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database reset failed: {str(e)}"
        )

async def create_initial_data(db: Session):
    """Create initial organizations and users"""
    
    # Create organizations
    ods_ind = Organization(
        name="ODS - IND",
        code="ODS-IND",
        description="ODS India Operations",
        is_active=True
    )
    db.add(ods_ind)
    
    ods_vnm = Organization(
        name="ODS - VNM", 
        code="ODS-VNM",
        description="ODS Vietnam Operations",
        is_active=True
    )
    db.add(ods_vnm)
    
    db.commit()
    
    # Create users
    super_admin = User(
        email="superadmin@ods.com",
        employee_id="SA001",
        first_name="Super",
        last_name="Administrator",
        hashed_password=get_password_hash("admin123"),
        role=UserRole.SUPERADMIN,
        organization_id=None,  # Super admin doesn't need organization
        unit_name="ODS-SUPER",
        is_active=True
    )
    db.add(super_admin)
    
    india_admin = User(
        email="india_admin@ods.com",
        employee_id="IA001",
        first_name="India",
        last_name="Administrator",
        hashed_password=get_password_hash("admin123"),
        role=UserRole.ADMIN,
        organization_id=ods_ind.id,
        unit_name="ODS-IND",
        is_active=True
    )
    db.add(india_admin)
    
    vietnam_admin = User(
        email="vietnam_admin@ods.com",
        employee_id="VA001",
        first_name="Vietnam",
        last_name="Administrator",
        hashed_password=get_password_hash("admin123"),
        role=UserRole.ADMIN,
        organization_id=ods_vnm.id,
        unit_name="ODS-VNM",
        is_active=True
    )
    db.add(vietnam_admin)
    
    db.commit()
    
    # Create teams
    india_teams = [
        {"name": "Florida Team"},
        {"name": "California Team"},
        {"name": "GI Clearing Team"}
    ]
    
    for team_data in india_teams:
        team = Team(
            organization_id=ods_ind.id,
            name=team_data["name"],
            is_active=True
        )
        db.add(team)
    
    vietnam_teams = [
        {"name": "Vietnam Team A"},
        {"name": "Vietnam Team B"}
    ]
    
    for team_data in vietnam_teams:
        team = Team(
            organization_id=ods_vnm.id,
            name=team_data["name"],
            is_active=True
        )
        db.add(team)
    
    db.commit()

async def reset_sequences(db: Session):
    """Reset auto-increment sequences"""
    tables_with_sequences = [
        'organizations', 'users', 'teams', 'team_states', 'team_products',
        'transaction_types', 'process_types', 'order_status', 'divisions',
        'orders', 'order_history', 'employee_performance_metrics',
        'team_performance_metrics', 'user_teams', 'password_reset_tokens'
    ]
    
    for table in tables_with_sequences:
        try:
            # Reset sequence for SQLite
            db.execute(text(f"DELETE FROM sqlite_sequence WHERE name='{table}'"))
        except:
            pass  # Ignore if table doesn't have sequence