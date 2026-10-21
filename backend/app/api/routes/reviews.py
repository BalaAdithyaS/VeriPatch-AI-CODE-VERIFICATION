import logging
import traceback

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.github import GithubAccount
from app.models.repository import Repository
from app.models.review import AIReview
from app.core.ai_reviewer import AIReviewer
from app.schemas.review import AIReviewResponse

logger = logging.getLogger(__name__)
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

@router.post("/{repo_id}/review", response_model=AIReviewResponse)
def run_ai_review(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    verify_repo_access(repo_id, current_user, db)
    
    # Run synchronously for MVP
    review = AIReviewer.run_review(repo_id, db)
    
    # Reload with comments
    review_with_comments = db.query(AIReview).filter(AIReview.id == review.id).first()
    return review_with_comments

@router.get("/{repo_id}/reviews/latest", response_model=AIReviewResponse)
def get_latest_review(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    verify_repo_access(repo_id, current_user, db)
    
    latest_review = db.query(AIReview).filter(
        AIReview.repository_id == repo_id,
        AIReview.status == "completed"
    ).order_by(AIReview.created_at.desc()).first()
    
    if not latest_review:
        raise HTTPException(status_code=404, detail="No completed AI reviews found.")
        
    return latest_review

@router.post("/{repo_id}/comments/{comment_id}/verify")
def verify_comment_fix(
    repo_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    verify_repo_access(repo_id, current_user, db)
    
    try:
        from app.core.sandbox import SandboxManager
        is_verified = SandboxManager.verify_fix(repo_id, comment_id, db)
        return {"is_verified": is_verified}
    except ValueError as e:
        return {"error": str(e)}

@router.post("/{repo_id}/comments/{comment_id}/pr")
def create_comment_pr(
    repo_id: str,
    comment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    verify_repo_access(repo_id, current_user, db)
    
    try:
        from app.core.pr_creator import PRCreator
        pr_url = PRCreator.create_pr(repo_id, comment_id, db)
        logger.info(f"[PR] Created successfully: {pr_url}")
        return {"pr_url": pr_url}
    except ValueError as e:
        logger.error(f"[PR] ValueError for comment={comment_id}: {str(e)}")
        return {"error": str(e)}
    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"[PR] Unexpected error for comment={comment_id}:\n{tb}")
        return {"error": f"Unexpected error: {str(e)}"}
