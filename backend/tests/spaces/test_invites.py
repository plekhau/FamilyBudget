# tests/spaces/test_invites.py
import pytest
from django.utils import timezone
from datetime import timedelta
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
class TestEmailInvite:
    def test_create_email_invite(self, space_and_owner):
        """Creating an email invite returns 201 with the invited email and a token."""
        space_id, owner = space_and_owner
        response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "email": "friend@example.com",
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        assert response.status_code == 201
        assert response.data["email"] == "friend@example.com"
        assert "token" in response.data

    def test_accept_email_invite(self, space_and_owner, api_client):
        """The invited user can accept their invite and becomes a member of the space."""
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "email": "friend@example.com",
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        token = invite_response.data["token"]

        friend = make_user("friend@example.com")
        api_client.force_authenticate(user=friend)
        response = api_client.post("/api/spaces/invites/accept/", {"token": token})
        assert response.status_code == 200
        assert SpaceMembership.objects.filter(
            space_id=space_id, user=friend
        ).exists()

    def test_email_invite_wrong_user_cannot_accept(self, space_and_owner, api_client):
        """A user other than the one invited by email cannot accept the invite and receives 403."""
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "email": "friend@example.com",
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        token = invite_response.data["token"]

        impostor = make_user("impostor@example.com")
        api_client.force_authenticate(user=impostor)
        response = api_client.post("/api/spaces/invites/accept/", {"token": token})
        assert response.status_code == 403


@pytest.mark.django_db
class TestOpenLinkInvite:
    def test_create_open_link_invite(self, space_and_owner):
        """Creating an invite without an email produces an open-link invite with a null email and a token."""
        space_id, owner = space_and_owner
        response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        assert response.status_code == 201
        assert response.data["email"] is None
        assert "token" in response.data

    def test_anyone_can_accept_open_link(self, space_and_owner, api_client):
        """Any authenticated user can accept an open-link invite and becomes a space member."""
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        token = invite_response.data["token"]

        anyone = make_user("anyone@example.com")
        api_client.force_authenticate(user=anyone)
        response = api_client.post("/api/spaces/invites/accept/", {"token": token})
        assert response.status_code == 200
        assert SpaceMembership.objects.filter(space_id=space_id, user=anyone).exists()

    def test_revoke_invite(self, space_and_owner):
        """Deleting an invite marks its status as REVOKED and returns 204."""
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        invite_id = invite_response.data["id"]
        response = owner.delete(f"/api/spaces/{space_id}/invites/{invite_id}/")
        assert response.status_code == 204
        assert SpaceInvite.objects.get(pk=invite_id).status == SpaceInvite.Status.REVOKED

    def test_revoked_invite_cannot_be_accepted(self, space_and_owner, api_client):
        """A revoked invite token cannot be accepted and returns 400."""
        space_id, owner = space_and_owner
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
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
        invite_response = owner.post(f"/api/spaces/{space_id}/invites/", {
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        invite_id = invite_response.data["id"]
        owner.delete(f"/api/spaces/{space_id}/invites/{invite_id}/")
        response = owner.delete(f"/api/spaces/{space_id}/invites/{invite_id}/")
        assert response.status_code == 404

    def test_non_member_cannot_create_invite(self, api_client, space_and_owner):
        """A user who is not a space member cannot create an invite for that space and receives 404."""
        space_id, _ = space_and_owner
        outsider = make_user("outsider@example.com")
        api_client.force_authenticate(user=outsider)
        response = api_client.post(f"/api/spaces/{space_id}/invites/", {
            "expires_at": (timezone.now() + timedelta(days=7)).isoformat(),
        })
        assert response.status_code == 404
