from django.urls import path
from .views import (
    CategoryListCreateView,
    CategoryDetailView,
    TransactionListCreateView,
    TransactionDetailView,
    RecurringTransactionListCreateView,
    RecurringTransactionDetailView,
    ReportView,
)

urlpatterns = [
    path("categories/", CategoryListCreateView.as_view(), name="category-list"),
    path("categories/<int:pk>/", CategoryDetailView.as_view(), name="category-detail"),
    path("transactions/", TransactionListCreateView.as_view(), name="transaction-list"),
    path("transactions/<int:pk>/", TransactionDetailView.as_view(), name="transaction-detail"),
    path("recurring-transactions/", RecurringTransactionListCreateView.as_view(), name="recurring-list"),
    path("recurring-transactions/<int:pk>/", RecurringTransactionDetailView.as_view(), name="recurring-detail"),
    path("reports/<str:report_type>/", ReportView.as_view(), name="reports"),
]
