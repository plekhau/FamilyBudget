from datetime import date

from django.core.management.base import BaseCommand

from apps.budgets.models import RecurringTransaction
from apps.budgets.services import generate_due_transactions


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
            created += generate_due_transactions(rt)

        self.stdout.write(self.style.SUCCESS(f"Generated {created} transaction(s)."))
