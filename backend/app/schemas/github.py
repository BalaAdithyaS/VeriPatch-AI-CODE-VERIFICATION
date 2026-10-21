from pydantic import BaseModel
from datetime import datetime

class GithubConnectRequest(BaseModel):
    personal_access_token: str

class GithubAccountResponse(BaseModel):
    id: str
    github_user_id: str
    username: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class GithubStatusResponse(BaseModel):
    connected: bool
    username: str | None = None
