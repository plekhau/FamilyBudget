# tests/budgets/test_recurring.py
import pytest


@pytest.fixture
def space_and_category(auth_client):
    space = auth_client.post("/api/spaces/", {"name": "Recurring Space"})
    assert space.status_code == 201
    space_id = space.data["id"]
    categories = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
    category_id = categories.data[0]["id"]
    return space_id, category_id


@pytest.mark.django_db
class TestRecurringTransactionAPI:
    def test_create_recurring(self, auth_client, space_and_category):
        """Creating a recurring transaction with valid data returns 201 and the correct description."""
        space_id, category_id = space_and_category
        response = auth_client.post("/api/budgets/recurring-transactions/", {
            "space_id": space_id,
            "category": category_id,
            "amount": "1500.00",
            "description": "Monthly Rent",
            "frequency": "monthly",
            "start_date": "2026-01-01",
            "next_due_date": "2026-04-01",
            "is_active": True,
        })
        assert response.status_code == 201
        assert response.data["description"] == "Monthly Rent"

    def test_list_recurring(self, auth_client, space_and_category):
        """Listing recurring transactions for a space returns only that space's records."""
        space_id, category_id = space_and_category
        auth_client.post("/api/budgets/recurring-transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "50.00", "description": "Spotify",
            "frequency": "monthly", "start_date": "2026-01-01",
            "next_due_date": "2026-04-01", "is_active": True,
        })
        response = auth_client.get(f"/api/budgets/recurring-transactions/?space_id={space_id}")
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_deactivate_recurring(self, auth_client, space_and_category):
        """Updating a recurring transaction's is_active to False marks it as inactive."""
        space_id, category_id = space_and_category
        create = auth_client.post("/api/budgets/recurring-transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "50.00", "description": "Spotify",
            "frequency": "monthly", "start_date": "2026-01-01",
            "next_due_date": "2026-04-01", "is_active": True,
        })
        rt_id = create.data["id"]
        response = auth_client.put(f"/api/budgets/recurring-transactions/{rt_id}/", {
            "category": category_id,
            "amount": "50.00", "description": "Spotify",
            "frequency": "monthly", "start_date": "2026-01-01",
            "next_due_date": "2026-04-01", "is_active": False,
        })
        assert response.status_code == 200
        assert response.data["is_active"] is False
