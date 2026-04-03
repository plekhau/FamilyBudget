from rest_framework import generics, status
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Category, Transaction, RecurringTransaction
from .serializers import CategorySerializer, TransactionSerializer, RecurringTransactionSerializer
from apps.spaces.models import Space, SpaceMembership


def get_space_for_user(space_id, user):
    """Return Space if user is a member, raise PermissionDenied otherwise."""
    try:
        space = Space.objects.get(pk=space_id)
    except Space.DoesNotExist:
        raise PermissionDenied("Space not found.")
    if not SpaceMembership.objects.filter(space=space, user=user).exists():
        raise PermissionDenied("You are not a member of this space.")
    return space


class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer

    def get_queryset(self):
        space_id = self.request.query_params.get("space_id")
        if not space_id:
            raise ValidationError({"space_id": "This parameter is required."})
        space = get_space_for_user(space_id, self.request.user)
        return Category.objects.filter(space=space)

    def perform_create(self, serializer):
        space_id = self.request.data.get("space_id")
        if not space_id:
            raise ValidationError({"space_id": "This field is required."})
        space = get_space_for_user(space_id, self.request.user)
        serializer.save(space=space)


class CategoryDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategorySerializer

    def get_queryset(self):
        return Category.objects.filter(
            space__memberships__user=self.request.user
        )


class TransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = TransactionSerializer

    def get_serializer_context(self):
        context = super().get_serializer_context()
        space_id = self.request.data.get("space_id") or self.request.query_params.get("space_id")
        if space_id:
            try:
                space = get_space_for_user(space_id, self.request.user)
                context["space"] = space
            except Exception:
                pass  # validation errors handled in get_queryset/perform_create
        return context

    def get_queryset(self):
        space_id = self.request.query_params.get("space_id")
        if not space_id:
            raise ValidationError({"space_id": "This parameter is required."})
        space = get_space_for_user(space_id, self.request.user)
        qs = Transaction.objects.filter(space=space).select_related(
            "category", "paid_by", "created_by"
        )

        month = self.request.query_params.get("month")
        if month:
            try:
                year, mon = month.split("-")
                qs = qs.filter(date__year=int(year), date__month=int(mon))
            except (ValueError, AttributeError):
                raise ValidationError({"month": "Use YYYY-MM format."})

        category_id = self.request.query_params.get("category_id")
        if category_id:
            qs = qs.filter(category_id=category_id)

        return qs

    def perform_create(self, serializer):
        space_id = self.request.data.get("space_id")
        if not space_id:
            raise ValidationError({"space_id": "This field is required."})
        space = get_space_for_user(space_id, self.request.user)
        serializer.save(space=space, created_by=self.request.user)


class TransactionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TransactionSerializer

    def get_queryset(self):
        return Transaction.objects.filter(
            space__memberships__user=self.request.user
        ).select_related("category", "paid_by", "created_by")


class RecurringTransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = RecurringTransactionSerializer

    def get_queryset(self):
        space_id = self.request.query_params.get("space_id")
        if not space_id:
            raise ValidationError({"space_id": "This parameter is required."})
        space = get_space_for_user(space_id, self.request.user)
        return RecurringTransaction.objects.filter(space=space)

    def perform_create(self, serializer):
        space_id = self.request.data.get("space_id")
        if not space_id:
            raise ValidationError({"space_id": "This field is required."})
        space = get_space_for_user(space_id, self.request.user)
        serializer.save(space=space)


class RecurringTransactionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = RecurringTransactionSerializer

    def get_queryset(self):
        return RecurringTransaction.objects.filter(
            space__memberships__user=self.request.user
        )
