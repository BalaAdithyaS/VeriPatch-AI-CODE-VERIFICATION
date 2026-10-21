import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
from app.core.sandbox import SandboxManager
from app.models.review import AIComment
from app.models.analysis import AnalysisIssue
from app.models.repository import Repository
from app.models.github import GithubAccount
from app.models.user import User

def test_apply_and_rollback_patch(tmp_path):
    # Setup dummy file
    test_file = tmp_path / "test.py"
    test_file.write_text("line 1\nline 2\nline 3\n")
    
    # Apply patch to line 2 (1-indexed)
    SandboxManager._apply_patch(tmp_path, "test.py", 2, "line 2 patched")
    
    # Check changes
    lines = test_file.read_text().splitlines()
    assert lines[0] == "line 1"
    assert lines[1] == "line 2 patched"
    assert lines[2] == "line 3"

@patch("app.core.sandbox.WorkspaceManager.get_workspace_path")
@patch("app.core.sandbox.StaticAnalyzer.run_ruff")
@patch("app.core.sandbox.StaticAnalyzer.run_mypy")
@patch("app.core.sandbox.SandboxManager._apply_patch")
@patch("app.core.sandbox.SandboxManager._rollback_file")
def test_verify_fix(mock_rollback, mock_apply, mock_mypy, mock_ruff, mock_get_workspace, tmp_path):
    mock_get_workspace.return_value = tmp_path
    
    mock_db = MagicMock()
    
    # Mock comment and issue
    original_issue = AnalysisIssue(id="1", tool="ruff", rule_id="F401", message="unused import")
    comment = AIComment(
        id="c1", 
        file_path="src/main.py", 
        line_number=10, 
        suggested_fix="fixed", 
        issue=original_issue
    )
    
    mock_db.query().filter().first.return_value = comment
    
    # 1. Test success (issue is resolved)
    mock_ruff.return_value = [] # No issues returned
    mock_mypy.return_value = []
    
    is_verified = SandboxManager.verify_fix("repo123", "c1", mock_db)
    
    assert is_verified is True
    assert comment.is_verified is True
    mock_apply.assert_called_once()
    mock_rollback.assert_called_once()
    
    # 2. Test failure (issue still exists)
    mock_ruff.return_value = [{
        "file_path": "src/main.py",
        "line_number": 10,
        "rule_id": "F401",
        "message": "unused import"
    }]
    
    is_verified_failed = SandboxManager.verify_fix("repo123", "c1", mock_db)
    assert is_verified_failed is False
    assert comment.is_verified is False
