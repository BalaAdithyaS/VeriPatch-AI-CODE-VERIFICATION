from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base

class AnalysisRun(Base):
    __tablename__ = "analysis_runs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    repository_id = Column(String, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False)
    status = Column(String, nullable=False, default="running") # running, completed, failed
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    repository = relationship("Repository", back_populates="analysis_runs")
    issues = relationship("AnalysisIssue", back_populates="run", cascade="all, delete-orphan")

class AnalysisIssue(Base):
    __tablename__ = "analysis_issues"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String, ForeignKey("analysis_runs.id", ondelete="CASCADE"), nullable=False)
    tool = Column(String, nullable=False) # e.g. "ruff", "mypy"
    file_path = Column(String, nullable=False)
    line_number = Column(Integer, nullable=False)
    column_number = Column(Integer, nullable=True)
    rule_id = Column(String, nullable=True)
    message = Column(String, nullable=False)
    severity = Column(String, nullable=False) # e.g. "error", "warning", "info"

    run = relationship("AnalysisRun", back_populates="issues")
    ai_comments = relationship("AIComment", back_populates="issue")
