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
        assert SpaceInvite.objects.get(pk=invite_id).status == SpaceInvite.Status.REVOKED

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

    def test_plain_member_cannot_create_invite(self, api_client, space_and_owner):
        """A member (non-owner/admin) cannot create invites and receives 403."""
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {})
        member = make_user("member@example.com")
        api_client.force_authenticate(user=member)
        api_client.post("/api/spaces/invites/accept/", {"token": invite_response.data["token"]})

        response = api_client.post(f"/api/spaces/{space_id}/invites/", {})
        assert response.status_code == 403
        assert SpaceInvite.objects.filter(space_id=space_id).count() == 1


@pytest.mark.django_db
class TestInvitePreview:
    def test_preview_returns_space_and_inviter(self, space_and_owner, api_client):
        """Preview returns the space name, inviter, and a valid flag for a pending invite."""
        space_id, owner = space_and_owner
        token = owner.post(f"/api/spaces/{space_id}/invites/", {}).data["token"]

        invitee = make_user("invitee@example.com")
        api_client.force_authenticate(user=invitee)
        response = api_client.get("/api/spaces/invites/preview/", {"token": token})
        assert response.status_code == 200
        assert response.data["space_name"] == "Test Space"
        assert response.data["invited_by"]
        assert response.data["valid"] is True
        assert response.data["expired"] is False

    def test_preview_marks_revoked_invite_invalid(self, space_and_owner, api_client):
        """Preview of a revoked invite reports valid=False without erroring."""
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {})
        owner.delete(f"/api/spaces/{space_id}/invites/{invite_response.data['id']}/")

        invitee = make_user("preview-late@example.com")
        api_client.force_authenticate(user=invitee)
        response = api_client.get("/api/spaces/invites/preview/", {"token": invite_response.data["token"]})
        assert response.status_code == 200
        assert response.data["valid"] is False

    def test_preview_unknown_token_returns_404(self, auth_client):
        """Preview of a non-existent token returns 404."""
        response = auth_client.get(
            "/api/spaces/invites/preview/",
            {"token": "00000000-0000-0000-0000-000000000000"},
        )
        assert response.status_code == 404
