import pytest
from app.core.ai_reviewer import MockLLMProvider
from app.models.analysis import AnalysisIssue
from app.models.repository import Repository # Needed for SQLAlchemy registry
from app.models.github import GithubAccount
from app.models.user import User

def test_mock_llm_provider():
    # 1. Test with issues
    issues = [
        AnalysisIssue(id="1", tool="ruff", rule_id="F401", message="unused import", line_number=10),
        AnalysisIssue(id="2", tool="mypy", rule_id="assignment", message="Incompatible types in assignment", line_number=20),
        AnalysisIssue(id="3", tool="flake8", rule_id="E501", message="line too long", line_number=30),
    ]
    
    code = "import os\nx = 5\ny = 'hello'"
    
    comments = MockLLMProvider.generate_review("src/main.py", code, issues)
    
    assert len(comments) == 3
    
    assert comments[0]["issue_id"] == "1"
    assert "unused import" in comments[0]["comment"]
    assert "suggested_fix" in comments[0]
    
    assert comments[1]["issue_id"] == "2"
    assert "type mismatch" in comments[1]["comment"]
    
    assert comments[2]["issue_id"] == "3"
    assert "flake8" in comments[2]["comment"]
    
    # 2. Test without issues but with code content
    comments_clean = MockLLMProvider.generate_review("src/clean.py", "print('hello')", [])
    assert len(comments_clean) == 1
    assert "clean" in comments_clean[0]["comment"]
    assert comments_clean[0]["issue_id"] is None
