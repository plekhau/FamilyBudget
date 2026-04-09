# tests/budgets/test_transactions.py
import pytest


@pytest.fixture
def space_and_category(auth_client):
    space = auth_client.post("/api/spaces/", {"name": "Tx Space"})
    assert space.status_code == 201
    space_id = space.data["id"]
    categories = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
    category_id = categories.data[0]["id"]
    return space_id, category_id


@pytest.mark.django_db
class TestTransactionAPI:
    def test_create_transaction(self, auth_client, space_and_category):
        """Creating a transaction with valid data returns 201, the correct amount, and sets created_by automatically."""
        space_id, category_id = space_and_category
        response = auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id,
            "category": category_id,
            "amount": "42.50",
            "date": "2026-03-15",
            "paid_by": auth_client._user.id,
            "notes": "Test purchase",
        })
        assert response.status_code == 201
        assert response.data["amount"] == "42.50"
        assert response.data["created_by"] == auth_client._user.id

    def test_list_transactions_filtered_by_month(self, auth_client, space_and_category):
        """The month filter returns only transactions whose date falls within the specified month."""
        space_id, category_id = space_and_category
        user_id = auth_client._user.id
        auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "10.00", "date": "2026-03-01", "paid_by": user_id,
        })
        auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "20.00", "date": "2026-04-01", "paid_by": user_id,
        })
        response = auth_client.get(
            f"/api/budgets/transactions/?space_id={space_id}&month=2026-03"
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["amount"] == "10.00"

    def test_list_transactions_filtered_by_category(self, auth_client, space_and_category):
        """The category_id filter returns only transactions belonging to that category."""
        space_id, category_id = space_and_category
        user_id = auth_client._user.id
        auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "15.00", "date": "2026-03-01", "paid_by": user_id,
        })
        response = auth_client.get(
            f"/api/budgets/transactions/?space_id={space_id}&category_id={category_id}"
        )
        assert response.status_code == 200
        assert all(t["category"] == category_id for t in response.data)

    def test_update_transaction(self, auth_client, space_and_category):
        """Updating a transaction via PUT replaces its amount and returns the updated data."""
        space_id, category_id = space_and_category
        user_id = auth_client._user.id
        create = auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "10.00", "date": "2026-03-01", "paid_by": user_id,
        })
        tx_id = create.data["id"]
        response = auth_client.put(f"/api/budgets/transactions/{tx_id}/", {
            "category": category_id,
            "amount": "99.00",
            "date": "2026-03-01",
            "paid_by": user_id,
        })
        assert response.status_code == 200
        assert response.data["amount"] == "99.00"

    def test_delete_transaction(self, auth_client, space_and_category):
        """Deleting a transaction returns 204 with no content."""
        space_id, category_id = space_and_category
        user_id = auth_client._user.id
        create = auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "10.00", "date": "2026-03-01", "paid_by": user_id,
        })
        tx_id = create.data["id"]
        response = auth_client.delete(f"/api/budgets/transactions/{tx_id}/")
        assert response.status_code == 204
