from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    github_account_id = Column(String, ForeignKey("github_accounts.id", ondelete="CASCADE"), nullable=False)
    github_repository_id = Column(String, nullable=False, index=True)
    owner = Column(String, nullable=False)
    name = Column(String, nullable=False)
    full_name = Column(String, nullable=False, unique=True)
    default_branch = Column(String, nullable=False, default="main")
    language = Column(String, nullable=True)
    framework = Column(String, nullable=True)
    clone_url = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    github_account = relationship("GithubAccount", back_populates="repositories")
    analysis_runs = relationship("AnalysisRun", back_populates="repository", cascade="all, delete-orphan")
    ai_reviews = relationship("AIReview", back_populates="repository", cascade="all, delete-orphan")
