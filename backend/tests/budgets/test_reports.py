# tests/budgets/test_reports.py
import pytest
from datetime import date
from apps.budgets.models import Transaction


@pytest.fixture
def seeded_space(auth_client):
    space = auth_client.post("/api/spaces/", {"name": "Report Space"})
    space_id = space.data["id"]
    categories = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
    cat = categories.data[0]
    user_id = auth_client._user.id
    for day, amount in [("2026-03-05", "100.00"), ("2026-03-20", "50.00"), ("2026-04-01", "200.00")]:
        auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": cat["id"],
            "amount": amount, "date": day, "paid_by": user_id,
        })
    return space_id, cat


@pytest.mark.django_db
class TestReports:
    def test_monthly_summary(self, auth_client, seeded_space):
        space_id, cat = seeded_space
        response = auth_client.get(
            f"/api/budgets/reports/monthly-summary/?space_id={space_id}&month=2026-03"
        )
        assert response.status_code == 200
        assert len(response.data) > 0
        totals = {r["category_id"]: r["total"] for r in response.data}
        assert totals[cat["id"]] == "150.00"

    def test_weekly_summary(self, auth_client, seeded_space):
        space_id, cat = seeded_space
        response = auth_client.get(
            f"/api/budgets/reports/weekly-summary/?space_id={space_id}&week=2026-03-01"
        )
        assert response.status_code == 200
        totals = {r["category_id"]: r["total"] for r in response.data}
        assert totals.get(cat["id"]) == "100.00"

    def test_yearly_summary(self, auth_client, seeded_space):
        space_id, cat = seeded_space
        response = auth_client.get(
            f"/api/budgets/reports/yearly-summary/?space_id={space_id}&year=2026"
        )
        assert response.status_code == 200
        totals = {r["category_id"]: r["total"] for r in response.data}
        assert totals[cat["id"]] == "350.00"

    def test_report_requires_space_id(self, auth_client):
        response = auth_client.get("/api/budgets/reports/monthly-summary/?month=2026-03")
        assert response.status_code == 400

    def test_report_wrong_space_forbidden(self, auth_client, api_client):
        api_client.post("/api/auth/register/", {
            "email": "other3@example.com", "password": "testpass123", "display_name": "Other",
        })
        login = api_client.post("/api/auth/token/", {
            "email": "other3@example.com", "password": "testpass123",
        })
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        other_space = api_client.post("/api/spaces/", {"name": "Other"})
        response = auth_client.get(
            f"/api/budgets/reports/monthly-summary/?space_id={other_space.data['id']}&month=2026-03"
        )
        assert response.status_code == 403

    def test_monthly_bad_format_returns_400(self, auth_client, seeded_space):
        space_id, _ = seeded_space
        response = auth_client.get(
            f"/api/budgets/reports/monthly-summary/?space_id={space_id}&month=not-a-date"
        )
        assert response.status_code == 400

    def test_weekly_bad_format_returns_400(self, auth_client, seeded_space):
        space_id, _ = seeded_space
        response = auth_client.get(
            f"/api/budgets/reports/weekly-summary/?space_id={space_id}&week=not-a-date"
        )
        assert response.status_code == 400

    def test_yearly_bad_format_returns_400(self, auth_client, seeded_space):
        space_id, _ = seeded_space
        response = auth_client.get(
            f"/api/budgets/reports/yearly-summary/?space_id={space_id}&year=not-a-number"
        )
        assert response.status_code == 400

    def test_unknown_report_type_returns_404(self, auth_client, seeded_space):
        space_id, _ = seeded_space
        response = auth_client.get(
            f"/api/budgets/reports/nonexistent/?space_id={space_id}&month=2026-03"
        )
        assert response.status_code == 404
