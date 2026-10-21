import os
import shutil
import pytest
from pathlib import Path
from app.core.workspace import WorkspaceManager, WORKSPACES_DIR

# We'll use a dummy repo_id for testing
TEST_REPO_ID = "test_repo_123"

@pytest.fixture(autouse=True)
def setup_teardown_workspace():
    # Setup
    workspace_path = WORKSPACES_DIR / TEST_REPO_ID
    workspace_path.mkdir(parents=True, exist_ok=True)
    
    # Create some files
    (workspace_path / "main.py").write_text("print('hello')")
    (workspace_path / "secret.key").write_text("supersecret")
    
    # Create a directory
    src_dir = workspace_path / "src"
    src_dir.mkdir()
    (src_dir / "utils.py").write_text("def add(a, b): return a + b")
    
    # Create .gitignore
    (workspace_path / ".gitignore").write_text("secret.key\n*.log\n")
    
    # Create an ignored log file
    (workspace_path / "test.log").write_text("log data")

    # Create a .git dir which should always be ignored
    git_dir = workspace_path / ".git"
    git_dir.mkdir()
    (git_dir / "config").write_text("git config")

    yield
    
    # Teardown
    if workspace_path.exists():
        shutil.rmtree(workspace_path, ignore_errors=True)

def test_get_workspace_path():
    path = WorkspaceManager.get_workspace_path(TEST_REPO_ID)
    assert path.name == TEST_REPO_ID
    
    # Test path traversal prevention
    with pytest.raises(ValueError):
        WorkspaceManager.get_workspace_path("../malicious")

def test_get_file_tree():
    tree = WorkspaceManager.get_file_tree(TEST_REPO_ID)
    
    # Check that main.py and src/utils.py are in the tree
    files_in_root = [node["name"] for node in tree if node["type"] == "file"]
    assert "main.py" in files_in_root
    assert ".gitignore" in files_in_root
    
    # Check that ignored files are NOT in the tree
    assert "secret.key" not in files_in_root
    assert "test.log" not in files_in_root
    
    # Check that .git is ignored
    dirs_in_root = [node["name"] for node in tree if node["type"] == "directory"]
    assert ".git" not in dirs_in_root
    assert "src" in dirs_in_root
    
    # Check src contents
    src_node = next(node for node in tree if node["name"] == "src")
    src_files = [child["name"] for child in src_node["children"]]
    assert "utils.py" in src_files

def test_read_file():
    # Read normal file
    content = WorkspaceManager.read_file(TEST_REPO_ID, "main.py")
    assert content == "print('hello')"
    
    # Read nested file
    content = WorkspaceManager.read_file(TEST_REPO_ID, "src/utils.py")
    assert "def add(a, b):" in content
    
    # Attempt path traversal
    with pytest.raises(ValueError):
        WorkspaceManager.read_file(TEST_REPO_ID, "../../../etc/passwd")
        
    # File not found
    with pytest.raises(FileNotFoundError):
        WorkspaceManager.read_file(TEST_REPO_ID, "nonexistent.py")
