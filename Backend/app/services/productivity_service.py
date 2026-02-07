"""
Productivity Service
Business logic for calculating employee productivity scores based on weekly targets.

Business Logic:
- Target is per employee PER TEAM (each team lead sets target for their team members)
- Score is calculated across ALL teams the employee belongs to
- Each team has its own score multipliers (step1_score, step2_score, single_seat_score)
- Employee's total target = SUM of targets from all teams for that week
- Productivity = Total Score (all teams) / Total Target (sum from all teams) × 100

Example:
- Employee X in Team A: target = 20 (set by Team A lead)
- Employee X in Team B: target = 15 (set by Team B lead)
- Employee X total target = 20 + 15 = 35
"""
# pyright: reportGeneralTypeIssues=false
# pyright: reportArgumentType=false
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
from datetime import date, datetime, timedelta
from typing import Optional, Dict, List, Any, Tuple
from decimal import Decimal
from app.models.order import Order
from app.models.user import User
from app.models.team import Team
from app.models.user_team import UserTeam
from app.models.employee_weekly_target import EmployeeWeeklyTarget
from app.services.attendance_service import AttendanceService


class ProductivityService:
    """
    Service for calculating employee productivity scores
    
    Score System:
    - Step 1: Configurable per team (team.step1_score)
    - Step 2: Configurable per team (team.step2_score)
    - Single Seat: Configurable per team (team.single_seat_score)
    
    Productivity Formula:
    Productivity % = (Total Actual Score / Total Target) × 100
    - Score is summed across ALL teams
    - Target is sum of per-team targets (each team lead sets target for their team)
    
    Example:
    - Employee X in Team A: target = 20, score = 18
    - Employee X in Team B: target = 15, score = 12
    - Total target = 35, Total score = 30
    - Productivity = 30/35 × 100 = 85.7%
    """
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_week_boundaries(self, reference_date: date) -> Tuple[date, date]:
        """
        Get the Sunday-Saturday week boundaries for a given date.
        Returns (week_start_date, week_end_date)
        """
        day_of_week = reference_date.weekday()
        
        # Calculate Sunday of this week
        if day_of_week == 6:  # Sunday
            week_start = reference_date
        else:
            days_since_sunday = day_of_week + 1
            week_start = reference_date - timedelta(days=days_since_sunday)
        
        week_end = week_start + timedelta(days=6)
        return week_start, week_end
    
    def get_weeks_in_range(self, start_date: date, end_date: date) -> List[Tuple[date, date]]:
        """
        Get all weeks (Sunday-Saturday) that overlap with the given date range.
        Returns list of (week_start, week_end) tuples.
        """
        weeks = []
        current_week_start, current_week_end = self.get_week_boundaries(start_date)
        
        while current_week_start <= end_date:
            weeks.append((current_week_start, current_week_end))
            current_week_start = current_week_start + timedelta(days=7)
            current_week_end = current_week_start + timedelta(days=6)
        
        return weeks
    
    def get_weekly_target_for_range(
        self, 
        user_id: int, 
        start_date: date, 
        end_date: date
    ) -> Tuple[float, Optional[int], List[Dict]]:
        """
        Calculate total expected target for a date range by summing weekly targets.
        For weeks without explicit targets, carry forward the last known target per team.
        
        Target is per employee PER TEAM - we sum targets from all teams.
        
        Returns:
            Tuple of (total_target, weekly_target_used, weekly_breakdown)
            - total_target: Sum of targets for all weeks and all teams in range
            - weekly_target_used: The total weekly target value (sum from all teams)
            - weekly_breakdown: List of week details with targets per team
        """
        weeks = self.get_weeks_in_range(start_date, end_date)
        total_target = 0.0
        weekly_breakdown = []
        
        # Get all targets for this user across all teams, ordered by week
        all_targets = self.db.query(EmployeeWeeklyTarget).filter(
            EmployeeWeeklyTarget.user_id == user_id
        ).order_by(EmployeeWeeklyTarget.week_start_date).all()
        
        # Create a map of (week_start, team_id) -> target
        target_map: Dict[Tuple[date, int], int] = {}
        for t in all_targets:
            week_date = t.week_start_date  # type: ignore
            team_id = int(t.team_id)  # type: ignore
            target_map[(week_date, team_id)] = int(t.target)  # type: ignore
        
        # Find the most recent target per team before start_date for carryforward
        last_known_per_team: Dict[int, int] = {}
        for t in all_targets:
            t_week_start = t.week_start_date  # type: ignore
            team_id = int(t.team_id)  # type: ignore
            if t_week_start < start_date:
                last_known_per_team[team_id] = int(t.target)  # type: ignore
        
        # Get all teams the user is a member of
        user_team_ids = [
            int(ut.team_id) for ut in self.db.query(UserTeam).filter(  # type: ignore
                UserTeam.user_id == user_id,
                UserTeam.is_active == True
            ).all()
        ]
        
        for week_start, week_end in weeks:
            week_total_target = 0
            team_targets_for_week = []
            
            for team_id in user_team_ids:
                # Check if we have a target for this week and team
                key = (week_start, team_id)
                if key in target_map:
                    last_known_per_team[team_id] = target_map[key]
                
                team_target = last_known_per_team.get(team_id)
                if team_target is not None:
                    team_targets_for_week.append({
                        "teamId": team_id,
                        "target": team_target
                    })
                    week_total_target += team_target
            
            if week_total_target > 0:
                # Calculate days of this week that fall within the range
                overlap_start = max(week_start, start_date)
                overlap_end = min(week_end, end_date)
                days_in_range = (overlap_end - overlap_start).days + 1
                
                # Proportional target for partial weeks
                weekly_proportion = days_in_range / 7.0
                proportional_target = float(week_total_target) * weekly_proportion
                total_target += proportional_target
                
                weekly_breakdown.append({
                    "weekStart": week_start.isoformat(),
                    "weekEnd": week_end.isoformat(),
                    "totalTarget": week_total_target,
                    "teamTargets": team_targets_for_week,
                    "daysInRange": days_in_range,
                    "proportionalTarget": round(proportional_target, 2)
                })
            else:
                weekly_breakdown.append({
                    "weekStart": week_start.isoformat(),
                    "weekEnd": week_end.isoformat(),
                    "totalTarget": None,
                    "teamTargets": [],
                    "daysInRange": 0,
                    "proportionalTarget": 0
                })
        
        # Calculate the current week's total target for display
        current_week_total = sum(last_known_per_team.values()) if last_known_per_team else None
        
        return total_target, current_week_total, weekly_breakdown
    
    def get_working_days_in_month(self, year: int, month: int) -> int:
        """
        Calculate working days in a month (ALL days - company works 7 days/week)
        Returns total count of days in the month
        """
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        return last_day
    
    def get_working_days_in_range(self, start_date: date, end_date: date) -> int:
        """
        Calculate working days between two dates (ALL days - company works 7 days/week)
        """
        delta = end_date - start_date
        return delta.days + 1  # +1 to include both start and end dates
    
    def get_employee_team_score(
        self,
        user_id: int,
        team_id: int,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """
        Calculate score for an employee in a specific team (orders only from this team).
        Uses team-specific score multipliers.
        
        Returns:
            Dict with step counts and scores for this team
        """
        # Get team settings for score multipliers
        team = self.db.query(Team).filter(Team.id == team_id).first()
        if not team:
            return {
                "teamId": team_id,
                "teamName": "Unknown",
                "completions": {"step1Only": 0, "step2Only": 0, "singleSeat": 0, "total": 0},
                "scores": {"step1Score": 0, "step2Score": 0, "singleSeatScore": 0, "totalScore": 0},
                "scoreMultipliers": {"step1": 0.5, "step2": 0.5, "singleSeat": 1.0}
            }
        
        # Base query for orders in this team within the date range (based on entry_date)
        base_query = self.db.query(Order).filter(
            Order.team_id == team_id,
            Order.deleted_at == None,
            Order.entry_date >= start_date,
            Order.entry_date <= end_date
        )
        
        # Count Step 1 completions (user did step 1, but NOT step 2)
        step1_only_count = base_query.filter(
            Order.step1_user_id == user_id,
            or_(
                Order.step2_user_id != user_id,
                Order.step2_user_id == None
            )
        ).count()
        
        # Count Step 2 completions (user did step 2, but NOT step 1)
        step2_only_count = base_query.filter(
            Order.step2_user_id == user_id,
            or_(
                Order.step1_user_id != user_id,
                Order.step1_user_id == None
            )
        ).count()
        
        # Count Single Seat completions (user did BOTH steps)
        single_seat_count = base_query.filter(
            Order.step1_user_id == user_id,
            Order.step2_user_id == user_id
        ).count()
        
        # Calculate scores using team-specific scoring configuration
        step1_multiplier = float(team.step1_score) if team.step1_score else 0.5
        step2_multiplier = float(team.step2_score) if team.step2_score else 0.5
        single_seat_multiplier = float(team.single_seat_score) if team.single_seat_score else 1.0
        
        step1_score = step1_only_count * step1_multiplier
        step2_score = step2_only_count * step2_multiplier
        single_seat_score = single_seat_count * single_seat_multiplier
        
        total_score = step1_score + step2_score + single_seat_score
        
        return {
            "teamId": team_id,
            "teamName": team.name,
            "completions": {
                "step1Only": step1_only_count,
                "step2Only": step2_only_count,
                "singleSeat": single_seat_count,
                "total": step1_only_count + step2_only_count + single_seat_count
            },
            "scores": {
                "step1Score": step1_score,
                "step2Score": step2_score,
                "singleSeatScore": single_seat_score,
                "totalScore": total_score
            },
            "scoreMultipliers": {
                "step1": step1_multiplier,
                "step2": step2_multiplier,
                "singleSeat": single_seat_multiplier
            }
        }
    
    def calculate_employee_score(
        self,
        user_id: int,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """
        Calculate productivity score for an employee.
        
        This aggregates:
        - Scores from ALL teams the employee is assigned to (using each team's multipliers)
        - Targets from ALL teams (sum of per-team targets set by respective team leads)
        
        Productivity = Total Score (all teams) / Total Target (sum from all teams) × 100
        
        Example:
        - Employee X in Team A: target = 20, score = 18
        - Employee X in Team B: target = 15, score = 12
        - Total target = 35, Total score = 30
        - Productivity = 30/35 × 100 = 85.7%
        
        NOTE: Only calculates for users with role 'employee'
        
        Returns:
            Dict with step counts, scores, and productivity percentage
        """
        # Verify user is an employee (not team_lead, admin, superadmin)
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"error": "User not found"}
        if user.user_role != 'employee':  # type: ignore
            return {"error": "Productivity is only calculated for employees"}
        
        # Adjust end_date to not exceed today's date
        today = date.today()
        actual_end_date = min(end_date, today)
        
        # Get ALL active teams the employee is assigned to
        user_teams = self.db.query(UserTeam).filter(
            UserTeam.user_id == user_id,
            UserTeam.is_active == True
        ).all()
        
        user_team_ids = [int(ut.team_id) for ut in user_teams]  # type: ignore
        
        if not user_team_ids:
            return {
                "error": "Employee is not assigned to any teams",
                "userId": user_id
            }
        
        # Calculate scores from ALL teams
        total_step1_count = 0
        total_step2_count = 0
        total_single_seat_count = 0
        total_step1_score = 0.0
        total_step2_score = 0.0
        total_single_seat_score = 0.0
        total_score = 0.0
        team_breakdown = []
        
        for tid in user_team_ids:
            team_score_data = self.get_employee_team_score(
                user_id=user_id,
                team_id=tid,
                start_date=start_date,
                end_date=actual_end_date
            )
            
            total_step1_count += team_score_data["completions"]["step1Only"]
            total_step2_count += team_score_data["completions"]["step2Only"]
            total_single_seat_count += team_score_data["completions"]["singleSeat"]
            total_step1_score += team_score_data["scores"]["step1Score"]
            total_step2_score += team_score_data["scores"]["step2Score"]
            total_single_seat_score += team_score_data["scores"]["singleSeatScore"]
            total_score += team_score_data["scores"]["totalScore"]
            
            # Only include in breakdown if there's activity
            if team_score_data["completions"]["total"] > 0:
                team_breakdown.append(team_score_data)
        
        # Calculate working days (up to today, not future dates)
        working_days = self.get_working_days_in_range(start_date, actual_end_date)
        
        # Get expected target from weekly targets (single target per employee)
        # total_expected_target is proportional based on date range
        # weekly_target_used is the full weekly target (sum from all teams)
        proportional_target, weekly_target_used, weekly_breakdown = self.get_weekly_target_for_range(
            user_id=user_id,
            start_date=start_date,
            end_date=actual_end_date
        )
        
        has_weekly_target = weekly_target_used is not None
        
        # Use proportional target for productivity calculation
        # but display the full weekly target as expectedTarget
        proportional_target = round(proportional_target, 2)
        
        # expectedTarget should be the full weekly target, not proportional
        expected_target = weekly_target_used if weekly_target_used is not None else 0
        
        # Calculate attendance using manual attendance records
        # Use AttendanceService to get attendance summary
        attendance_service = AttendanceService(self.db)
        attendance_summary = attendance_service.get_employee_attendance_summary(
            user_id=user_id,
            start_date=start_date,
            end_date=actual_end_date
        )
        
        days_present = attendance_summary.days_present
        days_absent = attendance_summary.days_absent
        days_leave = attendance_summary.days_leave
        attendance_percentage = attendance_summary.attendance_percent
        
        # Calculate productivity percentage using proportional target
        # This ensures productivity is calculated based on the selected date range
        # If no target is set, productivity is None (not 0)
        productivity_percent = None
        if proportional_target > 0:
            productivity_percent = round((total_score / proportional_target) * 100, 2)
        
        return {
            "userId": user_id,
            "userName": user.user_name,
            "userName": user.user_name,
            "employeeId": user.employee_id,
            "teamsIncluded": user_team_ids,
            "weeklyTarget": weekly_target_used,
            "expectedTarget": expected_target,
            "period": {
                "startDate": start_date.isoformat(),
                "endDate": actual_end_date.isoformat(),
                "requestedEndDate": end_date.isoformat(),
                "workingDays": working_days
            },
            "attendance": {
                "daysPresent": days_present,
                "daysAbsent": days_absent,
                "daysLeave": days_leave,
                "attendancePercent": round(attendance_percentage, 2)
            },
            "completions": {
                "step1Only": total_step1_count,
                "step2Only": total_step2_count,
                "singleSeat": total_single_seat_count,
                "total": total_step1_count + total_step2_count + total_single_seat_count
            },
            "scores": {
                "step1Score": total_step1_score,
                "step2Score": total_step2_score,
                "singleSeatScore": total_single_seat_score,
                "totalScore": total_score
            },
            "teamBreakdown": team_breakdown,
            "productivityPercent": productivity_percent,
            "weeklyBreakdown": weekly_breakdown,
            "hasWeeklyTarget": has_weekly_target
        }
    
    def calculate_team_productivity(
        self,
        team_id: int,
        start_date: date,
        end_date: date
    ) -> Dict[str, Any]:
        """
        Calculate productivity for all active members of a team.
        Shows each employee's score ONLY for this team (not aggregated across all teams).
        
        Returns:
            Dict with team info and list of employee productivity scores for this team
        """
        # Get team
        team = self.db.query(Team).filter(Team.id == team_id).first()
        if not team:
            return {"error": "Team not found"}
        
        # Adjust end_date to not exceed today's date
        today = date.today()
        actual_end_date = min(end_date, today)
        
        # Get active team members - ONLY employees (not team_lead, admin, superadmin)
        team_members = self.db.query(UserTeam).join(
            User, User.id == UserTeam.user_id
        ).filter(
            UserTeam.team_id == team_id,
            UserTeam.is_active == True,
            User.user_role == 'employee'
        ).all()
        
        employee_scores = []
        total_team_score = 0.0
        total_expected = 0.0
        
        for membership in team_members:
            user = self.db.query(User).filter(
                User.id == membership.user_id,
                User.user_role == 'employee'
            ).first()
            if not user:
                continue
            
            # Get score for THIS TEAM ONLY (not aggregated across all teams)
            team_score_data = self.get_employee_team_score(
                user_id=int(user.id),  # type: ignore
                team_id=team_id,
                start_date=start_date,
                end_date=actual_end_date
            )
            
            # Get employee's weekly target for this team
            target_for_team = self._get_employee_target_for_team(
                user_id=int(user.id),  # type: ignore
                team_id=team_id,
                start_date=start_date,
                end_date=actual_end_date
            )
            
            team_score = team_score_data["scores"]["totalScore"]
            
            # Calculate productivity % for this employee in this team
            employee_productivity = None
            if target_for_team > 0:
                employee_productivity = round((team_score / target_for_team) * 100, 2)
            
            employee_data = {
                "userId": int(user.id),  # type: ignore
                "userName": user.user_name,
                "userName": user.user_name,
                "employeeId": user.employee_id,
                "completions": team_score_data["completions"],
                "scores": team_score_data["scores"],
                "expectedTarget": target_for_team,
                "productivityPercent": employee_productivity,
                "teamId": team_id,
                "teamName": team.name
            }
            
            employee_scores.append(employee_data)
            total_team_score += team_score
            total_expected += target_for_team
        
        # Determine team target: use monthly_target if set, otherwise sum of employee targets
        team_target: float = float(team.monthly_target) if team.monthly_target else total_expected
        
        # Calculate team productivity percentage using team target
        team_productivity = 0.0
        if team_target > 0:
            team_productivity = (total_team_score / team_target) * 100
        
        return {
            "teamId": team_id,
            "teamName": team.name,
            "monthlyTarget": team.monthly_target,
            "scoreMultipliers": {
                "step1": float(team.step1_score) if team.step1_score else 0.5,
                "step2": float(team.step2_score) if team.step2_score else 0.5,
                "singleSeat": float(team.single_seat_score) if team.single_seat_score else 1.0
            },
            "period": {
                "startDate": start_date.isoformat(),
                "endDate": actual_end_date.isoformat(),
                "requestedEndDate": end_date.isoformat(),
                "workingDays": self.get_working_days_in_range(start_date, actual_end_date)
            },
            "activeMembers": len(employee_scores),
            "totalTeamScore": total_team_score,
            "totalExpectedTarget": team_target,  # Use team target (monthly_target or sum of employee targets)
            "employeeTargetSum": total_expected,  # Keep track of sum of employee targets separately
            "teamProductivityPercent": round(float(team_productivity), 2),
            "employees": employee_scores
        }
    
    def _get_employee_target_for_team(
        self,
        user_id: int,
        team_id: int,
        start_date: date,
        end_date: date
    ) -> float:
        """
        Get employee's target for a specific team within a date range.
        Returns proportional target based on weeks in range.
        """
        weeks = self.get_weeks_in_range(start_date, end_date)
        total_target = 0.0
        
        # Get all targets for this user and team, ordered by week
        all_targets = self.db.query(EmployeeWeeklyTarget).filter(
            EmployeeWeeklyTarget.user_id == user_id,
            EmployeeWeeklyTarget.team_id == team_id
        ).order_by(EmployeeWeeklyTarget.week_start_date).all()
        
        # Create a map of week_start -> target
        target_map: Dict[date, int] = {}
        for t in all_targets:
            target_map[t.week_start_date] = int(t.target)  # type: ignore
        
        # Find the most recent target before start_date for carryforward
        last_known_target: Optional[int] = None
        for t in all_targets:
            if t.week_start_date < start_date:  # type: ignore
                last_known_target = int(t.target)  # type: ignore
        
        for week_start, week_end in weeks:
            # Check if we have a target for this week
            if week_start in target_map:
                last_known_target = target_map[week_start]
            
            if last_known_target is not None:
                # Calculate days of this week that fall within the range
                overlap_start = max(week_start, start_date)
                overlap_end = min(week_end, end_date)
                days_in_range = (overlap_end - overlap_start).days + 1
                
                # Proportional target for partial weeks
                weekly_proportion = days_in_range / 7.0
                proportional_target = float(last_known_target) * weekly_proportion
                total_target += proportional_target
        
        return round(total_target, 2)
    
    def get_monthly_productivity(
        self,
        user_id: int,
        year: int,
        month: int
    ) -> Dict[str, Any]:
        """
        Get productivity for a specific month
        """
        import calendar
        
        # Get first and last day of the month
        _, last_day = calendar.monthrange(year, month)
        start_date = date(year, month, 1)
        end_date = date(year, month, last_day)
        
        result = self.calculate_employee_score(
            user_id=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
        result["month"] = month
        result["year"] = year
        
        return result
    
    def get_leaderboard(
        self,
        org_id: Optional[int],
        team_id: Optional[int],
        start_date: date,
        end_date: date,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get top performers by productivity score
        
        Args:
            org_id: Filter by organization (optional)
            team_id: Filter by team (optional)
            start_date: Start of period
            end_date: End of period
            limit: Number of top performers to return
            
        Returns:
            List of employee productivity scores sorted by total score descending
        """
        # Get teams to query
        teams_query = self.db.query(Team).filter(Team.is_active == True)
        
        if org_id:
            teams_query = teams_query.filter(Team.org_id == org_id)
        if team_id:
            teams_query = teams_query.filter(Team.id == team_id)
        
        teams = teams_query.all()
        
        all_scores = []
        seen_user_ids = set()  # Avoid duplicates if user is in multiple teams
        
        for team in teams:
            team_data = self.calculate_team_productivity(
                team_id=int(team.id),  # type: ignore
                start_date=start_date,
                end_date=end_date
            )
            
            if "employees" in team_data:
                for emp in team_data["employees"]:
                    if emp["userId"] not in seen_user_ids:
                        all_scores.append(emp)
                        seen_user_ids.add(emp["userId"])
        
        # Sort by total score descending
        all_scores.sort(key=lambda x: x["scores"]["totalScore"], reverse=True)
        
        return all_scores[:limit]
