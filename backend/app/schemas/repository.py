from pydantic import BaseModel
from datetime import datetime

class RepositoryBase(BaseModel):
    github_repository_id: str
    owner: str
    name: str
    full_name: str
    default_branch: str
    language: str | None = None
    framework: str | None = None
    clone_url: str

class RepositoryCreate(RepositoryBase):
    pass

class RepositoryResponse(RepositoryBase):
    id: str
    github_account_id: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class RemoteRepository(BaseModel):
    github_id: str
    name: str
    full_name: str
    owner: str
    private: bool
    clone_url: str
    default_branch: str
    language: str | None = None
