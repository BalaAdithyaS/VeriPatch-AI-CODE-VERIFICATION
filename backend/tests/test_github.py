from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from unittest.mock import patch, MagicMock

from app.main import app
from app.core.database import get_db
from app.models.user import User
from app.core.encryption import encrypt_string, decrypt_string

client = TestClient(app)

def test_encryption_decryption():
    plaintext = "my_secret_token_123"
    encrypted = encrypt_string(plaintext)
    assert encrypted != plaintext
    decrypted = decrypt_string(encrypted)
    assert decrypted == plaintext

def test_github_status_unauthorized():
    response = client.get("/api/v1/github/status")
    assert response.status_code == 401

# For testing authenticated routes, we need a helper to get a token or override dependency
def get_test_user_token(client, email="github_test@example.com"):
    # Register
    client.post("/api/v1/auth/register", json={"email": email, "name": "GH Test", "password": "password"})
    # Login
    response = client.post("/api/v1/auth/login", data={"username": email, "password": "password"})
    return response.json()["access_token"]

def test_github_status_no_account():
    token = get_test_user_token(client)
    response = client.get(
        "/api/v1/github/status",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["connected"] == False

@patch("app.api.routes.github.Github")
def test_github_connect(mock_github_class):
    # Mock the Github client
    mock_gh_instance = MagicMock()
    mock_user = MagicMock()
    mock_user.id = 12345
    mock_user.login = "testuser"
    mock_gh_instance.get_user.return_value = mock_user
    mock_github_class.return_value = mock_gh_instance

    token = get_test_user_token(client, email="connect_test@example.com")
    
    response = client.post(
        "/api/v1/github/connect",
        json={"personal_access_token": "fake_pat"},
        headers={"Authorization": f"Bearer {token}"}
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data["username"] == "testuser"
    assert data["github_user_id"] == "12345"
    assert "encrypted_credentials" not in data # Should not be in response! wait, is it?

    # Check status again
    response_status = client.get(
        "/api/v1/github/status",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response_status.json()["connected"] == True
