"""
Quality Audit Model
Tracks file review quality metrics for examiners
"""
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Date, Numeric, CheckConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class QualityAudit(Base):
    """
    Quality Audit model for tracking file review errors and quality metrics
    
    Process Types and their OFE values:
    - Full Search: 6
    - Streamline: 5
    - Update & DD: 3
    - GI clearing: 1
    
    Quality Metrics Formulas:
    - FB Quality = 1 - (No. of files with Error / Total files Reviewed)
    - OFE Quality = 1 - (Total No. of Errors / OFE Count)
    - CCE Quality = 1 - (No. of files with CCE Error / Total files Reviewed)
    """
    __tablename__ = "quality_audits"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    
    # Examiner (User) Information
    examiner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    org_id = Column(Integer, ForeignKey("organizations.id"), nullable=False)
    
    # Process Type - determines OFE value
    # Options: "Full Search", "Streamline", "Update & DD", "GI clearing"
    process_type = Column(String(100), nullable=False)
    
    # OFE (automatically calculated based on process_type)
    ofe = Column(Integer, nullable=False)
    
    # Manual Entry Fields (text boxes)
    files_with_error = Column(Integer, nullable=False, default=0)  # No. of Files with Error
    total_errors = Column(Integer, nullable=False, default=0)  # Total No. of Errors
    files_with_cce_error = Column(Integer, nullable=False, default=0)  # No. of files with CCE Error
    
    # Calculated Fields (stored for reporting efficiency)
    total_files_reviewed = Column(Integer, nullable=False)  # Retrieved from orders DB
    ofe_count = Column(Integer, nullable=False)  # No. of Files Reviewed * OFE
    
    # Quality Percentages (stored as decimal, displayed as percentage)
    fb_quality = Column(Numeric(5, 4), nullable=False)  # 0.0000 to 1.0000 (0% to 100%)
    ofe_quality = Column(Numeric(5, 4), nullable=False)
    cce_quality = Column(Numeric(5, 4), nullable=False)
    
    # Audit Period
    audit_date = Column(Date, nullable=False)  # Date of the audit/review
    audit_period_start = Column(Date, nullable=True)  # Optional: period start
    audit_period_end = Column(Date, nullable=True)  # Optional: period end
    
    # Audit Metadata
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    modified_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    modified_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete
    
    # Constraints
    __table_args__ = (
        CheckConstraint('ofe > 0', name='check_ofe_positive'),
        CheckConstraint('files_with_error >= 0', name='check_files_with_error_non_negative'),
        CheckConstraint('total_errors >= 0', name='check_total_errors_non_negative'),
        CheckConstraint('files_with_cce_error >= 0', name='check_files_with_cce_error_non_negative'),
        CheckConstraint('total_files_reviewed >= 0', name='check_total_files_reviewed_non_negative'),
        CheckConstraint('fb_quality >= 0 AND fb_quality <= 1', name='check_fb_quality_range'),
        CheckConstraint('ofe_quality >= 0 AND ofe_quality <= 1', name='check_ofe_quality_range'),
        CheckConstraint('cce_quality >= 0 AND cce_quality <= 1', name='check_cce_quality_range'),
    )
    
    # Relationships
    examiner = relationship("User", foreign_keys=[examiner_id], backref="quality_audits")
    team = relationship("Team", backref="quality_audits")
    organization = relationship("Organization", backref="quality_audits")
    creator = relationship("User", foreign_keys=[created_by])
    modifier = relationship("User", foreign_keys=[modified_by])
