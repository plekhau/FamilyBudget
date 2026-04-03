from django.db import models
from django.conf import settings


class Category(models.Model):
    space = models.ForeignKey(
        "spaces.Space", on_delete=models.CASCADE, related_name="categories"
    )
    name = models.CharField(max_length=100)
    icon = models.CharField(max_length=10, blank=True, default="")
    is_income = models.BooleanField(default=False)

    class Meta:
        unique_together = ("space", "name")

    def __str__(self):
        return f"{self.icon} {self.name}"


class Transaction(models.Model):
    space = models.ForeignKey(
        "spaces.Space", on_delete=models.CASCADE, related_name="transactions"
    )
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="transactions"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    date = models.DateField()
    paid_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="transactions"
    )
    notes = models.TextField(blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_transactions",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-created_at"]
        indexes = [
            models.Index(fields=["space", "date"]),
        ]

    def __str__(self):
        return f"{self.date} {self.category} {self.amount}"


class RecurringTransaction(models.Model):
    class Frequency(models.TextChoices):
        WEEKLY = "weekly", "Weekly"
        MONTHLY = "monthly", "Monthly"
        YEARLY = "yearly", "Yearly"

    space = models.ForeignKey(
        "spaces.Space", on_delete=models.CASCADE, related_name="recurring_transactions"
    )
    category = models.ForeignKey(
        Category, on_delete=models.PROTECT, related_name="recurring_transactions"
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    description = models.CharField(max_length=255)
    frequency = models.CharField(max_length=10, choices=Frequency.choices)
    start_date = models.DateField()
    next_due_date = models.DateField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.description} ({self.frequency})"
