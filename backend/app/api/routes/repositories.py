from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.github import GithubAccount
from app.models.repository import Repository
from app.schemas.repository import RepositoryCreate, RepositoryResponse

router = APIRouter()

@router.post("/", response_model=RepositoryResponse)
def import_repository(
    repo_in: RepositoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(GithubAccount).filter(GithubAccount.user_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=400, detail="GitHub account not connected.")
        
    existing_repo = db.query(Repository).filter(
        Repository.github_account_id == account.id,
        Repository.github_repository_id == repo_in.github_repository_id
    ).first()
    
    if existing_repo:
        raise HTTPException(status_code=400, detail="Repository already imported.")
        
    repo = Repository(
        github_account_id=account.id,
        **repo_in.dict()
    )
    db.add(repo)
    try:
        db.commit()
        db.refresh(repo)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Failed to import repository.")
        
    return repo

@router.get("/", response_model=list[RepositoryResponse])
def list_repositories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(GithubAccount).filter(GithubAccount.user_id == current_user.id).first()
    if not account:
        return []
    
    repos = db.query(Repository).filter(Repository.github_account_id == account.id).all()
    return repos

@router.get("/{repo_id}", response_model=RepositoryResponse)
def get_repository(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(GithubAccount).filter(GithubAccount.user_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=404, detail="Repository not found.")
        
    repo = db.query(Repository).filter(
        Repository.id == repo_id,
        Repository.github_account_id == account.id
    ).first()
    
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")
        
    return repo
