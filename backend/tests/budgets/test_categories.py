# tests/budgets/test_categories.py
import pytest


@pytest.fixture
def space_id(auth_client):
    response = auth_client.post("/api/spaces/", {"name": "Budget Space"})
    assert response.status_code == 201
    return response.data["id"]


@pytest.mark.django_db
class TestCategoryAPI:
    def test_list_categories_for_space(self, auth_client, space_id):
        response = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
        assert response.status_code == 200
        assert len(response.data) == 11  # default categories

    def test_list_requires_space_id(self, auth_client):
        response = auth_client.get("/api/budgets/categories/")
        assert response.status_code == 400

    def test_create_category(self, auth_client, space_id):
        response = auth_client.post("/api/budgets/categories/", {
            "space_id": space_id,
            "name": "Piano Lessons",
            "icon": "🎹",
            "is_income": False,
        })
        assert response.status_code == 201
        assert response.data["name"] == "Piano Lessons"

    def test_update_category(self, auth_client, space_id):
        list_response = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
        cat_id = list_response.data[0]["id"]
        response = auth_client.put(f"/api/budgets/categories/{cat_id}/", {
            "name": "Renamed",
            "icon": "🏡",
            "is_income": False,
        })
        assert response.status_code == 200
        assert response.data["name"] == "Renamed"

    def test_delete_category(self, auth_client, space_id):
        list_response = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
        cat_id = list_response.data[0]["id"]
        response = auth_client.delete(f"/api/budgets/categories/{cat_id}/")
        assert response.status_code == 204

    def test_cannot_access_other_space_categories(self, auth_client, api_client):
        from apps.accounts.models import User
        other_user = User.objects.create_user(
            email="other2@example.com",
            password="testpass123",
            display_name="Other",
        )
        api_client.force_authenticate(user=other_user)
        other_space = api_client.post("/api/spaces/", {"name": "Other Space"})
        assert other_space.status_code == 201
        other_space_id = other_space.data["id"]

        response = auth_client.get(f"/api/budgets/categories/?space_id={other_space_id}")
        assert response.status_code == 403
