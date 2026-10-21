from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base

class AIReview(Base):
    __tablename__ = "ai_reviews"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False, default="running") # running, completed, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    repository = relationship("Repository", back_populates="ai_reviews")
    comments = relationship("AIComment", back_populates="review", cascade="all, delete-orphan")

class AIComment(Base):
    __tablename__ = "ai_comments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    review_id = Column(String, ForeignKey("ai_reviews.id", ondelete="CASCADE"), nullable=False)
    file_path = Column(String, nullable=False)
    line_number = Column(Integer, nullable=False)
    comment = Column(String, nullable=False)
    suggested_fix = Column(String, nullable=True) # code snippet
    issue_id = Column(String, ForeignKey("analysis_issues.id", ondelete="SET NULL"), nullable=True)
    is_verified = Column(Boolean, nullable=True)
    pr_url = Column(String, nullable=True)

    review = relationship("AIReview", back_populates="comments")
    issue = relationship("AnalysisIssue", back_populates="ai_comments")
