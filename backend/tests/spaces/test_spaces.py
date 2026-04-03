# tests/spaces/test_spaces.py
import pytest


@pytest.mark.django_db
class TestSpaceCRUD:
    def test_create_space(self, auth_client):
        response = auth_client.post("/api/spaces/", {"name": "Our Home"})
        assert response.status_code == 201
        assert response.data["name"] == "Our Home"

    def test_create_space_makes_user_owner(self, auth_client):
        response = auth_client.post("/api/spaces/", {"name": "Our Home"})
        space_id = response.data["id"]
        detail = auth_client.get(f"/api/spaces/{space_id}/")
        members = detail.data["members"]
        assert any(
            m["user"]["email"] == "test@example.com" and m["role"] == "owner"
            for m in members
        )

    def test_list_spaces_returns_only_member_spaces(self, auth_client, api_client):
        from apps.accounts.models import User
        other_user = User.objects.create_user(
            email="other@example.com",
            password="testpass123",
            display_name="Other",
        )
        api_client.force_authenticate(user=other_user)
        api_client.post("/api/spaces/", {"name": "Other Space"})

        auth_client.post("/api/spaces/", {"name": "My Space"})

        response = auth_client.get("/api/spaces/")
        assert response.status_code == 200
        names = [s["name"] for s in response.data]
        assert "My Space" in names
        assert "Other Space" not in names

    def test_delete_space_owner_only(self, auth_client, api_client):
        space = auth_client.post("/api/spaces/", {"name": "To Delete"})
        space_id = space.data["id"]
        response = auth_client.delete(f"/api/spaces/{space_id}/")
        assert response.status_code == 204

    def test_unauthenticated_cannot_list_spaces(self, api_client):
        response = api_client.get("/api/spaces/")
        assert response.status_code == 401
