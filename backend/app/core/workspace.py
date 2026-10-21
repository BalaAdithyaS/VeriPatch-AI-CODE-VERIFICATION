import os
import shutil
import pathspec
from pathlib import Path
from git import Repo, GitCommandError
from app.core.config import settings

# Base directory where all repositories will be cloned
WORKSPACES_DIR = Path(os.getcwd()) / ".workspaces"

class WorkspaceManager:
    @staticmethod
    def get_workspace_path(repo_id: str) -> Path:
        """Returns the absolute path for a repository's workspace."""
        path = (WORKSPACES_DIR / repo_id).resolve()
        # Prevent path traversal
        if not str(path).startswith(str(WORKSPACES_DIR.resolve())):
            raise ValueError("Invalid repository ID")
        return path

    @staticmethod
    def clone_repository(repo_id: str, clone_url: str, token: str) -> bool:
        """
        Clones the repository into the workspace directory.
        Injects the PAT into the clone URL for authentication.
        """
        workspace_path = WorkspaceManager.get_workspace_path(repo_id)
        
        # If already exists, clear it (or we could fetch/pull, but clean clone is safer for MVP)
        if workspace_path.exists():
            shutil.rmtree(workspace_path, ignore_errors=True)
            
        workspace_path.parent.mkdir(parents=True, exist_ok=True)
        
        # Construct authenticated URL
        # e.g. https://github.com/owner/repo.git -> https://<token>@github.com/owner/repo.git
        if clone_url.startswith("https://"):
            auth_url = clone_url.replace("https://", f"https://{token}@")
        else:
            auth_url = clone_url

        try:
            Repo.clone_from(auth_url, workspace_path)
            return True
        except GitCommandError as e:
            print(f"Git clone failed: {e}")
            return False

    @staticmethod
    def _get_ignore_spec(workspace_path: Path):
        """Compiles a pathspec from .gitignore rules."""
        gitignore_path = workspace_path / ".gitignore"
        lines = []
        if gitignore_path.exists():
            with open(gitignore_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
        
        # Always ignore .git directory
        lines.append(".git/")
        
        return pathspec.PathSpec.from_lines(pathspec.patterns.gitwildmatch.GitWildMatchPattern, lines)

    @staticmethod
    def get_file_tree(repo_id: str) -> list:
        """
        Returns a hierarchical list of files in the workspace,
        ignoring those matched by .gitignore.
        """
        workspace_path = WorkspaceManager.get_workspace_path(repo_id)
        if not workspace_path.exists():
            return []

        spec = WorkspaceManager._get_ignore_spec(workspace_path)
        
        def build_tree(current_dir: Path, relative_to: Path):
            tree = []
            try:
                for item in current_dir.iterdir():
                    rel_path = item.relative_to(relative_to)
                    rel_path_str = str(rel_path).replace("\\", "/")
                    # Check if ignored
                    if spec.match_file(rel_path_str):
                        continue
                        
                    if item.is_dir():
                        children = build_tree(item, relative_to)
                        if children: # only add non-empty directories (or those not fully ignored)
                            tree.append({
                                "name": item.name,
                                "path": str(rel_path).replace("\\", "/"),
                                "type": "directory",
                                "children": children
                            })
                    else:
                        tree.append({
                            "name": item.name,
                            "path": str(rel_path).replace("\\", "/"),
                            "type": "file"
                        })
            except PermissionError:
                pass
            
            # Sort: directories first, then files alphabetically
            tree.sort(key=lambda x: (0 if x["type"] == "directory" else 1, x["name"].lower()))
            return tree

        return build_tree(workspace_path, workspace_path)

    @staticmethod
    def read_file(repo_id: str, file_path: str) -> str:
        """
        Reads the contents of a file within the workspace securely.
        Raises ValueError if attempting to read outside the workspace.
        Raises FileNotFoundError if file doesn't exist.
        """
        workspace_path = WorkspaceManager.get_workspace_path(repo_id)
        target_path = (workspace_path / file_path).resolve()
        
        if not str(target_path).startswith(str(workspace_path)):
            raise ValueError("Path traversal detected")
            
        if not target_path.exists() or not target_path.is_file():
            raise FileNotFoundError("File not found")
            
        # For simplicity, read as UTF-8, ignore errors or fallback could be implemented
        try:
            with open(target_path, "r", encoding="utf-8") as f:
                return f.read()
        except UnicodeDecodeError:
            return "[Binary file or unsupported encoding]"
