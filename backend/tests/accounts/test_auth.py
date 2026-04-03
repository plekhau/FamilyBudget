import pytest


@pytest.mark.django_db
class TestRegistration:
    def test_register_success(self, api_client):
        response = api_client.post("/api/auth/register/", {
            "email": "alice@example.com",
            "password": "strongpass123",
            "display_name": "Alice",
        })
        assert response.status_code == 201
        assert response.data["email"] == "alice@example.com"
        assert "password" not in response.data

    def test_register_duplicate_email(self, api_client):
        api_client.post("/api/auth/register/", {
            "email": "alice@example.com",
            "password": "strongpass123",
            "display_name": "Alice",
        })
        response = api_client.post("/api/auth/register/", {
            "email": "alice@example.com",
            "password": "anotherpass",
            "display_name": "Alice2",
        })
        assert response.status_code == 400

    def test_register_missing_email(self, api_client):
        response = api_client.post("/api/auth/register/", {
            "password": "strongpass123",
            "display_name": "Alice",
        })
        assert response.status_code == 400


@pytest.mark.django_db
class TestTokenAuth:
    def test_login_returns_tokens(self, api_client):
        api_client.post("/api/auth/register/", {
            "email": "bob@example.com",
            "password": "strongpass123",
            "display_name": "Bob",
        })
        response = api_client.post("/api/auth/token/", {
            "email": "bob@example.com",
            "password": "strongpass123",
        })
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data

    def test_login_wrong_password(self, api_client):
        api_client.post("/api/auth/register/", {
            "email": "bob@example.com",
            "password": "strongpass123",
            "display_name": "Bob",
        })
        response = api_client.post("/api/auth/token/", {
            "email": "bob@example.com",
            "password": "wrongpass",
        })
        assert response.status_code == 401

    def test_logout_blacklists_refresh(self, api_client):
        api_client.post("/api/auth/register/", {
            "email": "bob@example.com",
            "password": "strongpass123",
            "display_name": "Bob",
        })
        login = api_client.post("/api/auth/token/", {
            "email": "bob@example.com",
            "password": "strongpass123",
        })
        refresh = login.data["refresh"]
        response = api_client.post("/api/auth/token/blacklist/", {"refresh": refresh})
        assert response.status_code == 200

        # Blacklisted token can no longer be refreshed
        retry = api_client.post("/api/auth/token/refresh/", {"refresh": refresh})
        assert retry.status_code == 401
