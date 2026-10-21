import subprocess
import json
import re
from pathlib import Path
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.analysis import AnalysisRun, AnalysisIssue
from app.core.workspace import WorkspaceManager

class StaticAnalyzer:
    @staticmethod
    def run_ruff(workspace_path: Path) -> list:
        issues = []
        try:
            # Run ruff check --output-format=json
            result = subprocess.run(
                ["ruff", "check", ".", "--output-format=json"],
                cwd=str(workspace_path),
                capture_output=True,
                text=True
            )
            # Ruff might exit with 1 if issues are found, this is normal
            if result.stdout:
                data = json.loads(result.stdout)
                for item in data:
                    # Ruff JSON format:
                    # {"code": "F401", "message": "...", "location": {"row": 1, "column": 1}, "filename": "/abs/path"}
                    # Convert absolute filename to relative
                    abs_path = item.get("filename", "")
                    try:
                        rel_path = str(Path(abs_path).relative_to(workspace_path)).replace("\\", "/")
                    except ValueError:
                        rel_path = abs_path
                        
                    issues.append({
                        "tool": "ruff",
                        "file_path": rel_path,
                        "line_number": item.get("location", {}).get("row", 1),
                        "column_number": item.get("location", {}).get("column"),
                        "rule_id": item.get("code"),
                        "message": item.get("message", ""),
                        "severity": "warning" if item.get("code", "").startswith("W") else "error"
                    })
        except Exception as e:
            print(f"Error running ruff: {e}")
        return issues

    @staticmethod
    def run_mypy(workspace_path: Path) -> list:
        issues = []
        try:
            result = subprocess.run(
                ["mypy", ".", "--show-error-codes", "--no-error-summary"],
                cwd=str(workspace_path),
                capture_output=True,
                text=True
            )
            
            # Mypy output: file.py:line:col: error: message  [error-code]
            # or file.py:line: error: message
            pattern = re.compile(r"^(.+?):(\d+):(?:(\d+):)?\s*(error|warning|note):\s*(.+?)(?:\s+\[(.+?)\])?$")
            
            for line in result.stdout.splitlines():
                match = pattern.match(line.strip())
                if match:
                    file_path, line_num, col_num, severity, message, rule_id = match.groups()
                    issues.append({
                        "tool": "mypy",
                        "file_path": file_path.replace("\\", "/"),
                        "line_number": int(line_num),
                        "column_number": int(col_num) if col_num else None,
                        "rule_id": rule_id,
                        "message": message.strip(),
                        "severity": severity
                    })
        except Exception as e:
            print(f"Error running mypy: {e}")
        return issues

    @staticmethod
    def analyze_workspace(repo_id: str, db: Session):
        run = AnalysisRun(repository_id=repo_id, status="running")
        db.add(run)
        db.commit()
        db.refresh(run)
        
        try:
            workspace_path = WorkspaceManager.get_workspace_path(repo_id)
            if not workspace_path.exists():
                raise ValueError("Workspace not found")
                
            ruff_issues = StaticAnalyzer.run_ruff(workspace_path)
            mypy_issues = StaticAnalyzer.run_mypy(workspace_path)
            
            all_issues = ruff_issues + mypy_issues
            
            for issue_data in all_issues:
                issue = AnalysisIssue(
                    run_id=run.id,
                    tool=issue_data["tool"],
                    file_path=issue_data["file_path"],
                    line_number=issue_data["line_number"],
                    column_number=issue_data["column_number"],
                    rule_id=issue_data["rule_id"],
                    message=issue_data["message"],
                    severity=issue_data["severity"]
                )
                db.add(issue)
                
            run.status = "completed"
            run.completed_at = datetime.utcnow()
            db.commit()
            
        except Exception as e:
            print(f"Analysis failed: {e}")
            run.status = "failed"
            db.commit()
            
        return run
