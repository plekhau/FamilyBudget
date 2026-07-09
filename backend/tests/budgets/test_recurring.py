# tests/budgets/test_recurring.py
from datetime import date, timedelta

import pytest
from dateutil.relativedelta import relativedelta

from apps.budgets.models import Transaction


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
        response = auth_client.post(
            "/api/budgets/recurring-transactions/",
            {
                "space_id": space_id,
                "category": category_id,
                "amount": "1500.00",
                "description": "Monthly Rent",
                "frequency": "monthly",
                "start_date": "2026-01-01",
                "next_due_date": "2026-04-01",
                "is_active": True,
            },
        )
        assert response.status_code == 201
        assert response.data["description"] == "Monthly Rent"

    def test_create_due_today_generates_transaction_immediately(self, auth_client, space_and_category):
        """Creating a recurring transaction due today immediately creates the matching transaction."""
        space_id, category_id = space_and_category
        today = date.today()
        response = auth_client.post(
            "/api/budgets/recurring-transactions/",
            {
                "space_id": space_id,
                "category": category_id,
                "amount": "1500.00",
                "description": "Monthly Rent",
                "frequency": "monthly",
                "start_date": today.isoformat(),
                "next_due_date": today.isoformat(),
                "is_active": True,
            },
        )
        assert response.status_code == 201
        tx = Transaction.objects.get()
        assert str(tx.amount) == "1500.00"
        assert tx.date == today
        assert tx.paid_by == auth_client._user
        assert tx.created_by == auth_client._user
        assert response.data["next_due_date"] == (today + relativedelta(months=1)).isoformat()

    def test_create_past_due_catches_up_missed_occurrences(self, auth_client, space_and_category):
        """Creating a recurring transaction with a past due date generates one transaction per missed period."""
        space_id, category_id = space_and_category
        start = date.today() - relativedelta(months=2)
        response = auth_client.post(
            "/api/budgets/recurring-transactions/",
            {
                "space_id": space_id,
                "category": category_id,
                "amount": "50.00",
                "description": "Spotify",
                "frequency": "monthly",
                "start_date": start.isoformat(),
                "next_due_date": start.isoformat(),
                "is_active": True,
            },
        )
        assert response.status_code == 201
        dates = sorted(Transaction.objects.values_list("date", flat=True))
        assert dates == [date.today() - relativedelta(months=offset) for offset in (2, 1, 0)]

    def test_create_future_due_generates_no_transaction(self, auth_client, space_and_category):
        """Creating a recurring transaction due in the future does not create any transaction."""
        space_id, category_id = space_and_category
        future = date.today() + timedelta(days=5)
        response = auth_client.post(
            "/api/budgets/recurring-transactions/",
            {
                "space_id": space_id,
                "category": category_id,
                "amount": "50.00",
                "description": "Spotify",
                "frequency": "monthly",
                "start_date": future.isoformat(),
                "next_due_date": future.isoformat(),
                "is_active": True,
            },
        )
        assert response.status_code == 201
        assert Transaction.objects.count() == 0

    def test_create_inactive_generates_no_transaction(self, auth_client, space_and_category):
        """Creating an inactive recurring transaction does not create any transaction even when due."""
        space_id, category_id = space_and_category
        today = date.today()
        response = auth_client.post(
            "/api/budgets/recurring-transactions/",
            {
                "space_id": space_id,
                "category": category_id,
                "amount": "50.00",
                "description": "Spotify",
                "frequency": "monthly",
                "start_date": today.isoformat(),
                "next_due_date": today.isoformat(),
                "is_active": False,
            },
        )
        assert response.status_code == 201
        assert Transaction.objects.count() == 0

    def test_list_recurring(self, auth_client, space_and_category):
        """Listing recurring transactions for a space returns only that space's records."""
        space_id, category_id = space_and_category
        auth_client.post(
            "/api/budgets/recurring-transactions/",
            {
                "space_id": space_id,
                "category": category_id,
                "amount": "50.00",
                "description": "Spotify",
                "frequency": "monthly",
                "start_date": "2026-01-01",
                "next_due_date": "2026-04-01",
                "is_active": True,
            },
        )
        response = auth_client.get(f"/api/budgets/recurring-transactions/?space_id={space_id}")
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_deactivate_recurring(self, auth_client, space_and_category):
        """Updating a recurring transaction's is_active to False marks it as inactive."""
        space_id, category_id = space_and_category
        create = auth_client.post(
            "/api/budgets/recurring-transactions/",
            {
                "space_id": space_id,
                "category": category_id,
                "amount": "50.00",
                "description": "Spotify",
                "frequency": "monthly",
                "start_date": "2026-01-01",
                "next_due_date": "2026-04-01",
                "is_active": True,
            },
        )
        rt_id = create.data["id"]
        response = auth_client.put(
            f"/api/budgets/recurring-transactions/{rt_id}/",
            {
                "category": category_id,
                "amount": "50.00",
                "description": "Spotify",
                "frequency": "monthly",
                "start_date": "2026-01-01",
                "next_due_date": "2026-04-01",
                "is_active": False,
            },
        )
        assert response.status_code == 200
        assert response.data["is_active"] is False
