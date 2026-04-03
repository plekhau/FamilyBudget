import pytest
from rest_framework.test import APIClient


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def auth_client(api_client, db):
    from apps.accounts.models import User
    user = User.objects.create_user(
        email="test@example.com",
        password="testpass123",
        display_name="Test User",
    )
    response = api_client.post("/api/auth/token/", {
        "email": "test@example.com",
        "password": "testpass123",
    })
    token = response.data["access"]
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
    api_client._user = user
    return api_client
