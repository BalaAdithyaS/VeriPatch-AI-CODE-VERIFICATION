from sqlalchemy import Column, String, DateTime, ForeignKey, Integer
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.core.database import Base

class GithubAccount(Base):
    __tablename__ = "github_accounts"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    github_user_id = Column(String, nullable=False, index=True)
    username = Column(String, nullable=False)
    encrypted_credentials = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", backref="github_accounts")
    repositories = relationship("Repository", back_populates="github_account", cascade="all, delete-orphan")
