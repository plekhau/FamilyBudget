import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(db):
    from apps.accounts.models import User
    client = APIClient()
    user = User.objects.create_user(
        email="test@example.com",
        password="testpass123",
        display_name="Test User",
    )
    client.force_authenticate(user=user)
    client._user = user
    return client
