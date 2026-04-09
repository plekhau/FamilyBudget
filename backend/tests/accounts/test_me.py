import pytest


@pytest.mark.django_db
class TestMeEndpoint:
    def test_get_profile_returns_user_data(self, auth_client):
        """GET /api/auth/me/ returns the authenticated user's id, email, and display_name."""
        response = auth_client.get("/api/auth/me/")
        assert response.status_code == 200
        assert response.data["email"] == auth_client._user.email
        assert response.data["display_name"] == auth_client._user.display_name
        assert "password" not in response.data

    def test_patch_display_name(self, auth_client):
        """PATCH /api/auth/me/ with a new display_name updates the user's display_name."""
        response = auth_client.patch("/api/auth/me/", {"display_name": "Updated Name"})
        assert response.status_code == 200
        auth_client._user.refresh_from_db()
        assert auth_client._user.display_name == "Updated Name"

    def test_patch_ignores_email(self, auth_client):
        """PATCH /api/auth/me/ with an email field in the payload does not change the user's email."""
        original_email = auth_client._user.email
        auth_client.patch("/api/auth/me/", {"email": "hacker@example.com"})
        auth_client._user.refresh_from_db()
        assert auth_client._user.email == original_email

    def test_unauthenticated_returns_401(self, api_client):
        """GET /api/auth/me/ without authentication returns 401."""
        response = api_client.get("/api/auth/me/")
        assert response.status_code == 401
