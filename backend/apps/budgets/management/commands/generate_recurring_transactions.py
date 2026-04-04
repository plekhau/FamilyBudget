from datetime import date
from dateutil.relativedelta import relativedelta
from django.core.management.base import BaseCommand
from apps.budgets.models import RecurringTransaction, Transaction


class Command(BaseCommand):
    help = "Generate Transaction rows for due RecurringTransactions"

    def handle(self, *args, **options):
        today = date.today()
        due = RecurringTransaction.objects.filter(
            is_active=True,
            next_due_date__lte=today,
        ).select_related("space", "category", "space__created_by")

        created = 0
        for rt in due:
            Transaction.objects.create(
                space=rt.space,
                category=rt.category,
                amount=rt.amount,
                date=rt.next_due_date,
                paid_by=rt.space.created_by,
                notes=rt.description,
                created_by=rt.space.created_by,
            )
            rt.next_due_date = self._advance(rt.next_due_date, rt.frequency)
            rt.save(update_fields=["next_due_date"])
            created += 1

        self.stdout.write(self.style.SUCCESS(f"Generated {created} transaction(s)."))

    def _advance(self, current_date, frequency):
        if frequency == RecurringTransaction.Frequency.WEEKLY:
            return current_date + relativedelta(weeks=1)
        if frequency == RecurringTransaction.Frequency.MONTHLY:
            return current_date + relativedelta(months=1)
        if frequency == RecurringTransaction.Frequency.YEARLY:
            return current_date + relativedelta(years=1)
        raise ValueError(f"Unknown frequency: {frequency}")
