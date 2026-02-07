"""
Production Migration Script for ODS
===================================

This script prepares the database for production by:
1. Removing all demo/test data and orders
2. Keeping minimal production users (1 superadmin, 2 org admins, few employees)
3. Keeping all teams but removing team-user associations
4. Keeping FA names as-is
5. Removing all metrics, audits, and related data

DANGER: This script will DELETE most data from the database!
Only run this once before going to production.

Usage:
    python migrate_to_production.py [--dry-run]
    
    --dry-run: Show what would be deleted without actually deleting
"""

import sys
import argparse
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.database import get_db_url
from app.models.user import User
from app.models.organization import Organization
from app.models.team import Team
from app.models.order import Order
from app.models.metrics import EmployeePerformanceMetrics, TeamPerformanceMetrics
from app.models.quality_audit import QualityAudit
from app.models.billing import BillingReport, BillingDetail
from app.models.employee_weekly_target import EmployeeWeeklyTarget
from app.models.attendance import AttendanceRecord
from app.models.order_history import OrderHistory
from app.models.user_team import UserTeam
from app.models.team_user_alias import TeamUserAlias
from app.models.audit_log import AttendanceAuditLog
from app.core.security import get_password_hash

def create_session():
    """Create database session"""
    engine = create_engine(get_db_url())
    SessionLocal = sessionmaker(bind=engine)
    return SessionLocal()

def get_production_users():
    """Define which users to keep for production"""
    return {
        'superadmin': {
            'user_name': 'superadmin',
            'password': 'Admin@123',  # Change this after first login!
            'user_role': 'superadmin',
            'org_id': None,
            'employee_id': 'SA001'
        },
        'admin_vnm': {
            'user_name': 'admin.vnm',
            'password': 'Admin@123',  # Change this after first login!
            'user_role': 'admin',
            'org_code': 'VNM',
            'employee_id': 'VNM-ADM001'
        },
        'admin_ind': {
            'user_name': 'admin.ind',
            'password': 'Admin@123',  # Change this after first login!
            'user_role': 'admin',
            'org_code': 'IND',
            'employee_id': 'IND-ADM001'
        },
        # Vietnam employees
        'emp1_vnm': {
            'user_name': 'emp1.vnm',
            'password': 'Emp@123',  # Change this after first login!
            'user_role': 'employee',
            'org_code': 'VNM',
            'employee_id': 'VNM-EMP001'
        },
        'emp2_vnm': {
            'user_name': 'emp2.vnm',
            'password': 'Emp@123',  # Change this after first login!
            'user_role': 'employee',
            'org_code': 'VNM',
            'employee_id': 'VNM-EMP002'
        },
        # India employees
        'emp1_ind': {
            'user_name': 'emp1.ind',
            'password': 'Emp@123',  # Change this after first login!
            'user_role': 'employee',
            'org_code': 'IND',
            'employee_id': 'IND-EMP001'
        },
        'emp2_ind': {
            'user_name': 'emp2.ind',
            'password': 'Emp@123',  # Change this after first login!
            'user_role': 'employee',
            'org_code': 'IND',
            'employee_id': 'IND-EMP002'
        }
    }

def count_records(db, model):
    """Count total records in a table"""
    return db.query(model).count()

def migrate_to_production(dry_run=False):
    """Main migration function"""
    db = create_session()
    
    try:
        print("=" * 80)
        print("ODS PRODUCTION MIGRATION SCRIPT")
        print("=" * 80)
        
        if dry_run:
            print("\n🔍 DRY RUN MODE - No changes will be made\n")
        else:
            print("\n⚠️  LIVE MODE - Database will be modified!\n")
            response = input("Are you sure you want to continue? (type 'YES' to proceed): ")
            if response != 'YES':
                print("❌ Migration cancelled.")
                return
        
        print("\n" + "=" * 80)
        print("STEP 1: Analyzing Current Database")
        print("=" * 80)
        
        # Count current records
        counts = {
            'Users': count_records(db, User),
            'Organizations': count_records(db, Organization),
            'Teams': count_records(db, Team),
            'Orders': count_records(db, Order),
            'Order History': count_records(db, OrderHistory),
            'User-Team Associations': count_records(db, UserTeam),
            'Team User Aliases': count_records(db, TeamUserAlias),
            'Employee Metrics': count_records(db, EmployeePerformanceMetrics),
            'Team Metrics': count_records(db, TeamPerformanceMetrics),
            'Quality Audits': count_records(db, QualityAudit),
            'Billing Reports': count_records(db, BillingReport),
            'Billing Details': count_records(db, BillingDetail),
            'Weekly Targets': count_records(db, EmployeeWeeklyTarget),
            'Attendance Records': count_records(db, AttendanceRecord),
            'Attendance Audit Logs': count_records(db, AttendanceAuditLog)
        }
        
        for name, count in counts.items():
            print(f"  {name}: {count}")
        
        if dry_run:
            print("\n" + "=" * 80)
            print("STEP 2: What Would Be Deleted (DRY RUN)")
            print("=" * 80)
            print("\n✗ All Orders and Order History")
            print(f"  - {counts['Orders']} orders")
            print(f"  - {counts['Order History']} order history entries")
            print("\n✗ All User-Team Associations and Aliases")
            print(f"  - {counts['User-Team Associations']} user-team associations")
            print(f"  - {counts['Team User Aliases']} team user aliases")
            print("\n✗ All Metrics and Performance Data")
            print(f"  - {counts['Employee Metrics']} employee metrics")
            print(f"  - {counts['Team Metrics']} team metrics")
            print("\n✗ All Quality Audits")
            print(f"  - {counts['Quality Audits']} quality audits")
            print("\n✗ All Billing Data")
            print(f"  - {counts['Billing Reports']} billing reports")
            print(f"  - {counts['Billing Details']} billing details")
            print("\n✗ All Weekly Targets and Attendance")
            print(f"  - {counts['Weekly Targets']} weekly targets")
            print(f"  - {counts['Attendance Records']} attendance records")
            print(f"  - {counts['Attendance Audit Logs']} attendance audit logs")
            print(f"\n✗ Most Users (keeping only {len(get_production_users())} production users)")
            print(f"  - Deleting {counts['Users'] - len(get_production_users())} users")
            
            print("\n✓ What Would Be Kept:")
            print("  - All Organizations (2)")
            print("  - All Teams (structure only, no members)")
            print("  - All FA Names")
            print("  - All Reference Data (Transaction Types, Process Types, etc.)")
            print(f"  - {len(get_production_users())} Production Users:")
            for key, user_data in get_production_users().items():
                print(f"    • {user_data['user_name']} ({user_data['user_role']})")
            
            print("\n💡 To actually perform the migration, run without --dry-run flag")
            return
        
        print("\n" + "=" * 80)
        print("STEP 2: Deleting Records")
        print("=" * 80)
        
        # Step 2.1: Delete all orders and related data
        print("\n📦 Deleting Orders and Order History...")
        db.query(OrderHistory).delete()
        db.query(Order).delete()
        db.commit()
        print(f"  ✓ Deleted {counts['Orders']} orders and {counts['Order History']} history entries")
        
        # Step 2.2: Delete all metrics
        print("\n📊 Deleting Metrics...")
        db.query(EmployeePerformanceMetrics).delete()
        db.query(TeamPerformanceMetrics).delete()
        db.commit()
        print(f"  ✓ Deleted {counts['Employee Metrics']} employee metrics")
        print(f"  ✓ Deleted {counts['Team Metrics']} team metrics")
        
        # Step 2.3: Delete quality audits
        print("\n🎯 Deleting Quality Audits...")
        db.query(QualityAudit).delete()
        db.commit()
        print(f"  ✓ Deleted {counts['Quality Audits']} quality audits")
        
        # Step 2.4: Delete billing data
        print("\n💰 Deleting Billing Data...")
        db.query(BillingDetail).delete()
        db.query(BillingReport).delete()
        db.commit()
        print(f"  ✓ Deleted {counts['Billing Reports']} billing reports")
        print(f"  ✓ Deleted {counts['Billing Details']} billing details")
        
        # Step 2.5: Delete weekly targets and attendance
        print("\n📅 Deleting Weekly Targets and Attendance...")
        db.query(EmployeeWeeklyTarget).delete()
        db.query(AttendanceAuditLog).delete()
        db.query(AttendanceRecord).delete()
        db.commit()
        print(f"  ✓ Deleted {counts['Weekly Targets']} weekly targets")
        print(f"  ✓ Deleted {counts['Attendance Records']} attendance records")
        print(f"  ✓ Deleted {counts['Attendance Audit Logs']} attendance audit logs")
        
        # Step 2.6: Delete all user-team associations and aliases
        print("\n👥 Deleting User-Team Associations...")
        db.query(TeamUserAlias).delete()
        db.query(UserTeam).delete()
        db.commit()
        print(f"  ✓ Deleted {counts['User-Team Associations']} user-team associations")
        print(f"  ✓ Deleted {counts['Team User Aliases']} team user aliases")
        
        print("\n" + "=" * 80)
        print("STEP 3: Creating Production Users")
        print("=" * 80)
        
        # Step 3: Get org IDs
        orgs = {org.code: org for org in db.query(Organization).all()}
        
        # Delete all existing users
        print("\n🗑️  Deleting all existing users...")
        db.query(User).delete()
        db.commit()
        print(f"  ✓ Deleted {counts['Users']} users")
        
        # Create production users
        print("\n👤 Creating production users...")
        production_users = get_production_users()
        
        for key, user_data in production_users.items():
            # Get org_id if org_code is specified
            org_id = user_data.get('org_id')
            if 'org_code' in user_data:
                org = orgs.get(user_data['org_code'])
                org_id = org.id if org else None
            
            user = User(
                user_name=user_data['user_name'],
                password_hash=get_password_hash(user_data['password']),
                employee_id=user_data['employee_id'],
                user_role=user_data['user_role'],
                org_id=org_id,
                is_active=True,
                must_change_password=True  # Force password change on first login
            )
            db.add(user)
            print(f"  ✓ Created {user.user_name} ({user.user_role})")
        
        db.commit()
        
        print("\n" + "=" * 80)
        print("STEP 4: Verification")
        print("=" * 80)
        
        # Verify final state
        final_counts = {
            'Users': count_records(db, User),
            'Organizations': count_records(db, Organization),
            'Teams': count_records(db, Team),
            'Orders': count_records(db, Order),
            'User-Team Associations': count_records(db, UserTeam),
            'Metrics (Employee)': count_records(db, EmployeePerformanceMetrics),
            'Metrics (Team)': count_records(db, TeamPerformanceMetrics),
            'Quality Audits': count_records(db, QualityAudit)
        }
        
        print("\n📊 Final Database State:")
        for name, count in final_counts.items():
            print(f"  {name}: {count}")
        
        print("\n" + "=" * 80)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("=" * 80)
        
        print("\n📝 IMPORTANT NOTES:")
        print("  1. All users have default password and MUST change it on first login")
        print("  2. Default password for all users: Admin@123 or Emp@123")
        print("  3. Users created:")
        for key, user_data in production_users.items():
            print(f"     • {user_data['user_name']} (password must be changed)")
        print("  4. All teams are preserved but have no members")
        print("  5. Assign employees to teams using the Team Management interface")
        print("  6. Set up weekly targets for employees as needed")
        print("\n⚠️  SECURITY REMINDER:")
        print("  - Force all users to change their passwords immediately")
        print("  - Review user permissions before going live")
        print("  - Set up proper backup procedures")
        print("  - Configure environment variables for production")
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Migrate ODS database to production')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Show what would be deleted without making changes')
    args = parser.parse_args()
    
    migrate_to_production(dry_run=args.dry_run)
