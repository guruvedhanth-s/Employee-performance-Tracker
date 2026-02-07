"""
Quality Audit Service
Business logic for quality audit operations and calculations
"""
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from typing import Optional, List
from datetime import date, datetime
from decimal import Decimal

from app.models.quality_audit import QualityAudit
from app.models.user import User
from app.models.team import Team
from app.models.order import Order
from app.schemas.quality_audit import (
    QualityAuditCreate,
    QualityAuditUpdate,
    PROCESS_TYPE_OFE
)


class QualityAuditService:
    """Service for quality audit business logic"""
    
    @staticmethod
    def calculate_ofe(process_type: str) -> int:
        """Calculate OFE based on process type"""
        return PROCESS_TYPE_OFE.get(process_type, 0)
    
    @staticmethod
    def get_total_files_reviewed(
        db: Session,
        examiner_id: int,
        team_id: int,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> int:
        """
        Get total number of files reviewed by examiner in the period.
        Counts completed orders where the user was step1_user or step2_user.
        """
        query = db.query(func.count(Order.id)).filter(
            Order.team_id == team_id,
            Order.deleted_at.is_(None),
            and_(
                (Order.step1_user_id == examiner_id) | (Order.step2_user_id == examiner_id)
            )
        )
        
        # Add date filters if provided (using entry_date since completed_date is removed)
        if start_date:
            query = query.filter(Order.entry_date >= start_date)
        if end_date:
            query = query.filter(Order.entry_date <= end_date)
        
        total = query.scalar()
        return total or 0
    
    @staticmethod
    def calculate_quality_metrics(
        total_files_reviewed: int,
        ofe: int,
        files_with_error: int,
        total_errors: int,
        files_with_cce_error: int
    ) -> tuple[int, Decimal, Decimal, Decimal]:
        """
        Calculate quality metrics.
        
        Returns:
            tuple: (ofe_count, fb_quality, ofe_quality, cce_quality)
        """
        # Calculate OFE Count
        ofe_count = total_files_reviewed * ofe
        
        # Calculate FB Quality: 1 - (files_with_error / total_files_reviewed)
        if total_files_reviewed > 0:
            fb_quality = Decimal(1) - (Decimal(files_with_error) / Decimal(total_files_reviewed))
        else:
            # If no files reviewed, quality should be 0 if there are errors, otherwise 0
            fb_quality = Decimal(0)
        
        # Calculate OFE Quality: 1 - (total_errors / ofe_count)
        if ofe_count > 0:
            ofe_quality = Decimal(1) - (Decimal(total_errors) / Decimal(ofe_count))
        else:
            # If no OFE count, quality should be 0 if there are errors, otherwise 0
            ofe_quality = Decimal(0)
        
        # Calculate CCE Quality: 1 - (files_with_cce_error / total_files_reviewed)
        if total_files_reviewed > 0:
            cce_quality = Decimal(1) - (Decimal(files_with_cce_error) / Decimal(total_files_reviewed))
        else:
            # If no files reviewed, quality should be 0 if there are errors, otherwise 0
            cce_quality = Decimal(0)
        
        # Ensure values are between 0 and 1
        fb_quality = max(Decimal(0), min(Decimal(1), fb_quality))
        ofe_quality = max(Decimal(0), min(Decimal(1), ofe_quality))
        cce_quality = max(Decimal(0), min(Decimal(1), cce_quality))
        
        return ofe_count, fb_quality, ofe_quality, cce_quality
    
    @staticmethod
    def create_quality_audit(
        db: Session,
        audit_data: QualityAuditCreate,
        current_user_id: int
    ) -> QualityAudit:
        """
        Create a new quality audit record with calculated fields
        """
        # Get examiner's org_id
        examiner = db.query(User).filter(User.id == audit_data.examiner_id).first()
        if not examiner:
            raise ValueError("Examiner not found")
        
        # Calculate OFE
        ofe = QualityAuditService.calculate_ofe(audit_data.process_type)
        
        # Get total files reviewed - use manual entry if provided, otherwise fetch from DB
        if audit_data.total_files_reviewed is not None:
            total_files_reviewed = audit_data.total_files_reviewed
        else:
            total_files_reviewed = QualityAuditService.get_total_files_reviewed(
                db=db,
                examiner_id=audit_data.examiner_id,
                team_id=audit_data.team_id,
                start_date=audit_data.audit_period_start,
                end_date=audit_data.audit_period_end
            )
        
        # Calculate quality metrics
        ofe_count, fb_quality, ofe_quality, cce_quality = QualityAuditService.calculate_quality_metrics(
            total_files_reviewed=total_files_reviewed,
            ofe=ofe,
            files_with_error=audit_data.files_with_error,
            total_errors=audit_data.total_errors,
            files_with_cce_error=audit_data.files_with_cce_error
        )
        
        # Create audit record
        audit = QualityAudit(
            examiner_id=audit_data.examiner_id,
            team_id=audit_data.team_id,
            org_id=examiner.org_id,
            process_type=audit_data.process_type,
            ofe=ofe,
            files_with_error=audit_data.files_with_error,
            total_errors=audit_data.total_errors,
            files_with_cce_error=audit_data.files_with_cce_error,
            total_files_reviewed=total_files_reviewed,
            ofe_count=ofe_count,
            fb_quality=fb_quality,
            ofe_quality=ofe_quality,
            cce_quality=cce_quality,
            audit_date=audit_data.audit_date,
            audit_period_start=audit_data.audit_period_start,
            audit_period_end=audit_data.audit_period_end,
            created_by=current_user_id
        )
        
        db.add(audit)
        db.commit()
        db.refresh(audit)
        
        return audit
    
    @staticmethod
    def update_quality_audit(
        db: Session,
        audit_id: int,
        audit_data: QualityAuditUpdate,
        current_user_id: int
    ) -> QualityAudit:
        """
        Update an existing quality audit record and recalculate metrics
        """
        audit = db.query(QualityAudit).filter(
            QualityAudit.id == audit_id,
            QualityAudit.deleted_at.is_(None)
        ).first()
        
        if not audit:
            raise ValueError("Quality audit not found")
        
        # Update fields if provided
        if audit_data.process_type is not None:
            audit.process_type = audit_data.process_type
            audit.ofe = QualityAuditService.calculate_ofe(audit_data.process_type)
        
        if audit_data.files_with_error is not None:
            audit.files_with_error = audit_data.files_with_error
        
        if audit_data.total_errors is not None:
            audit.total_errors = audit_data.total_errors
        
        if audit_data.files_with_cce_error is not None:
            audit.files_with_cce_error = audit_data.files_with_cce_error
        
        if audit_data.audit_date is not None:
            audit.audit_date = audit_data.audit_date
        
        if audit_data.audit_period_start is not None:
            audit.audit_period_start = audit_data.audit_period_start
        
        if audit_data.audit_period_end is not None:
            audit.audit_period_end = audit_data.audit_period_end
        
        # Recalculate total files reviewed if period changed
        if audit_data.audit_period_start is not None or audit_data.audit_period_end is not None:
            audit.total_files_reviewed = QualityAuditService.get_total_files_reviewed(
                db=db,
                examiner_id=audit.examiner_id,
                team_id=audit.team_id,
                start_date=audit.audit_period_start,
                end_date=audit.audit_period_end
            )
        
        # Recalculate quality metrics
        ofe_count, fb_quality, ofe_quality, cce_quality = QualityAuditService.calculate_quality_metrics(
            total_files_reviewed=audit.total_files_reviewed,
            ofe=audit.ofe,
            files_with_error=audit.files_with_error,
            total_errors=audit.total_errors,
            files_with_cce_error=audit.files_with_cce_error
        )
        
        audit.ofe_count = ofe_count
        audit.fb_quality = fb_quality
        audit.ofe_quality = ofe_quality
        audit.cce_quality = cce_quality
        audit.modified_by = current_user_id
        
        db.commit()
        db.refresh(audit)
        
        return audit
    
    @staticmethod
    def get_quality_audit(db: Session, audit_id: int) -> Optional[QualityAudit]:
        """Get a quality audit by ID"""
        return db.query(QualityAudit).filter(
            QualityAudit.id == audit_id,
            QualityAudit.deleted_at.is_(None)
        ).first()
    
    @staticmethod
    def list_quality_audits(
        db: Session,
        org_id: Optional[int] = None,
        team_id: Optional[int] = None,
        team_ids: Optional[List[int]] = None,
        examiner_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        skip: int = 0,
        limit: int = 100
    ):
        """List quality audits with filters"""
        query = db.query(QualityAudit).filter(QualityAudit.deleted_at.is_(None))
        
        if org_id is not None:
            query = query.filter(QualityAudit.org_id == org_id)
        
        if team_id is not None:
            query = query.filter(QualityAudit.team_id == team_id)
        elif team_ids is not None and len(team_ids) > 0:
            query = query.filter(QualityAudit.team_id.in_(team_ids))
        
        if examiner_id is not None:
            query = query.filter(QualityAudit.examiner_id == examiner_id)
        
        if start_date is not None:
            query = query.filter(QualityAudit.audit_date >= start_date)
        
        if end_date is not None:
            query = query.filter(QualityAudit.audit_date <= end_date)
        
        total = query.count()
        items = query.order_by(QualityAudit.audit_date.desc()).offset(skip).limit(limit).all()
        
        return items, total
    
    @staticmethod
    def delete_quality_audit(db: Session, audit_id: int, current_user_id: int) -> bool:
        """Soft delete a quality audit"""
        audit = db.query(QualityAudit).filter(
            QualityAudit.id == audit_id,
            QualityAudit.deleted_at.is_(None)
        ).first()
        
        if not audit:
            return False
        
        audit.deleted_at = datetime.utcnow()
        audit.modified_by = current_user_id
        db.commit()
        
        return True
