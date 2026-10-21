from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class AnalysisIssueBase(BaseModel):
    tool: str
    file_path: str
    line_number: int
    column_number: Optional[int] = None
    rule_id: Optional[str] = None
    message: str
    severity: str

class AnalysisIssueResponse(AnalysisIssueBase):
    id: str
    run_id: str

    class Config:
        from_attributes = True

class AnalysisRunBase(BaseModel):
    repository_id: str
    status: str

class AnalysisRunResponse(AnalysisRunBase):
    id: str
    created_at: datetime
    completed_at: Optional[datetime] = None
    issues: List[AnalysisIssueResponse] = []

    class Config:
        from_attributes = True
