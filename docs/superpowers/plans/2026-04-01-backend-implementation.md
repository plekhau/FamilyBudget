# Family Budget Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Django REST API for the Family Budget app covering auth, spaces, categories, transactions, recurring transactions, and reports.

**Architecture:** Three Django apps (`accounts`, `spaces`, `budgets`) each owning a bounded domain. DRF serializers + views for all endpoints. JWT auth via simplejwt. PostgreSQL backend. `uv` for package management.

**Tech Stack:** Python 3.12, Django 5.x, DRF, djangorestframework-simplejwt, PostgreSQL, psycopg2, django-cors-headers, django-environ, pytest-django

---

## File Map

```
backend/
  manage.py
  pyproject.toml
  .python-version
  .env.example
  config/
    __init__.py
    settings/
      __init__.py
      base.py
      local.py
      production.py
    urls.py
    wsgi.py
  apps/
    accounts/
      __init__.py
      models.py          ← custom User
      serializers.py     ← register serializer
      views.py           ← register view
      urls.py
      admin.py
    spaces/
      __init__.py
      models.py          ← Space, SpaceMembership, SpaceInvite
      serializers.py
      views.py
      urls.py
      permissions.py     ← IsSpaceOwner, IsSpaceAdmin, IsSpaceMember
      admin.py
    budgets/
      __init__.py
      models.py          ← Category, Transaction, RecurringTransaction
      serializers.py
      views.py
      urls.py
      signals.py         ← post_save on Space → create default categories
      default_categories.py  ← DEFAULT_CATEGORIES constant
      reports.py         ← report query logic
      admin.py
      management/
        commands/
          generate_recurring_transactions.py
  tests/
    conftest.py          ← pytest fixtures: db, api client, users, spaces
    accounts/
      test_auth.py
    spaces/
      test_spaces.py
      test_invites.py
    budgets/
      test_categories.py
      test_transactions.py
      test_recurring.py
      test_reports.py
      test_signals.py
      test_management_command.py
```

---

## Task 1: Project scaffold

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/.python-version`
- Create: `backend/.env.example`
- Create: `backend/config/__init__.py`
- Create: `backend/config/settings/__init__.py`
- Create: `backend/config/settings/base.py`
- Create: `backend/config/settings/local.py`
- Create: `backend/config/settings/production.py`
- Create: `backend/config/urls.py`
- Create: `backend/config/wsgi.py`
- Create: `backend/manage.py`

- [ ] **Step 1: Initialise project with uv**

```bash
mkdir -p backend && cd backend
uv init --no-readme
echo "3.12" > .python-version
```

- [ ] **Step 2: Add dependencies to pyproject.toml**

Replace the contents of `backend/pyproject.toml` with:

```toml
[project]
name = "family-budget-backend"
version = "0.1.0"
requires-python = ">=3.12"
dependencies = [
    "django>=5.0,<6.0",
    "djangorestframework>=3.15",
    "djangorestframework-simplejwt>=5.3",
    "django-cors-headers>=4.3",
    "django-environ>=0.11",
    "psycopg2-binary>=2.9",
]

[dependency-groups]
dev = [
    "pytest>=8.0",
    "pytest-django>=4.8",
    "factory-boy>=3.3",
]

[tool.pytest.ini_options]
DJANGO_SETTINGS_MODULE = "config.settings.local"
python_files = ["test_*.py"]
python_classes = ["Test*"]
python_functions = ["test_*"]
```

- [ ] **Step 3: Install dependencies**

```bash
cd backend
uv sync
```

Expected: lockfile created, `.venv` populated.

- [ ] **Step 4: Create Django project structure**

```bash
cd backend
mkdir -p config/settings apps tests/accounts tests/spaces tests/budgets
touch config/__init__.py config/settings/__init__.py config/wsgi.py
touch apps/__init__.py
touch tests/__init__.py tests/accounts/__init__.py tests/spaces/__init__.py tests/budgets/__init__.py
```

- [ ] **Step 5: Create `config/settings/base.py`**

```python
import environ

env = environ.Env()

BASE_DIR = environ.Path(__file__) - 3  # backend/

SECRET_KEY = env("SECRET_KEY")
DEBUG = env.bool("DEBUG", default=False)
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=[])

DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "rest_framework_simplejwt",
    "rest_framework_simplejwt.token_blacklist",
    "corsheaders",
]

LOCAL_APPS = [
    "apps.accounts",
    "apps.spaces",
    "apps.budgets",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": env.db("DATABASE_URL")
}

AUTH_USER_MODEL = "accounts.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
}

from datetime import timedelta
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
}

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
STATIC_URL = "static/"
```

- [ ] **Step 6: Create `config/settings/local.py`**

```python
import environ
from .base import *

env = environ.Env()
environ.Env.read_env()  # reads .env file

DEBUG = True
SECRET_KEY = env("SECRET_KEY", default="local-dev-secret-key-not-for-production")
ALLOWED_HOSTS = ["localhost", "127.0.0.1"]
CORS_ALLOW_ALL_ORIGINS = True
```

- [ ] **Step 7: Create `config/settings/production.py`**

```python
from .base import *

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=[])
```

- [ ] **Step 8: Create `config/urls.py`**

```python
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.accounts.urls")),
    path("api/spaces/", include("apps.spaces.urls")),
    path("api/budgets/", include("apps.budgets.urls")),
]
```

- [ ] **Step 9: Create `config/wsgi.py`**

```python
import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
application = get_wsgi_application()
```

- [ ] **Step 10: Create `manage.py`**

```python
#!/usr/bin/env python
import os
import sys

if __name__ == "__main__":
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError("Couldn't import Django.") from exc
    execute_from_command_line(sys.argv)
```

- [ ] **Step 11: Create `.env.example`**

```
SECRET_KEY=your-secret-key-here
DATABASE_URL=postgres://user:password@localhost:5432/familybudget
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
```

- [ ] **Step 12: Create `.env` for local dev (not committed)**

```bash
cp .env.example .env
# Edit .env with your local postgres credentials
```

- [ ] **Step 13: Create `tests/conftest.py`**

```python
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
```

- [ ] **Step 14: Commit**

```bash
git add backend/
git commit -m "feat: scaffold Django project with uv, settings, and test fixtures"
```

---

## Task 2: `accounts` app — User model and auth endpoints

**Files:**
- Create: `backend/apps/accounts/__init__.py`
- Create: `backend/apps/accounts/models.py`
- Create: `backend/apps/accounts/serializers.py`
- Create: `backend/apps/accounts/views.py`
- Create: `backend/apps/accounts/urls.py`
- Create: `backend/apps/accounts/admin.py`
- Create: `backend/tests/accounts/test_auth.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/accounts/test_auth.py
import pytest


@pytest.mark.django_db
class TestRegistration:
    def test_register_success(self, api_client):
        response = api_client.post("/api/auth/register/", {
            "email": "alice@example.com",
            "password": "strongpass123",
            "display_name": "Alice",
        })
        assert response.status_code == 201
        assert response.data["email"] == "alice@example.com"
        assert "password" not in response.data

    def test_register_duplicate_email(self, api_client):
        api_client.post("/api/auth/register/", {
            "email": "alice@example.com",
            "password": "strongpass123",
            "display_name": "Alice",
        })
        response = api_client.post("/api/auth/register/", {
            "email": "alice@example.com",
            "password": "anotherpass",
            "display_name": "Alice2",
        })
        assert response.status_code == 400

    def test_register_missing_email(self, api_client):
        response = api_client.post("/api/auth/register/", {
            "password": "strongpass123",
            "display_name": "Alice",
        })
        assert response.status_code == 400


@pytest.mark.django_db
class TestTokenAuth:
    def test_login_returns_tokens(self, api_client):
        api_client.post("/api/auth/register/", {
            "email": "bob@example.com",
            "password": "strongpass123",
            "display_name": "Bob",
        })
        response = api_client.post("/api/auth/token/", {
            "email": "bob@example.com",
            "password": "strongpass123",
        })
        assert response.status_code == 200
        assert "access" in response.data
        assert "refresh" in response.data

    def test_login_wrong_password(self, api_client):
        api_client.post("/api/auth/register/", {
            "email": "bob@example.com",
            "password": "strongpass123",
            "display_name": "Bob",
        })
        response = api_client.post("/api/auth/token/", {
            "email": "bob@example.com",
            "password": "wrongpass",
        })
        assert response.status_code == 401

    def test_logout_blacklists_refresh(self, api_client):
        api_client.post("/api/auth/register/", {
            "email": "bob@example.com",
            "password": "strongpass123",
            "display_name": "Bob",
        })
        login = api_client.post("/api/auth/token/", {
            "email": "bob@example.com",
            "password": "strongpass123",
        })
        refresh = login.data["refresh"]
        response = api_client.post("/api/auth/token/blacklist/", {"refresh": refresh})
        assert response.status_code == 200

        # Blacklisted token can no longer be refreshed
        retry = api_client.post("/api/auth/token/refresh/", {"refresh": refresh})
        assert retry.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
uv run pytest tests/accounts/test_auth.py -v
```

Expected: errors about missing modules/URLs.

- [ ] **Step 3: Create `apps/accounts/models.py`**

```python
from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email is required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = None
    email = models.EmailField(unique=True)
    display_name = models.CharField(max_length=150)
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS = ["display_name"]

    objects = UserManager()

    def __str__(self):
        return self.email
```

- [ ] **Step 4: Create `apps/accounts/serializers.py`**

```python
from rest_framework import serializers
from .models import User


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ("id", "email", "display_name", "password", "created_at")
        read_only_fields = ("id", "created_at")

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)
```

- [ ] **Step 5: Create `apps/accounts/views.py`**

```python
from rest_framework import generics, permissions
from .serializers import RegisterSerializer


class RegisterView(generics.CreateAPIView):
    serializer_class = RegisterSerializer
    permission_classes = (permissions.AllowAny,)
```

- [ ] **Step 6: Create `apps/accounts/urls.py`**

```python
from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenBlacklistView,
)
from .views import RegisterView

urlpatterns = [
    path("register/", RegisterView.as_view(), name="auth-register"),
    path("token/", TokenObtainPairView.as_view(), name="token-obtain"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token-refresh"),
    path("token/blacklist/", TokenBlacklistView.as_view(), name="token-blacklist"),
]
```

- [ ] **Step 7: Create `apps/accounts/admin.py`**

```python
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    ordering = ("email",)
    list_display = ("email", "display_name", "is_staff")
    fieldsets = (
        (None, {"fields": ("email", "password")}),
        ("Personal", {"fields": ("display_name",)}),
        ("Permissions", {"fields": ("is_active", "is_staff", "is_superuser")}),
    )
    add_fieldsets = (
        (None, {"fields": ("email", "display_name", "password1", "password2")}),
    )
    search_fields = ("email", "display_name")
```

- [ ] **Step 8: Create `apps/accounts/__init__.py`**

```python
```

- [ ] **Step 9: Run migrations and tests**

```bash
cd backend
uv run python manage.py makemigrations accounts
uv run python manage.py migrate
uv run pytest tests/accounts/test_auth.py -v
```

Expected: all tests pass.

- [ ] **Step 10: Commit**

```bash
git add apps/accounts/ tests/accounts/
git commit -m "feat: accounts app with custom User model and JWT auth endpoints"
```

---

## Task 3: `spaces` app — models, permissions, and CRUD

**Files:**
- Create: `backend/apps/spaces/__init__.py`
- Create: `backend/apps/spaces/models.py`
- Create: `backend/apps/spaces/permissions.py`
- Create: `backend/apps/spaces/serializers.py`
- Create: `backend/apps/spaces/views.py`
- Create: `backend/apps/spaces/urls.py`
- Create: `backend/apps/spaces/admin.py`
- Create: `backend/tests/spaces/test_spaces.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/spaces/test_spaces.py
import pytest


@pytest.mark.django_db
class TestSpaceCRUD:
    def test_create_space(self, auth_client):
        response = auth_client.post("/api/spaces/", {"name": "Our Home"})
        assert response.status_code == 201
        assert response.data["name"] == "Our Home"

    def test_create_space_makes_user_owner(self, auth_client):
        response = auth_client.post("/api/spaces/", {"name": "Our Home"})
        space_id = response.data["id"]
        detail = auth_client.get(f"/api/spaces/{space_id}/")
        members = detail.data["members"]
        assert any(
            m["user"]["email"] == "test@example.com" and m["role"] == "owner"
            for m in members
        )

    def test_list_spaces_returns_only_member_spaces(self, auth_client, api_client):
        # Create a second user with their own space
        api_client.post("/api/auth/register/", {
            "email": "other@example.com",
            "password": "testpass123",
            "display_name": "Other",
        })
        other_login = api_client.post("/api/auth/token/", {
            "email": "other@example.com",
            "password": "testpass123",
        })
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {other_login.data['access']}")
        api_client.post("/api/spaces/", {"name": "Other Space"})

        # Our user creates their own space
        auth_client.post("/api/spaces/", {"name": "My Space"})

        response = auth_client.get("/api/spaces/")
        assert response.status_code == 200
        names = [s["name"] for s in response.data]
        assert "My Space" in names
        assert "Other Space" not in names

    def test_delete_space_owner_only(self, auth_client, api_client):
        # Create space as owner
        space = auth_client.post("/api/spaces/", {"name": "To Delete"})
        space_id = space.data["id"]

        # Register a member
        api_client.post("/api/auth/register/", {
            "email": "member@example.com",
            "password": "testpass123",
            "display_name": "Member",
        })

        # Delete as owner succeeds
        response = auth_client.delete(f"/api/spaces/{space_id}/")
        assert response.status_code == 204

    def test_unauthenticated_cannot_list_spaces(self, api_client):
        response = api_client.get("/api/spaces/")
        assert response.status_code == 401
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
uv run pytest tests/spaces/test_spaces.py -v
```

Expected: errors about missing URLs.

- [ ] **Step 3: Create `apps/spaces/models.py`**

```python
import uuid
from django.db import models
from django.conf import settings


class Space(models.Model):
    name = models.CharField(max_length=255)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_spaces",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class SpaceMembership(models.Model):
    class Role(models.TextChoices):
        OWNER = "owner", "Owner"
        ADMIN = "admin", "Admin"
        MEMBER = "member", "Member"

    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name="memberships")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="space_memberships",
    )
    role = models.CharField(max_length=10, choices=Role.choices, default=Role.MEMBER)
    joined_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ("space", "user")

    def __str__(self):
        return f"{self.user} — {self.space} ({self.role})"


class SpaceInvite(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        EXPIRED = "expired", "Expired"
        REVOKED = "revoked", "Revoked"

    space = models.ForeignKey(Space, on_delete=models.CASCADE, related_name="invites")
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_invites",
    )
    email = models.EmailField(null=True, blank=True)
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    expires_at = models.DateTimeField()

    def __str__(self):
        return f"Invite to {self.space} ({self.status})"
```

- [ ] **Step 4: Create `apps/spaces/permissions.py`**

```python
from rest_framework.permissions import BasePermission
from .models import SpaceMembership


def get_membership(user, space):
    try:
        return SpaceMembership.objects.get(user=user, space=space)
    except SpaceMembership.DoesNotExist:
        return None


class IsSpaceMember(BasePermission):
    """Request must include a space the user belongs to."""
    def has_object_permission(self, request, view, obj):
        space = obj if hasattr(obj, "memberships") else obj.space
        return SpaceMembership.objects.filter(user=request.user, space=space).exists()


class IsSpaceOwnerOrAdmin(BasePermission):
    def has_object_permission(self, request, view, obj):
        space = obj if hasattr(obj, "memberships") else obj.space
        membership = get_membership(request.user, space)
        return membership and membership.role in (
            SpaceMembership.Role.OWNER,
            SpaceMembership.Role.ADMIN,
        )


class IsSpaceOwner(BasePermission):
    def has_object_permission(self, request, view, obj):
        space = obj if hasattr(obj, "memberships") else obj.space
        membership = get_membership(request.user, space)
        return membership and membership.role == SpaceMembership.Role.OWNER
```

- [ ] **Step 5: Create `apps/spaces/serializers.py`**

```python
from django.utils import timezone
from datetime import timedelta
from rest_framework import serializers
from .models import Space, SpaceMembership, SpaceInvite
from apps.accounts.models import User


class UserBriefSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "display_name")


class SpaceMembershipSerializer(serializers.ModelSerializer):
    user = UserBriefSerializer(read_only=True)

    class Meta:
        model = SpaceMembership
        fields = ("id", "user", "role", "joined_at")


class SpaceSerializer(serializers.ModelSerializer):
    members = SpaceMembershipSerializer(source="memberships", many=True, read_only=True)

    class Meta:
        model = Space
        fields = ("id", "name", "created_at", "members")
        read_only_fields = ("id", "created_at", "members")


class SpaceInviteSerializer(serializers.ModelSerializer):
    token = serializers.UUIDField(read_only=True)

    class Meta:
        model = SpaceInvite
        fields = ("id", "space", "email", "token", "status", "expires_at")
        read_only_fields = ("id", "token", "status")

    def validate(self, attrs):
        attrs.setdefault(
            "expires_at",
            timezone.now() + timedelta(days=7),
        )
        return attrs


class AcceptInviteSerializer(serializers.Serializer):
    token = serializers.UUIDField()
```

- [ ] **Step 6: Create `apps/spaces/views.py`**

```python
from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Space, SpaceMembership, SpaceInvite
from .serializers import SpaceSerializer, SpaceInviteSerializer, AcceptInviteSerializer
from .permissions import IsSpaceOwner, IsSpaceOwnerOrAdmin


class SpaceListCreateView(generics.ListCreateAPIView):
    serializer_class = SpaceSerializer

    def get_queryset(self):
        return Space.objects.filter(memberships__user=self.request.user)

    def perform_create(self, serializer):
        space = serializer.save(created_by=self.request.user)
        SpaceMembership.objects.create(
            space=space,
            user=self.request.user,
            role=SpaceMembership.Role.OWNER,
        )


class SpaceDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = SpaceSerializer

    def get_queryset(self):
        return Space.objects.filter(memberships__user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        space = self.get_object()
        self.check_object_permissions(request, space)
        space.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [permissions.IsAuthenticated(), IsSpaceOwner()]
        return [permissions.IsAuthenticated()]


class SpaceInviteCreateView(generics.CreateAPIView):
    serializer_class = SpaceInviteSerializer

    def perform_create(self, serializer):
        space = Space.objects.get(
            pk=self.kwargs["space_id"],
            memberships__user=self.request.user,
        )
        serializer.save(space=space, invited_by=self.request.user)


class AcceptInviteView(APIView):
    def post(self, request):
        serializer = AcceptInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]

        try:
            invite = SpaceInvite.objects.get(token=token, status=SpaceInvite.Status.PENDING)
        except SpaceInvite.DoesNotExist:
            return Response({"detail": "Invalid or expired invite."}, status=status.HTTP_400_BAD_REQUEST)

        if invite.expires_at < timezone.now():
            invite.status = SpaceInvite.Status.EXPIRED
            invite.save()
            return Response({"detail": "Invite has expired."}, status=status.HTTP_400_BAD_REQUEST)

        if invite.email and invite.email != request.user.email:
            return Response({"detail": "This invite is for a different email address."}, status=status.HTTP_403_FORBIDDEN)

        SpaceMembership.objects.get_or_create(
            space=invite.space,
            user=request.user,
            defaults={"role": SpaceMembership.Role.MEMBER},
        )
        invite.status = SpaceInvite.Status.ACCEPTED
        invite.save()
        return Response({"detail": "Joined space successfully."}, status=status.HTTP_200_OK)


class RevokeInviteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, space_id, invite_id):
        try:
            invite = SpaceInvite.objects.get(
                pk=invite_id,
                space_id=space_id,
                space__memberships__user=request.user,
            )
        except SpaceInvite.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        membership = SpaceMembership.objects.get(user=request.user, space_id=space_id)
        if membership.role not in (SpaceMembership.Role.OWNER, SpaceMembership.Role.ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)

        invite.status = SpaceInvite.Status.REVOKED
        invite.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
```

- [ ] **Step 7: Create `apps/spaces/urls.py`**

```python
from django.urls import path
from .views import (
    SpaceListCreateView,
    SpaceDetailView,
    SpaceInviteCreateView,
    AcceptInviteView,
    RevokeInviteView,
)

urlpatterns = [
    path("", SpaceListCreateView.as_view(), name="space-list"),
    path("<int:pk>/", SpaceDetailView.as_view(), name="space-detail"),
    path("<int:space_id>/invites/", SpaceInviteCreateView.as_view(), name="space-invite-create"),
    path("invites/accept/", AcceptInviteView.as_view(), name="space-invite-accept"),
    path("<int:space_id>/invites/<int:invite_id>/", RevokeInviteView.as_view(), name="space-invite-revoke"),
]
```

- [ ] **Step 8: Create `apps/spaces/admin.py`**

```python
from django.contrib import admin
from .models import Space, SpaceMembership, SpaceInvite


@admin.register(Space)
class SpaceAdmin(admin.ModelAdmin):
    list_display = ("name", "created_by", "created_at")


@admin.register(SpaceMembership)
class SpaceMembershipAdmin(admin.ModelAdmin):
    list_display = ("space", "user", "role", "joined_at")


@admin.register(SpaceInvite)
class SpaceInviteAdmin(admin.ModelAdmin):
    list_display = ("space", "email", "status", "expires_at")
```

- [ ] **Step 9: Create `apps/spaces/__init__.py`**

```python
```

- [ ] **Step 10: Run migrations and tests**

```bash
uv run python manage.py makemigrations spaces
uv run python manage.py migrate
uv run pytest tests/spaces/test_spaces.py -v
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add apps/spaces/ tests/spaces/test_spaces.py
git commit -m "feat: spaces app with Space, SpaceMembership, SpaceInvite models and endpoints"
```

---

## Task 4: Space invites tests

**Files:**
- Create: `backend/tests/spaces/test_invites.py`

- [ ] **Step 1: Write invite tests**

```python
# tests/spaces/test_invites.py
import pytest
from django.utils import timezone
from datetime import timedelta
from apps.spaces.models import SpaceInvite, SpaceMembership


@pytest.fixture
def space_and_owner(auth_client):
    response = auth_client.post("/api/spaces/", {"name": "Test Space"})
    return response.data["id"], auth_client


@pytest.mark.django_db
class TestEmailInvite:
    def test_create_email_invite(self, space_and_owner):
        space_id, owner = space_and_owner
        response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "email": "friend@example.com",
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        assert response.status_code == 201
        assert response.data["email"] == "friend@example.com"
        assert "token" in response.data

    def test_accept_email_invite(self, space_and_owner, api_client):
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "email": "friend@example.com",
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        token = invite_response.data["token"]

        # Register friend and login
        api_client.post("/api/auth/register/", {
            "email": "friend@example.com",
            "password": "testpass123",
            "display_name": "Friend",
        })
        login = api_client.post("/api/auth/token/", {
            "email": "friend@example.com",
            "password": "testpass123",
        })
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")

        response = api_client.post("/api/spaces/invites/accept/", {"token": token})
        assert response.status_code == 200
        assert SpaceMembership.objects.filter(
            space_id=space_id, user__email="friend@example.com"
        ).exists()

    def test_email_invite_wrong_user_cannot_accept(self, space_and_owner, api_client):
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "email": "friend@example.com",
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        token = invite_response.data["token"]

        api_client.post("/api/auth/register/", {
            "email": "impostor@example.com",
            "password": "testpass123",
            "display_name": "Impostor",
        })
        login = api_client.post("/api/auth/token/", {
            "email": "impostor@example.com",
            "password": "testpass123",
        })
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = api_client.post("/api/spaces/invites/accept/", {"token": token})
        assert response.status_code == 403


@pytest.mark.django_db
class TestOpenLinkInvite:
    def test_create_open_link_invite(self, space_and_owner):
        space_id, owner = space_and_owner
        response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        assert response.status_code == 201
        assert response.data["email"] is None
        assert "token" in response.data

    def test_anyone_can_accept_open_link(self, space_and_owner, api_client):
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        token = invite_response.data["token"]

        api_client.post("/api/auth/register/", {
            "email": "anyone@example.com",
            "password": "testpass123",
            "display_name": "Anyone",
        })
        login = api_client.post("/api/auth/token/", {
            "email": "anyone@example.com",
            "password": "testpass123",
        })
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        response = api_client.post("/api/spaces/invites/accept/", {"token": token})
        assert response.status_code == 200

    def test_revoke_invite(self, space_and_owner):
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        invite_id = invite_response.data["id"]
        response = owner.delete(f"/api/spaces/{space_id}/invites/{invite_id}/")
        assert response.status_code == 204
        assert SpaceInvite.objects.get(pk=invite_id).status == SpaceInvite.Status.REVOKED
```

- [ ] **Step 2: Run tests**

```bash
uv run pytest tests/spaces/test_invites.py -v
```

Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add tests/spaces/test_invites.py
git commit -m "test: space invite flows (email, open link, revoke)"
```

---

## Task 5: `budgets` app — models and default category signal

**Files:**
- Create: `backend/apps/budgets/__init__.py`
- Create: `backend/apps/budgets/models.py`
- Create: `backend/apps/budgets/default_categories.py`
- Create: `backend/apps/budgets/signals.py`
- Create: `backend/apps/budgets/apps.py`
- Create: `backend/apps/budgets/admin.py`
- Create: `backend/tests/budgets/test_signals.py`

- [ ] **Step 1: Write failing signal test**

```python
# tests/budgets/test_signals.py
import pytest
from apps.budgets.models import Category
from apps.budgets.default_categories import DEFAULT_CATEGORIES


@pytest.mark.django_db
def test_default_categories_created_on_space_creation(auth_client):
    response = auth_client.post("/api/spaces/", {"name": "Signal Test Space"})
    space_id = response.data["id"]
    categories = Category.objects.filter(space_id=space_id)
    assert categories.count() == len(DEFAULT_CATEGORIES)
    names = list(categories.values_list("name", flat=True))
    for cat in DEFAULT_CATEGORIES:
        assert cat["name"] in names


@pytest.mark.django_db
def test_default_categories_have_correct_is_income(auth_client):
    response = auth_client.post("/api/spaces/", {"name": "Income Test Space"})
    space_id = response.data["id"]
    income_cats = Category.objects.filter(space_id=space_id, is_income=True)
    expense_cats = Category.objects.filter(space_id=space_id, is_income=False)
    expected_income = [c for c in DEFAULT_CATEGORIES if c["is_income"]]
    expected_expense = [c for c in DEFAULT_CATEGORIES if not c["is_income"]]
    assert income_cats.count() == len(expected_income)
    assert expense_cats.count() == len(expected_expense)
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/budgets/test_signals.py -v
```

Expected: ImportError or missing model.

- [ ] **Step 3: Create `apps/budgets/default_categories.py`**

```python
DEFAULT_CATEGORIES = [
    {"name": "Housing", "icon": "🏠", "is_income": False},
    {"name": "Groceries", "icon": "🛒", "is_income": False},
    {"name": "Transportation", "icon": "🚗", "is_income": False},
    {"name": "Dining Out", "icon": "🍽️", "is_income": False},
    {"name": "Utilities", "icon": "💡", "is_income": False},
    {"name": "Healthcare", "icon": "🏥", "is_income": False},
    {"name": "Entertainment", "icon": "🎬", "is_income": False},
    {"name": "Clothing", "icon": "👕", "is_income": False},
    {"name": "Salary", "icon": "💰", "is_income": True},
    {"name": "Other Income", "icon": "💸", "is_income": True},
    {"name": "Other", "icon": "📦", "is_income": False},
]
```

- [ ] **Step 4: Create `apps/budgets/models.py`**

```python
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
```

- [ ] **Step 5: Create `apps/budgets/signals.py`**

```python
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.spaces.models import Space
from .models import Category
from .default_categories import DEFAULT_CATEGORIES


@receiver(post_save, sender=Space)
def create_default_categories(sender, instance, created, **kwargs):
    if created:
        Category.objects.bulk_create([
            Category(space=instance, **cat)
            for cat in DEFAULT_CATEGORIES
        ])
```

- [ ] **Step 6: Create `apps/budgets/apps.py`**

```python
from django.apps import AppConfig


class BudgetsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.budgets"

    def ready(self):
        import apps.budgets.signals  # noqa: F401
```

- [ ] **Step 7: Update `apps/budgets/__init__.py`**

```python
default_app_config = "apps.budgets.apps.BudgetsConfig"
```

- [ ] **Step 8: Create `apps/budgets/admin.py`**

```python
from django.contrib import admin
from .models import Category, Transaction, RecurringTransaction


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "icon", "space", "is_income")


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("date", "category", "amount", "paid_by", "space")


@admin.register(RecurringTransaction)
class RecurringTransactionAdmin(admin.ModelAdmin):
    list_display = ("description", "frequency", "next_due_date", "is_active", "space")
```

- [ ] **Step 9: Run migrations and tests**

```bash
uv run python manage.py makemigrations budgets
uv run python manage.py migrate
uv run pytest tests/budgets/test_signals.py -v
```

Expected: all pass.

- [ ] **Step 10: Commit**

```bash
git add apps/budgets/ tests/budgets/test_signals.py
git commit -m "feat: budgets models with default category signal on space creation"
```

---

## Task 6: Categories API

**Files:**
- Create: `backend/apps/budgets/serializers.py`
- Create: `backend/apps/budgets/views.py`
- Create: `backend/apps/budgets/urls.py`
- Create: `backend/tests/budgets/test_categories.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/budgets/test_categories.py
import pytest


@pytest.fixture
def space_id(auth_client):
    response = auth_client.post("/api/spaces/", {"name": "Budget Space"})
    return response.data["id"]


@pytest.mark.django_db
class TestCategoryAPI:
    def test_list_categories_for_space(self, auth_client, space_id):
        response = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
        assert response.status_code == 200
        assert len(response.data) == 11  # default categories

    def test_list_requires_space_id(self, auth_client):
        response = auth_client.get("/api/budgets/categories/")
        assert response.status_code == 400

    def test_create_category(self, auth_client, space_id):
        response = auth_client.post("/api/budgets/categories/", {
            "space_id": space_id,
            "name": "Piano Lessons",
            "icon": "🎹",
            "is_income": False,
        })
        assert response.status_code == 201
        assert response.data["name"] == "Piano Lessons"

    def test_update_category(self, auth_client, space_id):
        list_response = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
        cat_id = list_response.data[0]["id"]
        response = auth_client.put(f"/api/budgets/categories/{cat_id}/", {
            "name": "Renamed",
            "icon": "🏡",
            "is_income": False,
        })
        assert response.status_code == 200
        assert response.data["name"] == "Renamed"

    def test_delete_category(self, auth_client, space_id):
        list_response = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
        cat_id = list_response.data[0]["id"]
        response = auth_client.delete(f"/api/budgets/categories/{cat_id}/")
        assert response.status_code == 204

    def test_cannot_access_other_space_categories(self, auth_client, api_client):
        # Create another user's space
        api_client.post("/api/auth/register/", {
            "email": "other2@example.com",
            "password": "testpass123",
            "display_name": "Other",
        })
        login = api_client.post("/api/auth/token/", {
            "email": "other2@example.com", "password": "testpass123",
        })
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        other_space = api_client.post("/api/spaces/", {"name": "Other Space"})
        other_space_id = other_space.data["id"]

        response = auth_client.get(f"/api/budgets/categories/?space_id={other_space_id}")
        assert response.status_code == 403
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/budgets/test_categories.py -v
```

- [ ] **Step 3: Create `apps/budgets/serializers.py`**

```python
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
        read_only_fields = ("id", "created_by", "created_at")

    def validate(self, attrs):
        # Ensure category belongs to the same space
        if attrs.get("category") and attrs.get("space"):
            if attrs["category"].space != attrs["space"]:
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
        read_only_fields = ("id",)
```

- [ ] **Step 4: Create `apps/budgets/views.py`** (categories section only — transactions added in Task 7)

```python
from rest_framework import generics, status
from rest_framework.exceptions import ValidationError, PermissionDenied
from .models import Category, Transaction, RecurringTransaction
from .serializers import CategorySerializer, TransactionSerializer, RecurringTransactionSerializer
from apps.spaces.models import Space, SpaceMembership


def get_space_for_user(space_id, user):
    """Return Space if user is a member, raise otherwise."""
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
        user = self.request.user
        return Category.objects.filter(
            space__memberships__user=user
        )
```

- [ ] **Step 5: Create `apps/budgets/urls.py`** (partial — extended in Task 7)

```python
from django.urls import path
from .views import CategoryListCreateView, CategoryDetailView

urlpatterns = [
    path("categories/", CategoryListCreateView.as_view(), name="category-list"),
    path("categories/<int:pk>/", CategoryDetailView.as_view(), name="category-detail"),
]
```

- [ ] **Step 6: Run tests**

```bash
uv run pytest tests/budgets/test_categories.py -v
```

Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add apps/budgets/serializers.py apps/budgets/views.py apps/budgets/urls.py tests/budgets/test_categories.py
git commit -m "feat: categories CRUD API with space-scoped access control"
```

---

## Task 7: Transactions API

**Files:**
- Modify: `backend/apps/budgets/views.py`
- Modify: `backend/apps/budgets/urls.py`
- Create: `backend/tests/budgets/test_transactions.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/budgets/test_transactions.py
import pytest
from datetime import date


@pytest.fixture
def space_and_category(auth_client):
    space = auth_client.post("/api/spaces/", {"name": "Tx Space"})
    space_id = space.data["id"]
    categories = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
    category_id = categories.data[0]["id"]
    return space_id, category_id


@pytest.mark.django_db
class TestTransactionAPI:
    def test_create_transaction(self, auth_client, space_and_category):
        space_id, category_id = space_and_category
        response = auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id,
            "category": category_id,
            "amount": "42.50",
            "date": "2026-03-15",
            "paid_by": auth_client._user.id,
            "notes": "Test purchase",
        })
        assert response.status_code == 201
        assert response.data["amount"] == "42.50"
        assert response.data["created_by"] == auth_client._user.id

    def test_list_transactions_filtered_by_month(self, auth_client, space_and_category):
        space_id, category_id = space_and_category
        user_id = auth_client._user.id
        auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "10.00", "date": "2026-03-01",
            "paid_by": user_id,
        })
        auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "20.00", "date": "2026-04-01",
            "paid_by": user_id,
        })
        response = auth_client.get(
            f"/api/budgets/transactions/?space_id={space_id}&month=2026-03"
        )
        assert response.status_code == 200
        assert len(response.data) == 1
        assert response.data[0]["amount"] == "10.00"

    def test_list_transactions_filtered_by_category(self, auth_client, space_and_category):
        space_id, category_id = space_and_category
        user_id = auth_client._user.id
        auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "15.00", "date": "2026-03-01", "paid_by": user_id,
        })
        response = auth_client.get(
            f"/api/budgets/transactions/?space_id={space_id}&category_id={category_id}"
        )
        assert response.status_code == 200
        assert all(t["category"] == category_id for t in response.data)

    def test_update_transaction(self, auth_client, space_and_category):
        space_id, category_id = space_and_category
        user_id = auth_client._user.id
        create = auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "10.00", "date": "2026-03-01", "paid_by": user_id,
        })
        tx_id = create.data["id"]
        response = auth_client.put(f"/api/budgets/transactions/{tx_id}/", {
            "category": category_id,
            "amount": "99.00",
            "date": "2026-03-01",
            "paid_by": user_id,
        })
        assert response.status_code == 200
        assert response.data["amount"] == "99.00"

    def test_delete_transaction(self, auth_client, space_and_category):
        space_id, category_id = space_and_category
        user_id = auth_client._user.id
        create = auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "10.00", "date": "2026-03-01", "paid_by": user_id,
        })
        tx_id = create.data["id"]
        response = auth_client.delete(f"/api/budgets/transactions/{tx_id}/")
        assert response.status_code == 204
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/budgets/test_transactions.py -v
```

- [ ] **Step 3: Add transaction views to `apps/budgets/views.py`**

Append after the existing category views:

```python
class TransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = TransactionSerializer

    def get_queryset(self):
        space_id = self.request.query_params.get("space_id")
        if not space_id:
            raise ValidationError({"space_id": "This parameter is required."})
        space = get_space_for_user(space_id, self.request.user)
        qs = Transaction.objects.filter(space=space)

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
        )
```

- [ ] **Step 4: Update `apps/budgets/urls.py`**

```python
from django.urls import path
from .views import (
    CategoryListCreateView,
    CategoryDetailView,
    TransactionListCreateView,
    TransactionDetailView,
)

urlpatterns = [
    path("categories/", CategoryListCreateView.as_view(), name="category-list"),
    path("categories/<int:pk>/", CategoryDetailView.as_view(), name="category-detail"),
    path("transactions/", TransactionListCreateView.as_view(), name="transaction-list"),
    path("transactions/<int:pk>/", TransactionDetailView.as_view(), name="transaction-detail"),
]
```

- [ ] **Step 5: Run tests**

```bash
uv run pytest tests/budgets/test_transactions.py -v
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/budgets/views.py apps/budgets/urls.py tests/budgets/test_transactions.py
git commit -m "feat: transactions CRUD API with month and category filters"
```

---

## Task 8: Recurring Transactions API

**Files:**
- Modify: `backend/apps/budgets/views.py`
- Modify: `backend/apps/budgets/urls.py`
- Create: `backend/tests/budgets/test_recurring.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/budgets/test_recurring.py
import pytest


@pytest.fixture
def space_and_category(auth_client):
    space = auth_client.post("/api/spaces/", {"name": "Recurring Space"})
    space_id = space.data["id"]
    categories = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
    category_id = categories.data[0]["id"]
    return space_id, category_id


@pytest.mark.django_db
class TestRecurringTransactionAPI:
    def test_create_recurring(self, auth_client, space_and_category):
        space_id, category_id = space_and_category
        response = auth_client.post("/api/budgets/recurring-transactions/", {
            "space_id": space_id,
            "category": category_id,
            "amount": "1500.00",
            "description": "Monthly Rent",
            "frequency": "monthly",
            "start_date": "2026-01-01",
            "next_due_date": "2026-04-01",
            "is_active": True,
        })
        assert response.status_code == 201
        assert response.data["description"] == "Monthly Rent"

    def test_list_recurring(self, auth_client, space_and_category):
        space_id, category_id = space_and_category
        auth_client.post("/api/budgets/recurring-transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "50.00", "description": "Spotify",
            "frequency": "monthly", "start_date": "2026-01-01",
            "next_due_date": "2026-04-01", "is_active": True,
        })
        response = auth_client.get(f"/api/budgets/recurring-transactions/?space_id={space_id}")
        assert response.status_code == 200
        assert len(response.data) == 1

    def test_deactivate_recurring(self, auth_client, space_and_category):
        space_id, category_id = space_and_category
        create = auth_client.post("/api/budgets/recurring-transactions/", {
            "space_id": space_id, "category": category_id,
            "amount": "50.00", "description": "Spotify",
            "frequency": "monthly", "start_date": "2026-01-01",
            "next_due_date": "2026-04-01", "is_active": True,
        })
        rt_id = create.data["id"]
        response = auth_client.put(f"/api/budgets/recurring-transactions/{rt_id}/", {
            "category": category_id,
            "amount": "50.00", "description": "Spotify",
            "frequency": "monthly", "start_date": "2026-01-01",
            "next_due_date": "2026-04-01", "is_active": False,
        })
        assert response.status_code == 200
        assert response.data["is_active"] is False
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/budgets/test_recurring.py -v
```

- [ ] **Step 3: Add recurring transaction views to `apps/budgets/views.py`**

Append after `TransactionDetailView`:

```python
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
```

- [ ] **Step 4: Update `apps/budgets/urls.py`**

```python
from django.urls import path
from .views import (
    CategoryListCreateView,
    CategoryDetailView,
    TransactionListCreateView,
    TransactionDetailView,
    RecurringTransactionListCreateView,
    RecurringTransactionDetailView,
)

urlpatterns = [
    path("categories/", CategoryListCreateView.as_view(), name="category-list"),
    path("categories/<int:pk>/", CategoryDetailView.as_view(), name="category-detail"),
    path("transactions/", TransactionListCreateView.as_view(), name="transaction-list"),
    path("transactions/<int:pk>/", TransactionDetailView.as_view(), name="transaction-detail"),
    path("recurring-transactions/", RecurringTransactionListCreateView.as_view(), name="recurring-list"),
    path("recurring-transactions/<int:pk>/", RecurringTransactionDetailView.as_view(), name="recurring-detail"),
]
```

- [ ] **Step 5: Run tests**

```bash
uv run pytest tests/budgets/test_recurring.py -v
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/budgets/views.py apps/budgets/urls.py tests/budgets/test_recurring.py
git commit -m "feat: recurring transactions CRUD API"
```

---

## Task 9: Management command — `generate_recurring_transactions`

**Files:**
- Create: `backend/apps/budgets/management/__init__.py`
- Create: `backend/apps/budgets/management/commands/__init__.py`
- Create: `backend/apps/budgets/management/commands/generate_recurring_transactions.py`
- Create: `backend/tests/budgets/test_management_command.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/budgets/test_management_command.py
import pytest
from datetime import date, timedelta
from django.core.management import call_command
from apps.budgets.models import Transaction, RecurringTransaction


@pytest.fixture
def space_with_recurring(auth_client):
    space = auth_client.post("/api/spaces/", {"name": "Recurring Space"})
    space_id = space.data["id"]
    categories = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
    category_id = categories.data[0]["id"]
    from apps.spaces.models import Space
    from apps.budgets.models import Category, RecurringTransaction
    space_obj = Space.objects.get(pk=space_id)
    cat_obj = Category.objects.get(pk=category_id)
    rt = RecurringTransaction.objects.create(
        space=space_obj,
        category=cat_obj,
        amount="500.00",
        description="Test Recurring",
        frequency=RecurringTransaction.Frequency.MONTHLY,
        start_date=date(2026, 1, 1),
        next_due_date=date.today(),
        is_active=True,
    )
    return rt, auth_client._user


@pytest.mark.django_db
def test_command_generates_transaction(space_with_recurring):
    rt, user = space_with_recurring
    assert Transaction.objects.count() == 0
    call_command("generate_recurring_transactions")
    assert Transaction.objects.count() == 1
    tx = Transaction.objects.first()
    assert tx.amount == rt.amount
    assert tx.category == rt.category
    assert tx.space == rt.space


@pytest.mark.django_db
def test_command_advances_next_due_date(space_with_recurring):
    from dateutil.relativedelta import relativedelta
    rt, user = space_with_recurring
    original_due = rt.next_due_date
    call_command("generate_recurring_transactions")
    rt.refresh_from_db()
    assert rt.next_due_date == original_due + relativedelta(months=1)


@pytest.mark.django_db
def test_command_skips_future_due_dates(space_with_recurring):
    rt, user = space_with_recurring
    rt.next_due_date = date.today() + timedelta(days=5)
    rt.save()
    call_command("generate_recurring_transactions")
    assert Transaction.objects.count() == 0


@pytest.mark.django_db
def test_command_skips_inactive(space_with_recurring):
    rt, user = space_with_recurring
    rt.is_active = False
    rt.save()
    call_command("generate_recurring_transactions")
    assert Transaction.objects.count() == 0
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/budgets/test_management_command.py -v
```

- [ ] **Step 3: Create the management command**

```bash
mkdir -p apps/budgets/management/commands
touch apps/budgets/management/__init__.py
touch apps/budgets/management/commands/__init__.py
```

```python
# apps/budgets/management/commands/generate_recurring_transactions.py
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
        ).select_related("space", "category")

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
```

- [ ] **Step 4: Add `python-dateutil` to dependencies**

In `pyproject.toml`, add `"python-dateutil>=2.9"` to the `dependencies` list, then:

```bash
uv sync
```

- [ ] **Step 5: Run tests**

```bash
uv run pytest tests/budgets/test_management_command.py -v
```

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add apps/budgets/management/ tests/budgets/test_management_command.py pyproject.toml uv.lock
git commit -m "feat: generate_recurring_transactions management command"
```

---

## Task 10: Reports API

**Files:**
- Create: `backend/apps/budgets/reports.py`
- Modify: `backend/apps/budgets/views.py`
- Modify: `backend/apps/budgets/urls.py`
- Create: `backend/tests/budgets/test_reports.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/budgets/test_reports.py
import pytest
from datetime import date
from apps.budgets.models import Transaction


@pytest.fixture
def seeded_space(auth_client):
    space = auth_client.post("/api/spaces/", {"name": "Report Space"})
    space_id = space.data["id"]
    categories = auth_client.get(f"/api/budgets/categories/?space_id={space_id}")
    cat = categories.data[0]
    user_id = auth_client._user.id
    for day, amount in [("2026-03-05", "100.00"), ("2026-03-20", "50.00"), ("2026-04-01", "200.00")]:
        auth_client.post("/api/budgets/transactions/", {
            "space_id": space_id, "category": cat["id"],
            "amount": amount, "date": day, "paid_by": user_id,
        })
    return space_id, cat


@pytest.mark.django_db
class TestReports:
    def test_monthly_summary(self, auth_client, seeded_space):
        space_id, cat = seeded_space
        response = auth_client.get(
            f"/api/budgets/reports/monthly-summary/?space_id={space_id}&month=2026-03"
        )
        assert response.status_code == 200
        assert len(response.data) > 0
        totals = {r["category_id"]: r["total"] for r in response.data}
        assert totals[cat["id"]] == "150.00"

    def test_weekly_summary(self, auth_client, seeded_space):
        space_id, cat = seeded_space
        response = auth_client.get(
            f"/api/budgets/reports/weekly-summary/?space_id={space_id}&week=2026-03-01"
        )
        assert response.status_code == 200
        totals = {r["category_id"]: r["total"] for r in response.data}
        assert totals.get(cat["id"]) == "100.00"

    def test_yearly_summary(self, auth_client, seeded_space):
        space_id, cat = seeded_space
        response = auth_client.get(
            f"/api/budgets/reports/yearly-summary/?space_id={space_id}&year=2026"
        )
        assert response.status_code == 200
        totals = {r["category_id"]: r["total"] for r in response.data}
        assert totals[cat["id"]] == "350.00"

    def test_report_requires_space_id(self, auth_client):
        response = auth_client.get("/api/budgets/reports/monthly-summary/?month=2026-03")
        assert response.status_code == 400

    def test_report_wrong_space_forbidden(self, auth_client, api_client):
        api_client.post("/api/auth/register/", {
            "email": "other3@example.com", "password": "testpass123", "display_name": "Other",
        })
        login = api_client.post("/api/auth/token/", {
            "email": "other3@example.com", "password": "testpass123",
        })
        api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['access']}")
        other_space = api_client.post("/api/spaces/", {"name": "Other"})
        response = auth_client.get(
            f"/api/budgets/reports/monthly-summary/?space_id={other_space.data['id']}&month=2026-03"
        )
        assert response.status_code == 403
```

- [ ] **Step 2: Run to verify failure**

```bash
uv run pytest tests/budgets/test_reports.py -v
```

- [ ] **Step 3: Create `apps/budgets/reports.py`**

```python
from datetime import date, timedelta
from django.db.models import Sum
from .models import Transaction, Category


def _summary(space, qs):
    """Aggregate Transaction queryset by category, return list of dicts."""
    rows = (
        qs.values("category_id")
        .annotate(total=Sum("amount"))
        .order_by("category_id")
    )
    category_names = {
        c.id: {"name": c.name, "icon": c.icon}
        for c in Category.objects.filter(space=space)
    }
    return [
        {
            "category_id": row["category_id"],
            "category_name": category_names.get(row["category_id"], {}).get("name", ""),
            "category_icon": category_names.get(row["category_id"], {}).get("icon", ""),
            "total": str(row["total"]),
        }
        for row in rows
    ]


def monthly_summary(space, month_str):
    """month_str: 'YYYY-MM'"""
    year, month = month_str.split("-")
    qs = Transaction.objects.filter(
        space=space,
        date__year=int(year),
        date__month=int(month),
    )
    return _summary(space, qs)


def weekly_summary(space, week_str):
    """week_str: 'YYYY-MM-DD' (start of week)"""
    start = date.fromisoformat(week_str)
    end = start + timedelta(days=6)
    qs = Transaction.objects.filter(space=space, date__range=(start, end))
    return _summary(space, qs)


def yearly_summary(space, year_str):
    qs = Transaction.objects.filter(space=space, date__year=int(year_str))
    return _summary(space, qs)
```

- [ ] **Step 4: Add report views to `apps/budgets/views.py`**

Add the following imports at the top of views.py:

```python
from rest_framework.views import APIView
from rest_framework.response import Response
from . import reports as report_queries
```

Then append the report view class:

```python
class ReportView(APIView):
    REPORT_TYPES = {
        "monthly-summary": ("month", report_queries.monthly_summary),
        "weekly-summary": ("week", report_queries.weekly_summary),
        "yearly-summary": ("year", report_queries.yearly_summary),
    }

    def get(self, request, report_type):
        if report_type not in self.REPORT_TYPES:
            return Response({"detail": "Unknown report type."}, status=404)

        space_id = request.query_params.get("space_id")
        if not space_id:
            raise ValidationError({"space_id": "This parameter is required."})
        space = get_space_for_user(space_id, request.user)

        param_name, fn = self.REPORT_TYPES[report_type]
        param_value = request.query_params.get(param_name)
        if not param_value:
            raise ValidationError({param_name: "This parameter is required."})

        data = fn(space, param_value)
        return Response(data)
```

- [ ] **Step 5: Update `apps/budgets/urls.py`**

```python
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
```

- [ ] **Step 6: Run tests**

```bash
uv run pytest tests/budgets/test_reports.py -v
```

Expected: all pass.

- [ ] **Step 7: Run full test suite**

```bash
uv run pytest -v
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add apps/budgets/reports.py apps/budgets/views.py apps/budgets/urls.py tests/budgets/test_reports.py
git commit -m "feat: reports API (monthly, weekly, yearly summaries by category)"
```

---

## Task 11: Final wiring and smoke check

**Files:**
- No new files — verify everything connects

- [ ] **Step 1: Run all tests**

```bash
cd backend
uv run pytest -v --tb=short
```

Expected: all pass, zero failures.

- [ ] **Step 2: Apply all migrations cleanly**

```bash
uv run python manage.py migrate
```

- [ ] **Step 3: Create a superuser and verify admin works**

```bash
uv run python manage.py createsuperuser
uv run python manage.py runserver
```

Visit `http://localhost:8000/admin/` — confirm all models appear in admin.

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete Django backend MVP — auth, spaces, budgets, reports"
```
