from sqlalchemy.orm import Session
from datetime import datetime
from pathlib import Path

from app.models.review import AIReview, AIComment
from app.models.analysis import AnalysisRun, AnalysisIssue
from app.core.workspace import WorkspaceManager

class MockLLMProvider:
    """A mock LLM that generates fake code review comments and fixes based on static analysis issues."""
    
    @staticmethod
    def generate_review(file_path: str, code_content: str, issues: list) -> list:
        comments = []
        for issue in issues:
            # Generate a mock comment and fix based on the issue rule/message
            if issue.tool == "ruff" and issue.rule_id == "F401":
                comments.append({
                    "file_path": file_path,
                    "line_number": issue.line_number,
                    "comment": "This import is unused. It is good practice to remove unused imports to reduce cognitive load and avoid potential naming conflicts.",
                    "suggested_fix": f"# Removed unused import at line {issue.line_number}",
                    "issue_id": issue.id
                })
            elif issue.tool == "mypy" and "Incompatible types" in issue.message:
                comments.append({
                    "file_path": file_path,
                    "line_number": issue.line_number,
                    "comment": "There is a type mismatch here. Ensure that the variable is correctly typed or cast it explicitly.",
                    "suggested_fix": "# Example fix: x = int(y) if isinstance(y, str) else y",
                    "issue_id": issue.id
                })
            else:
                comments.append({
                    "file_path": file_path,
                    "line_number": issue.line_number,
                    "comment": f"AI Code Review: The tool '{issue.tool}' flagged this line. Consider refactoring to address the issue: {issue.message}",
                    "suggested_fix": f"# TODO: Fix {issue.rule_id or 'issue'}\n# {issue.message}",
                    "issue_id": issue.id
                })
        
        # Add a random global comment just to show AI can generate things outside of static analysis
        if not issues and len(code_content) > 0:
            comments.append({
                "file_path": file_path,
                "line_number": 1,
                "comment": "AI Code Review: This file looks clean! Consider adding a module-level docstring if it's missing.",
                "suggested_fix": '\"\"\"\nModule docstring explaining the purpose of this file.\n\"\"\"\n',
                "issue_id": None
            })
            
        return comments

class AIReviewer:
    @staticmethod
    def run_review(repo_id: str, db: Session) -> AIReview:
        review = AIReview(repository_id=repo_id, status="running")
        db.add(review)
        db.commit()
        db.refresh(review)
        
        try:
            # 1. Fetch latest analysis run
            latest_run = db.query(AnalysisRun).filter(
                AnalysisRun.repository_id == repo_id,
                AnalysisRun.status == "completed"
            ).order_by(AnalysisRun.created_at.desc()).first()
            
            issues_by_file = {}
            if latest_run:
                for issue in latest_run.issues:
                    if issue.file_path not in issues_by_file:
                        issues_by_file[issue.file_path] = []
                    issues_by_file[issue.file_path].append(issue)
                    
            # 2. Iterate through files and call LLM
            # For MVP, we only review files that have issues, to save time/tokens.
            # In a real app, we'd review the diff or all files.
            for file_path, issues in issues_by_file.items():
                try:
                    code_content = WorkspaceManager.read_file(repo_id, file_path)
                except Exception:
                    continue # Skip if unreadable
                    
                # Call LLM
                generated_comments = MockLLMProvider.generate_review(file_path, code_content, issues)
                
                # Save comments
                for comment_data in generated_comments:
                    comment = AIComment(
                        review_id=review.id,
                        file_path=comment_data["file_path"],
                        line_number=comment_data["line_number"],
                        comment=comment_data["comment"],
                        suggested_fix=comment_data["suggested_fix"],
                        issue_id=comment_data["issue_id"]
                    )
                    db.add(comment)
                    
            review.status = "completed"
            review.completed_at = datetime.utcnow()
            db.commit()
            
        except Exception as e:
            print(f"AI Review failed: {e}")
            review.status = "failed"
            db.commit()
            
        return review
