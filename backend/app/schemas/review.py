from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class AICommentBase(BaseModel):
    file_path: str
    line_number: int
    comment: str
    suggested_fix: Optional[str] = None
    issue_id: Optional[str] = None
    is_verified: Optional[bool] = None
    pr_url: Optional[str] = None

class AICommentResponse(AICommentBase):
    id: str
    review_id: str

    class Config:
        from_attributes = True

class AIReviewBase(BaseModel):
    repository_id: str
    status: str

class AIReviewResponse(AIReviewBase):
    id: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    comments: List[AICommentResponse] = []

    class Config:
        from_attributes = True
