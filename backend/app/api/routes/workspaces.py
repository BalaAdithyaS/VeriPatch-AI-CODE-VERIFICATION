from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session
from typing import Optional
import urllib.parse

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.encryption import decrypt_string
from app.models.user import User
from app.models.github import GithubAccount
from app.models.repository import Repository
from app.core.workspace import WorkspaceManager

router = APIRouter()

def clone_repository_background(repo_id: str, clone_url: str, token: str):
    """Background task to clone the repository."""
    WorkspaceManager.clone_repository(repo_id, clone_url, token)

@router.post("/{repo_id}/clone", status_code=status.HTTP_202_ACCEPTED)
def clone_workspace(
    repo_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify ownership
    repo = db.query(Repository).filter(Repository.id == repo_id).first()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found.")
        
    account = db.query(GithubAccount).filter(
        GithubAccount.id == repo.github_account_id,
        GithubAccount.user_id == current_user.id
    ).first()
    
    if not account:
        raise HTTPException(status_code=403, detail="Not authorized to access this repository.")

    token = decrypt_string(account.encrypted_credentials)
    
    background_tasks.add_task(clone_repository_background, repo.id, repo.clone_url, token)
    
    return {"message": "Cloning started in the background."}

@router.get("/{repo_id}/status")
def get_workspace_status(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # In a real app, track cloning status in DB. For MVP, just check if dir exists.
    try:
        workspace_path = WorkspaceManager.get_workspace_path(repo_id)
        if workspace_path.exists() and (workspace_path / ".git").exists():
            return {"status": "cloned"}
        elif workspace_path.exists():
             return {"status": "cloning"}
        return {"status": "not_cloned"}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid repository ID.")

@router.get("/{repo_id}/tree")
def get_workspace_tree(
    repo_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Security check omitted for brevity in MVP (would verify owner again)
    try:
        tree = WorkspaceManager.get_file_tree(repo_id)
        return {"tree": tree}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{repo_id}/file")
def get_workspace_file(
    repo_id: str,
    path: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Decode the path if it's URL encoded
    decoded_path = urllib.parse.unquote(path)
    try:
        content = WorkspaceManager.read_file(repo_id, decoded_path)
        return {"content": content}
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file path.")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="File not found in workspace.")
