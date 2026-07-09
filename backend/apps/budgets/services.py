from datetime import date

from dateutil.relativedelta import relativedelta

from .models import RecurringTransaction, Transaction

FREQUENCY_DELTAS = {
    RecurringTransaction.Frequency.WEEKLY: relativedelta(weeks=1),
    RecurringTransaction.Frequency.MONTHLY: relativedelta(months=1),
    RecurringTransaction.Frequency.YEARLY: relativedelta(years=1),
}


def generate_due_transactions(recurring, paid_by=None):
    """Create a Transaction for every due occurrence (next_due_date <= today),
    advancing next_due_date one period at a time until it is in the future.

    Returns the number of transactions created.
    """
    if not recurring.is_active:
        return 0
    if recurring.frequency not in FREQUENCY_DELTAS:
        raise ValueError(f"Unknown frequency: {recurring.frequency}")
    delta = FREQUENCY_DELTAS[recurring.frequency]
    user = paid_by or recurring.space.created_by
    today = date.today()
    created = 0
    while recurring.next_due_date <= today:
        Transaction.objects.create(
            space=recurring.space,
            category=recurring.category,
            amount=recurring.amount,
            date=recurring.next_due_date,
            paid_by=user,
            notes=recurring.description,
            created_by=user,
        )
        recurring.next_due_date += delta
        created += 1
    if created:
        recurring.save(update_fields=["next_due_date"])
    return created
