"""
Script to initialize the database with tables and test users
"""
from app.database import engine, SessionLocal
from app.models.user import Base, User, UserRole
from app.core.security import get_password_hash

def init_db():
    """Create all database tables"""
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("[OK] Database tables created successfully!")

def create_test_users():
    """Create test users for each role"""
    db = SessionLocal()
    try:
        # Check if users already exist
        existing_users = db.query(User).count()
        if existing_users > 0:
            print(f"[OK] Database already has {existing_users} users. Skipping user creation.")
            return

        print("\nCreating test users...")
        
        # Test user passwords
        passwords = {
            "admin": "admin123",
            "lead": "lead123",
            "emp": "emp123"
        }
        
        # Admin user
        admin = User(
            user_name="admin",
            employee_id="EMP001",
            password_hash=get_password_hash(passwords["admin"]),
            user_role=UserRole.ADMIN,
            is_active=True
        )
        db.add(admin)
        print(f"[OK] Created admin user: admin / {passwords['admin']}")

        # Team lead user
        teamlead = User(
            user_name="teamlead",
            employee_id="EMP002",
            password_hash=get_password_hash(passwords["lead"]),
            user_role=UserRole.TEAM_LEAD,
            is_active=True
        )
        db.add(teamlead)
        print(f"[OK] Created team lead user: teamlead / {passwords['lead']}")

        # Employee user
        employee = User(
            user_name="employee",
            employee_id="EMP003",
            password_hash=get_password_hash(passwords["emp"]),
            user_role=UserRole.EMPLOYEE,
            is_active=True
        )
        db.add(employee)
        print(f"[OK] Created employee user: employee / {passwords['emp']}")

        db.commit()
        print("\n[SUCCESS] Test users created successfully!")
        print("\nYou can now login with:")
        print(f"  Admin:     admin / {passwords['admin']}")
        print(f"  Team Lead: teamlead / {passwords['lead']}")
        print(f"  Employee:  employee / {passwords['emp']}")

    except Exception as e:
        print(f"\n[ERROR] Error creating test users: {e}")
        import traceback
        traceback.print_exc()
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    print("=" * 60)
    print("Database Initialization Script")
    print("=" * 60)
    
    init_db()
    create_test_users()
    
    print("\n" + "=" * 60)
    print("[SUCCESS] Database initialization complete!")
    print("=" * 60)
