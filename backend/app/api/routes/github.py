from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from github import Github, GithubException

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.encryption import encrypt_string
from app.models.user import User
from app.models.github import GithubAccount
from app.schemas.github import GithubConnectRequest, GithubAccountResponse, GithubStatusResponse
from app.schemas.repository import RemoteRepository

router = APIRouter()

@router.post("/connect", response_model=GithubAccountResponse)
def connect_github(
    request: GithubConnectRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        gh = Github(request.personal_access_token)
        gh_user = gh.get_user()
        
        # Check if already connected for this user
        account = db.query(GithubAccount).filter(GithubAccount.user_id == current_user.id).first()
        
        encrypted_token = encrypt_string(request.personal_access_token)
        
        if account:
            account.github_user_id = str(gh_user.id)
            account.username = gh_user.login
            account.encrypted_credentials = encrypted_token
        else:
            account = GithubAccount(
                user_id=current_user.id,
                github_user_id=str(gh_user.id),
                username=gh_user.login,
                encrypted_credentials=encrypted_token
            )
            db.add(account)
            
        db.commit()
        db.refresh(account)
        return account
        
    except GithubException as e:
        raise HTTPException(status_code=400, detail="Invalid GitHub token or unable to connect.")

@router.get("/status", response_model=GithubStatusResponse)
def get_github_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    account = db.query(GithubAccount).filter(GithubAccount.user_id == current_user.id).first()
    if account:
        return {"connected": True, "username": account.username}
    return {"connected": False, "username": None}

@router.get("/repositories", response_model=list[RemoteRepository])
def list_remote_repositories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    from app.core.encryption import decrypt_string
    account = db.query(GithubAccount).filter(GithubAccount.user_id == current_user.id).first()
    if not account:
        raise HTTPException(status_code=400, detail="GitHub account not connected.")
        
    try:
        token = decrypt_string(account.encrypted_credentials)
        gh = Github(token)
        
        repos = []
        for repo in gh.get_user().get_repos(type="owner"):
            repos.append({
                "github_id": str(repo.id),
                "name": repo.name,
                "full_name": repo.full_name,
                "owner": repo.owner.login,
                "private": repo.private,
                "clone_url": repo.clone_url,
                "default_branch": repo.default_branch,
                "language": repo.language
            })
        return repos
    except GithubException:
        raise HTTPException(status_code=500, detail="Failed to fetch repositories from GitHub.")
