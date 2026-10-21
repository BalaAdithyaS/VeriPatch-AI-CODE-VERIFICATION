from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.github import GithubAccount
from app.models.repository import Repository
from app.models.analysis import AnalysisRun
from app.core.analyzer import StaticAnalyzer
from app.schemas.analysis import AnalysisRunResponse

router = APIRouter()

def verify_repo_access(repo_id: str, current_user: User, db: Session):
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")
        
    account = db.query(GithubAccount).filter(
        GithubAccount.id == repo.github_account_id,
        GithubAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=403, detail="Not authorized to access this repository.")
    return repo

@router.post("/{repo_id}/analyze", response_model=AnalysisRunResponse)
def run_analysis(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    verify_repo_access(repo_id, current_user, db)
    
    # Run synchronously for MVP
    run = StaticAnalyzer.analyze_workspace(repo_id, db)
    
    # Reload with issues
    run_with_issues = db.query(AnalysisRun).filter(AnalysisRun.id == run.id).first()
    return run_with_issues

@router.get("/{repo_id}/issues", response_model=AnalysisRunResponse)
def get_latest_issues(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    verify_repo_access(repo_id, current_user, db)
    
    latest_run = db.query(AnalysisRun).filter(
        AnalysisRun.repository_id == repo_id,
        AnalysisRun.status == "completed"
    ).order_by(AnalysisRun.created_at.desc()).first()
    
    if not latest_run:
        raise HTTPException(status_code=404, detail="No completed analysis runs found.")
        
    return latest_run
