import pytest
from unittest.mock import patch, MagicMock
from pathlib import Path
from app.core.pr_creator import PRCreator
from app.models.review import AIComment
from app.models.analysis import AnalysisIssue
from app.models.repository import Repository
from app.models.github import GithubAccount
from app.models.user import User

from app.core.encryption import encrypt_string

@patch("app.core.pr_creator.Github")
@patch("app.core.pr_creator.subprocess.run")
@patch("app.core.pr_creator.WorkspaceManager.get_workspace_path")
@patch("app.core.pr_creator.SandboxManager._apply_patch")
def test_create_pr(mock_apply, mock_get_workspace, mock_run, mock_github, tmp_path):
    mock_get_workspace.return_value = tmp_path
    mock_run.return_value.returncode = 0
    mock_run.return_value.stdout = "modified"
    mock_run.return_value.stderr = ""
    
    mock_db = MagicMock()
    
    # Mocks
    mock_issue = AnalysisIssue(rule_id="F401")
    comment = AIComment(
        id="c1",
        file_path="test.py",
        line_number=1,
        suggested_fix="fix",
        is_verified=True,
        issue=mock_issue
    )
    repo = Repository(id="r1", clone_url="https://github.com/owner/repo.git", full_name="owner/repo", default_branch="main")
    account = GithubAccount(encrypted_credentials=encrypt_string("fake_token"))
    
    # A simple mock query that returns the right object based on what was filtered
    mock_query = mock_db.query.return_value
    mock_filter = mock_query.filter.return_value
    mock_filter.first.side_effect = [comment, repo, account]

    mock_gh_repo = MagicMock()
    mock_gh_repo.permissions.push = True
    mock_gh_repo.get_pulls.return_value = []
    mock_pr = MagicMock()
    mock_pr.html_url = "https://github.com/owner/repo/pull/1"
    mock_gh_repo.create_pull.return_value = mock_pr
    mock_github.return_value.get_repo.return_value = mock_gh_repo

    pr_url = PRCreator.create_pr("r1", "c1", mock_db)

    assert pr_url == "https://github.com/owner/repo/pull/1"
    assert comment.pr_url == "https://github.com/owner/repo/pull/1"
    
    # Verify github args
    mock_gh_repo.create_pull.assert_called_once()
    kwargs = mock_gh_repo.create_pull.call_args[1]
    assert "F401" in kwargs["title"]
    assert kwargs["head"] == "fix-veripatch-c1"
    assert kwargs["base"] == "main"
