"""
Database Indexes Guide and Migration
Recommended database indexes for improved query performance.
Run these after reviewing your current index usage.
"""

# === INDEXES FOR FREQUENTLY FILTERED FIELDS ===
#
# Based on the codebase analysis, these fields are frequently used in WHERE clauses:
# - User.org_id, User.user_role, User.is_active (filtered together in many queries)
# - Team.org_id, Team.is_active (filtered together)
# - Order.org_id, Order.team_id, Order.order_status_id, Order.deleted_at
# - UserTeam.team_id, UserTeam.user_id, UserTeam.is_active 
# - TeamUserAlias.team_id, TeamUserAlias.user_id
# - EmployeePerformanceMetrics.user_id, EmployeePerformanceMetrics.team_id, EmployeePerformanceMetrics.org_id
# - TeamPerformanceMetrics.team_id, TeamPerformanceMetrics.org_id
# - AttendanceRecord.team_id, AttendanceRecord.date
#
# === SQL MIGRATION SCRIPT ===
# Execute these CREATE INDEX statements in your PostgreSQL database:

SQL_INDEXES = """
-- User indexes
CREATE INDEX IF NOT EXISTS idx_user_org_id ON "user"(org_id);
CREATE INDEX IF NOT EXISTS idx_user_org_role_active ON "user"(org_id, user_role, is_active);
CREATE INDEX IF NOT EXISTS idx_user_role ON "user"(user_role);
CREATE INDEX IF NOT EXISTS idx_user_active ON "user"(is_active);

-- Team indexes  
CREATE INDEX IF NOT EXISTS idx_team_org_id ON team(org_id);
CREATE INDEX IF NOT EXISTS idx_team_org_active ON team(org_id, is_active);
CREATE INDEX IF NOT EXISTS idx_team_lead_id ON team(team_lead_id);
CREATE INDEX IF NOT EXISTS idx_team_active ON team(is_active);

-- Order indexes (critical for dashboard/metrics queries)
CREATE INDEX IF NOT EXISTS idx_order_org_id ON "order"(org_id);
CREATE INDEX IF NOT EXISTS idx_order_team_id ON "order"(team_id);
CREATE INDEX IF NOT EXISTS idx_order_org_team_deleted ON "order"(org_id, team_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_order_status_id ON "order"(order_status_id);
CREATE INDEX IF NOT EXISTS idx_order_deleted_at ON "order"(deleted_at);
CREATE INDEX IF NOT EXISTS idx_order_step1_user_id ON "order"(step1_user_id);
CREATE INDEX IF NOT EXISTS idx_order_step2_user_id ON "order"(step2_user_id);
CREATE INDEX IF NOT EXISTS idx_order_entry_date ON "order"(entry_date);
CREATE INDEX IF NOT EXISTS idx_order_billing_status ON "order"(billing_status);

-- UserTeam indexes  
CREATE INDEX IF NOT EXISTS idx_user_team_team_id_active ON user_team(team_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_team_user_id_active ON user_team(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_team_team_user_active ON user_team(team_id, user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_user_team_is_active ON user_team(is_active);

-- TeamUserAlias indexes
CREATE INDEX IF NOT EXISTS idx_team_user_alias_team_id ON team_user_alias(team_id);
CREATE INDEX IF NOT EXISTS idx_team_user_alias_user_id ON team_user_alias(user_id);
CREATE INDEX IF NOT EXISTS idx_team_user_alias_team_user_active ON team_user_alias(team_id, user_id, is_active);

-- Metrics indexes
CREATE INDEX IF NOT EXISTS idx_employee_metrics_user_id ON employee_performance_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_employee_metrics_team_id ON employee_performance_metrics(team_id);
CREATE INDEX IF NOT EXISTS idx_employee_metrics_org_id ON employee_performance_metrics(org_id);
CREATE INDEX IF NOT EXISTS idx_employee_metrics_user_org ON employee_performance_metrics(user_id, org_id);
CREATE INDEX IF NOT EXISTS idx_employee_metrics_period_date ON employee_performance_metrics(period_type, metric_date);

CREATE INDEX IF NOT EXISTS idx_team_metrics_team_id ON team_performance_metrics(team_id);
CREATE INDEX IF NOT EXISTS idx_team_metrics_org_id ON team_performance_metrics(org_id);
CREATE INDEX IF NOT EXISTS idx_team_metrics_period_date ON team_performance_metrics(period_type, metric_date);

-- Attendance indexes
CREATE INDEX IF NOT EXISTS idx_attendance_team_date ON attendance_record(team_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_record(user_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_marked_by ON attendance_record(marked_by);

-- Reference data indexes (for lookups)
CREATE INDEX IF NOT EXISTS idx_order_status_name ON order_status_type(name);
CREATE INDEX IF NOT EXISTS idx_transaction_type_name ON transaction_type(name);
CREATE INDEX IF NOT EXISTS idx_process_type_name ON process_type(name);
CREATE INDEX IF NOT EXISTS idx_division_name ON division(name);

-- FA Names indexes
CREATE INDEX IF NOT EXISTS idx_fa_name_active ON fa_name(is_active);
CREATE INDEX IF NOT EXISTS idx_team_fa_name_team_id ON team_fa_name(team_id);
"""

# === ANALYZE INDEXES ===
# After creating indexes, run ANALYZE to update PostgreSQL statistics:
# ANALYZE;

# === OPTIONAL: INDEXES FOR SORTING ===
# If you frequently sort by these fields, consider additional indexes:

OPTIONAL_INDEXES = """
-- Sort-specific indexes
CREATE INDEX IF NOT EXISTS idx_user_name ON "user"(user_name);
CREATE INDEX IF NOT EXISTS idx_team_name ON team(name);
CREATE INDEX IF NOT EXISTS idx_order_file_number ON "order"(file_number);
"""

# === PERFORMANCE MONITORING ===
# Monitor index usage with these queries:

MONITOR_INDEXES = """
-- See unused indexes:
SELECT schemaname, tablename, indexname, idx_scan 
FROM pg_stat_user_indexes 
WHERE idx_scan = 0 
ORDER BY pg_relation_size(indexrelid) DESC;

-- See index size:
SELECT relname, pg_size_pretty(pg_relation_size(relid)) as size
FROM pg_stat_user_indexes
ORDER BY pg_relation_size(relid) DESC;

-- See table scan vs index scan ratio:
SELECT schemaname, tablename, 
  seq_scan, seq_tup_read,
  idx_scan, idx_tup_fetch
FROM pg_stat_user_tables
WHERE seq_scan > idx_scan
ORDER BY seq_scan DESC;
"""

# === RECOMMENDATIONS ===
# 
# 1. Start by creating all User, Team, and Order indexes - these are the most critical
#
# 2. Monitor query performance before and after:
#    - Check dashboard response times
#    - Monitor API endpoint latency for list operations
#
# 3. Use PostgreSQL query planner to verify indexes are being used:
#    EXPLAIN ANALYZE SELECT ...
#
# 4. Consider partitioning large tables like Order and AttendanceRecord by date
#    or org_id if they grow very large (millions of rows)
#
# 5. Review index maintenance:
#    - REINDEX to rebuild fragmented indexes periodically
#    - Set up auto-VACUUM for maintenance
#
# 6. Monitor bloat with pg_stat_user_tables and run VACUUM ANALYZE regularly

if __name__ == "__main__":
    print("=== BACKEND DATABASE INDEXES ===\\n")
    print("To create recommended indexes, execute the following SQL:")
    print(SQL_INDEXES)
    print("\\n=== OPTIONAL INDEXES ===\\n")
    print(OPTIONAL_INDEXES)
    print("\\n=== MONITORING QUERIES ===\\n")
    print(MONITOR_INDEXES)
