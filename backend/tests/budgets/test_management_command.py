import pytest
from datetime import date, timedelta
from django.core.management import call_command
from dateutil.relativedelta import relativedelta
from apps.spaces.models import Space
from apps.budgets.models import Category, Transaction, RecurringTransaction


@pytest.fixture
def space_with_recurring(auth_client):
    space = auth_client.post("/api/spaces/", {"name": "Recurring Space"})
    assert space.status_code == 201
    space_id = space.data["id"]
    categories = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
    category_id = categories.data[0]["id"]
    space_obj = Space.objects.get(pk=space_id)
    cat_obj = Category.objects.get(pk=category_id)
    rt = RecurringTransaction.objects.create(
        space=space_obj,
        category=cat_obj,
        amount="500.00",
        description="Test Recurring",
        frequency=RecurringTransaction.Frequency.MONTHLY,
        start_date=date(2026, 1, 1),
        next_due_date=date.today(),
        is_active=True,
    )
    return rt, auth_client._user


@pytest.mark.django_db
def test_command_generates_transaction(space_with_recurring):
    """The management command creates a Transaction for each active recurring entry whose due date is today or past."""
    rt, user = space_with_recurring
    assert Transaction.objects.count() == 0
    call_command("generate_recurring_transactions")
    assert Transaction.objects.count() == 1
    rt.refresh_from_db()
    tx = Transaction.objects.first()
    assert tx.amount == rt.amount
    assert tx.category == rt.category
    assert tx.space == rt.space


@pytest.mark.django_db
def test_command_advances_next_due_date(space_with_recurring):
    """After generating a transaction, next_due_date advances by one period (one month for monthly frequency)."""
    rt, user = space_with_recurring
    original_due = rt.next_due_date
    call_command("generate_recurring_transactions")
    rt.refresh_from_db()
    assert rt.next_due_date == original_due + relativedelta(months=1)


@pytest.mark.django_db
def test_command_skips_future_due_dates(space_with_recurring):
    """The management command does not generate transactions for recurring entries whose due date is in the future."""
    rt, user = space_with_recurring
    rt.next_due_date = date.today() + timedelta(days=5)
    rt.save()
    call_command("generate_recurring_transactions")
    assert Transaction.objects.count() == 0


@pytest.mark.django_db
def test_command_skips_inactive(space_with_recurring):
    """The management command does not generate transactions for inactive recurring entries."""
    rt, user = space_with_recurring
    rt.is_active = False
    rt.save()
    call_command("generate_recurring_transactions")
    assert Transaction.objects.count() == 0
