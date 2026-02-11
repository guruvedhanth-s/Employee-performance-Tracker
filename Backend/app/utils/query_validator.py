"""
Query Input Validators
Centralized input validation and sanitization for query parameters.
Prevents invalid inputs and improves query security.
"""
from fastapi import HTTPException, status
from typing import Optional, Any, List
from datetime import date, datetime
import re


class QueryValidator:
    """Input validation and sanitization utilities"""
    
    @staticmethod
    def validate_id(value: Any, field_name: str = "ID", allow_none: bool = False) -> Optional[int]:
        """
        Validate and convert value to positive integer ID.
        
        Args:
            value: Value to validate
            field_name: Name for error messages
            allow_none: If True, allows None values
            
        Returns:
            Validated positive integer
            
        Raises:
            HTTPException if invalid
        """
        if value is None:
            if allow_none:
                return None
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} is required"
            )
        
        try:
            id_value = int(value)
            if id_value <= 0:
                raise ValueError()
            return id_value
        except (ValueError, TypeError):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be a positive integer, got: {value}"
            )
    
    @staticmethod
    def validate_date(value: Any, field_name: str = "date", allow_none: bool = False) -> Optional[date]:
        """
        Validate date value.
        
        Args:
            value: Date value (can be date, datetime, or ISO string)
            field_name: Name for error messages
            allow_none: If True, allows None
            
        Returns:
            Validated date object
            
        Raises:
            HTTPException if invalid
        """
        if value is None:
            if allow_none:
                return None
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} is required"
            )
        
        # Already a date
        if isinstance(value, date):
            return value
        
        # Convert datetime to date
        if isinstance(value, datetime):
            return value.date()
        
        # Try parsing ISO string
        if isinstance(value, str):
            try:
                dt = datetime.fromisoformat(value)
                return dt.date()
            except ValueError:
                pass
        
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{field_name} must be valid ISO date format (YYYY-MM-DD), got: {value}"
        )
    
    @staticmethod
    def validate_date_range(
        start_date: date,
        end_date: date,
        max_days: Optional[int] = None
    ) -> None:
        """
        Validate date range.
        
        Args:
            start_date: Start date
            end_date: End date (must be >= start_date)
            max_days: Optional maximum range in days
            
        Raises:
            HTTPException if invalid
        """
        if end_date < start_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="End date must be after or equal to start date"
            )
        
        if max_days:
            delta = (end_date - start_date).days
            if delta > max_days:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Date range cannot exceed {max_days} days, requested: {delta} days"
                )
    
    @staticmethod
    def validate_pagination(skip: int = 0, limit: int = 100) -> tuple[int, int]:
        """
        Validate pagination parameters.
        
        Args:
            skip: Offset to skip
            limit: Number of items to return
            
        Returns:
            Tuple of (skip, limit) after validation
            
        Raises:
            HTTPException if invalid
        """
        if skip < 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"skip must be >= 0, got: {skip}"
            )
        
        if limit < 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"limit must be >= 1, got: {limit}"
            )
        
        if limit > 500:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"limit cannot exceed 500, got: {limit}"
            )
        
        return skip, limit
    
    @staticmethod
    def validate_string(
        value: Any,
        field_name: str,
        allow_none: bool = False,
        min_length: int = 1,
        max_length: int = 255,
        allowed_chars: Optional[str] = None
    ) -> Optional[str]:
        """
        Validate and sanitize string input.
        
        Args:
            value: String value to validate
            field_name: Name for error messages
            allow_none: If True, allows None/empty
            min_length: Minimum string length
            max_length: Maximum string length
            allowed_chars: Optional regex pattern for allowed characters
            
        Returns:
            Validated and stripped string
            
        Raises:
            HTTPException if invalid
        """
        if value is None or value == "":
            if allow_none:
                return None
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} is required"
            )
        
        # Convert to string and strip whitespace
        str_value = str(value).strip()
        
        if len(str_value) < min_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be at least {min_length} character(s)"
            )
        
        if len(str_value) > max_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} cannot exceed {max_length} characters"
            )
        
        if allowed_chars:
            if not re.match(allowed_chars, str_value):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field_name} contains invalid characters"
                )
        
        return str_value
    
    @staticmethod
    def validate_email(value: str, allow_none: bool = False) -> Optional[str]:
        """
        Validate email address.
        
        Args:
            value: Email to validate
            allow_none: If True, allows None
            
        Returns:
            Validated email (lowercased)
            
        Raises:
            HTTPException if invalid
        """
        if value is None or value == "":
            if allow_none:
                return None
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email is required"
            )
        
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_pattern, value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid email format: {value}"
            )
        
        return value.lower()
    
    @staticmethod
    def validate_enum(
        value: Any,
        allowed_values: List[str],
        field_name: str
    ) -> str:
        """
        Validate enum/choice parameter.
        
        Args:
            value: Value to check
            allowed_values: List of allowed values
            field_name: Name for error messages
            
        Returns:
            Validated value
            
        Raises:
            HTTPException if not in allowed values
        """
        if value not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be one of: {', '.join(allowed_values)}, got: {value}"
            )
        return value
    
    @staticmethod
    def validate_month(month: int, field_name: str = "month") -> int:
        """
        Validate month (1-12).
        
        Args:
            month: Month value
            field_name: Name for error messages
            
        Returns:
            Validated month
            
        Raises:
            HTTPException if invalid
        """
        if not isinstance(month, int) or month < 1 or month > 12:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be between 1 and 12, got: {month}"
            )
        return month
    
    @staticmethod
    def validate_year(year: int, field_name: str = "year") -> int:
        """
        Validate year (reasonable range: 2000-2100).
        
        Args:
            year: Year value
            field_name: Name for error messages
            
        Returns:
            Validated year
            
        Raises:
            HTTPException if invalid
        """
        if not isinstance(year, int) or year < 2000 or year > 2100:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} must be between 2000 and 2100, got: {year}"
            )
        return year
    
    @staticmethod
    def validate_phone(value: str, allow_none: bool = False) -> Optional[str]:
        """
        Validate phone number (basic format: digits, spaces, hyphens, +).
        
        Args:
            value: Phone number to validate
            allow_none: If True, allows None
            
        Returns:
            Validated phone (whitespace removed)
            
        Raises:
            HTTPException if invalid
        """
        if value is None or value == "":
            if allow_none:
                return None
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number is required"
            )
        
        # Allow digits, spaces, hyphens, parentheses, plus sign
        phone_pattern = r'^[+]?[\d\s\-()]{10,}$'
        if not re.match(phone_pattern, value):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid phone number format"
            )
        
        # Remove non-digit characters (except +)
        cleaned = re.sub(r'[^\d+]', '', value)
        return cleaned
    
    @staticmethod
    def validate_list_ids(
        ids: Optional[List[int]],
        field_name: str = "IDs",
        allow_empty: bool = False
    ) -> List[int]:
        """
        Validate list of IDs.
        
        Args:
            ids: List of IDs to validate
            field_name: Name for error messages
            allow_empty: If True, allows empty list
            
        Returns:
            Validated list of positive integers
            
        Raises:
            HTTPException if invalid
        """
        if not ids:
            if allow_empty:
                return []
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name} cannot be empty"
            )
        
        validated_ids = []
        for item in ids:
            try:
                id_value = int(item)
                if id_value <= 0:
                    raise ValueError()
                validated_ids.append(id_value)
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"{field_name} must contain only positive integers, got: {item}"
                )
        
        return validated_ids
    
    @staticmethod
    def sanitize_search(value: str, max_length: int = 100) -> str:
        """
        Sanitize search input string.
        
        Args:
            value: Search string
            max_length: Maximum length
            
        Returns:
            Sanitized search string
            
        Raises:
            HTTPException if invalid
        """
        if not value:
            return ""
        
        sanitized = value.strip()
        
        if len(sanitized) > max_length:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Search string cannot exceed {max_length} characters"
            )
        
        # Remove potentially dangerous characters but allow common search chars
        # Allow: alphanumeric, spaces, hyphens, underscores, @ (for email)
        sanitized = re.sub(r'[^a-zA-Z0-9\s\-_@.]', '', sanitized)
        
        return sanitized
