import pytest
from pathlib import Path
from unittest.mock import patch, MagicMock
from app.core.analyzer import StaticAnalyzer

def test_run_ruff_parsing():
    # Mock subprocess.run
    mock_result = MagicMock()
    mock_result.stdout = """[
        {
            "code": "F401",
            "message": "module imported but unused",
            "location": {"row": 10, "column": 5},
            "filename": "/workspace/src/app.py"
        },
        {
            "code": "W291",
            "message": "trailing whitespace",
            "location": {"row": 12, "column": 20},
            "filename": "/workspace/src/utils.py"
        }
    ]"""
    
    with patch("subprocess.run", return_value=mock_result):
        issues = StaticAnalyzer.run_ruff(Path("/workspace"))
        
        assert len(issues) == 2
        
        assert issues[0]["tool"] == "ruff"
        assert issues[0]["rule_id"] == "F401"
        assert issues[0]["severity"] == "error" # F is not W
        assert issues[0]["line_number"] == 10
        assert issues[0]["column_number"] == 5
        assert issues[0]["file_path"] == "src/app.py"

        assert issues[1]["severity"] == "warning"

def test_run_mypy_parsing():
    mock_result = MagicMock()
    # mypy output format
    mock_result.stdout = """
src/main.py:15: error: Incompatible types in assignment (expression has type "int", variable has type "str")  [assignment]
src/utils.py:22:8: note: This is a note
src/bad.py:10: error: Cannot find implementation or library stub for module named 'xyz'
    """.strip()
    
    with patch("subprocess.run", return_value=mock_result):
        issues = StaticAnalyzer.run_mypy(Path("/workspace"))
        
        # Should parse 3 issues
        assert len(issues) == 3
        
        assert issues[0]["file_path"] == "src/main.py"
        assert issues[0]["line_number"] == 15
        assert issues[0]["column_number"] is None
        assert issues[0]["severity"] == "error"
        assert issues[0]["rule_id"] == "assignment"
        
        assert issues[1]["line_number"] == 22
        assert issues[1]["column_number"] == 8
        assert issues[1]["severity"] == "note"
        
        assert issues[2]["rule_id"] is None
        assert issues[2]["severity"] == "error"
