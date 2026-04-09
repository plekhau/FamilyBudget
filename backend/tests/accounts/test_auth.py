import pytest


@pytest.mark.django_db
class TestRegistration:
    def test_register_success(self, api_client):
        """Registering with valid data returns 201 and omits the password from the response."""
        response = api_client.post("/api/auth/register/", {
            "email": "alice@example.com",
            "password": "strongpass123",
            "display_name": "Alice",
        })
        assert response.status_code == 201
        assert response.data["email"] == "alice@example.com"
        assert "password" not in response.data

    def test_register_duplicate_email(self, api_client):
        """Registering with an already-taken email returns 400."""
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
        """Registering without an email field returns 400."""
        response = api_client.post("/api/auth/register/", {
            "password": "strongpass123",
            "display_name": "Alice",
        })
        assert response.status_code == 400


@pytest.mark.django_db
class TestTokenAuth:
    def test_login_returns_tokens(self, api_client):
        """Logging in with correct credentials returns both access and refresh tokens."""
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
        """Logging in with an incorrect password returns 401."""
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
        """Blacklisting a refresh token prevents it from being used to obtain a new access token."""
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
