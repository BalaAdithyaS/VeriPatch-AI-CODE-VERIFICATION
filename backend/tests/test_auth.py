import uuid
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"

def test_register_user():
    response = client.post(
        "/api/v1/auth/register",
        json={"email": TEST_EMAIL, "name": "Test User", "password": "password123"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == TEST_EMAIL
    assert "id" in data

def test_register_duplicate_user():
    response = client.post(
        "/api/v1/auth/register",
        json={"email": TEST_EMAIL, "name": "Test User 2", "password": "password123"}
    )
    assert response.status_code == 400

def test_login_user():
    response = client.post(
        "/api/v1/auth/login",
        data={"username": TEST_EMAIL, "password": "password123"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    return data["access_token"]

def test_login_wrong_password():
    response = client.post(
        "/api/v1/auth/login",
        data={"username": TEST_EMAIL, "password": "wrongpassword"}
    )
    assert response.status_code == 401

def test_get_current_user():
    token = test_login_user()
    response = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token}"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == TEST_EMAIL
