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

    def validate(self, attrs):
        if attrs.get("category") and "space" in self.context:
            if attrs["category"].space != self.context["space"]:
                raise serializers.ValidationError(
                    "Category does not belong to this space."
                )
        return attrs


class RecurringTransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurringTransaction
        fields = (
            "id", "space", "category", "amount", "description",
            "frequency", "start_date", "next_due_date", "is_active",
        )
        read_only_fields = ("id", "space")
