from rest_framework import serializers
from .models import Category, Transaction, RecurringTransaction


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ("id", "name", "icon", "is_income")
        read_only_fields = ("id",)


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transaction
        fields = (
            "id", "space", "category", "amount", "date",
            "paid_by", "notes", "created_by", "created_at",
        )
        read_only_fields = ("id", "space", "created_by", "created_at")

    def validate_category(self, category):
        # For create: space is passed via context from perform_create
        # For update: get the space from the existing instance
        space = self.context.get("space")
        if space is None and self.instance is not None:
            space = self.instance.space
        if space is not None and category.space != space:
            raise serializers.ValidationError(
                "Category does not belong to this space."
            )
        return category


class RecurringTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurringTransaction
        fields = (
            "id", "space", "category", "amount", "description",
            "frequency", "start_date", "next_due_date", "is_active",
        )
        read_only_fields = ("id", "space")
