# tests/spaces/test_invites.py
from datetime import timedelta

import dateutil.parser
import pytest
from django.utils import timezone

from apps.accounts.models import User
from apps.spaces.models import SpaceInvite, SpaceMembership


@pytest.fixture
def space_and_owner(auth_client):
    response = auth_client.post("/api/spaces/", {"name": "Test Space"})
    return response.data["id"], auth_client


def make_user(email):
    return User.objects.create_user(
        email=email,
        password="testpass123",
        display_name=email.split("@")[0],
    )


@pytest.mark.django_db
class TestInviteDefaults:
    def test_create_invite_without_expires_at_defaults_to_7_days(self, space_and_owner):
        """POST without expires_at should succeed and default to 7 days from now."""
        space_id, owner = space_and_owner
        before = timezone.now()
        response = owner.post(f"/api/spaces/{space_id}/invites/", {})
        assert response.status_code == 201
        assert "token" in response.data
        expires_dt = dateutil.parser.parse(response.data["expires_at"])
        assert expires_dt >= before + timedelta(days=6)
        assert expires_dt <= before + timedelta(days=8)


@pytest.mark.django_db
class TestOpenLinkInvite:
    def test_create_invite_returns_token(self, space_and_owner):
        """Creating an invite returns 201 with a token."""
        space_id, owner = space_and_owner
        response = owner.post(f"/api/spaces/{space_id}/invites/", {})
        assert response.status_code == 201
        assert "token" in response.data

    def test_anyone_can_accept_invite(self, space_and_owner, api_client):
        """Any authenticated user can accept an invite and becomes a space member."""
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {})
        token = invite_response.data["token"]

        anyone = make_user("anyone@example.com")
        api_client.force_authenticate(user=anyone)
        response = api_client.post("/api/spaces/invites/accept/", {"token": token})
        assert response.status_code == 200
        assert SpaceMembership.objects.filter(space_id=space_id, user=anyone).exists()

    def test_revoke_invite(self, space_and_owner):
        """Deleting an invite marks its status as REVOKED and returns 204."""
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {})
        invite_id = invite_response.data["id"]
        response = owner.delete(f"/api/spaces/{space_id}/invites/{invite_id}/")
        assert response.status_code == 204
        assert (
            SpaceInvite.objects.get(pk=invite_id).status == SpaceInvite.Status.REVOKED
        )

    def test_revoked_invite_cannot_be_accepted(self, space_and_owner, api_client):
        """A revoked invite token cannot be accepted and returns 400."""
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {})
        invite_id = invite_response.data["id"]
        token = invite_response.data["token"]
        owner.delete(f"/api/spaces/{space_id}/invites/{invite_id}/")

        anyone = make_user("late@example.com")
        api_client.force_authenticate(user=anyone)
        response = api_client.post("/api/spaces/invites/accept/", {"token": token})
        assert response.status_code == 400

    def test_revoking_already_revoked_invite_returns_404(self, space_and_owner):
        """Attempting to revoke an already-revoked invite returns 404."""
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {})
        invite_id = invite_response.data["id"]
        owner.delete(f"/api/spaces/{space_id}/invites/{invite_id}/")
        response = owner.delete(f"/api/spaces/{space_id}/invites/{invite_id}/")
        assert response.status_code == 404

    def test_non_member_cannot_create_invite(self, api_client, space_and_owner):
        """A user who is not a space member cannot create an invite and receives 404."""
        space_id, _ = space_and_owner
        outsider = make_user("outsider@example.com")
        api_client.force_authenticate(user=outsider)
        response = api_client.post(f"/api/spaces/{space_id}/invites/", {})
        assert response.status_code == 404
