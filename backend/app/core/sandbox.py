import subprocess
from pathlib import Path
from sqlalchemy.orm import Session

from app.models.review import AIComment
from app.models.analysis import AnalysisIssue
from app.core.workspace import WorkspaceManager
from app.core.analyzer import StaticAnalyzer

class SandboxManager:
    @staticmethod
    def _apply_patch(workspace_path: Path, file_path: str, line_number: int, fix: str):
        target_path = workspace_path / file_path
        with open(target_path, "r", encoding="utf-8") as f:
            lines = f.readlines()
            
        # Line numbers are 1-indexed, lists are 0-indexed
        idx = line_number - 1
        if 0 <= idx < len(lines):
            # Naive line replacement for MVP
            # Ensure the fix maintains a newline
            lines[idx] = fix if fix.endswith("\n") else fix + "\n"
            
        with open(target_path, "w", encoding="utf-8") as f:
            f.writelines(lines)

    @staticmethod
    def _rollback_file(workspace_path: Path, file_path: str):
        # Use git restore to rollback changes to the specific file
        try:
            subprocess.run(
                ["git", "restore", file_path],
                cwd=str(workspace_path),
                check=True
            )
        except subprocess.CalledProcessError as e:
            print(f"Rollback failed: {e}")

    @staticmethod
    def verify_fix(repo_id: str, comment_id: str, db: Session) -> bool:
        comment = db.query(AIComment).filter(AIComment.id == comment_id).first()
        if not comment or not comment.suggested_fix:
            raise ValueError("Invalid comment or missing suggested fix")
            
        # 1. Setup paths
        workspace_path = WorkspaceManager.get_workspace_path(repo_id)
        if not workspace_path.exists():
            raise ValueError("Workspace not found")
            
        # 2. Apply patch
        SandboxManager._apply_patch(workspace_path, comment.file_path, comment.line_number, comment.suggested_fix)
        
        # 3. Rerun static analysis
        try:
            ruff_issues = StaticAnalyzer.run_ruff(workspace_path)
            mypy_issues = StaticAnalyzer.run_mypy(workspace_path)
            all_new_issues = ruff_issues + mypy_issues
            
            # 4. Check if the original issue is resolved
            # We assume it's resolved if there is no longer an issue with the same rule/message on that line
            original_issue = comment.issue
            
            is_resolved = True
            if original_issue:
                for issue in all_new_issues:
                    if (issue["file_path"] == comment.file_path and 
                        issue["line_number"] == comment.line_number and 
                        issue["rule_id"] == original_issue.rule_id):
                        is_resolved = False
                        break
            else:
                # If there was no original issue linked, we just check if the new file has ANY issues on that line
                for issue in all_new_issues:
                    if issue["file_path"] == comment.file_path and issue["line_number"] == comment.line_number:
                        is_resolved = False
                        break
            
            # Update DB
            comment.is_verified = is_resolved
            db.commit()
            
            return is_resolved
            
        finally:
            # 5. Rollback
            SandboxManager._rollback_file(workspace_path, comment.file_path)
