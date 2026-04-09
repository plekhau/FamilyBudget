# tests/budgets/test_signals.py
import pytest
from apps.budgets.models import Category
from apps.budgets.default_categories import DEFAULT_CATEGORIES


@pytest.mark.django_db
def test_default_categories_created_on_space_creation(auth_client):
    """Creating a space automatically creates the full set of default categories via post_save signal."""
    response = auth_client.post("/api/spaces/", {"name": "Signal Test Space"})
    space_id = response.data["id"]
    categories = Category.objects.filter(space_id=space_id)
    assert categories.count() == len(DEFAULT_CATEGORIES)
    names = list(categories.values_list("name", flat=True))
    for cat in DEFAULT_CATEGORIES:
        assert cat["name"] in names


@pytest.mark.django_db
def test_default_categories_have_correct_is_income(auth_client):
    """Default categories are created with the correct is_income flag matching the DEFAULT_CATEGORIES definition."""
    response = auth_client.post("/api/spaces/", {"name": "Income Test Space"})
    space_id = response.data["id"]
    income_cats = Category.objects.filter(space_id=space_id, is_income=True)
    expense_cats = Category.objects.filter(space_id=space_id, is_income=False)
    expected_income = [c for c in DEFAULT_CATEGORIES if c["is_income"]]
    expected_expense = [c for c in DEFAULT_CATEGORIES if not c["is_income"]]
    assert income_cats.count() == len(expected_income)
    assert expense_cats.count() == len(expected_expense)
