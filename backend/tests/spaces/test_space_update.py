import pytest

from apps.accounts.models import User
from apps.spaces.models import SpaceMembership


@pytest.mark.django_db
class TestSpaceUpdate:
    def _space_with_second_user(self, auth_client, role):
        """Create a space owned by auth_client's user plus a second user with the given role."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        other = User.objects.create_user(email="second@example.com", password="testpass123", display_name="Second")
        SpaceMembership.objects.create(space_id=space_id, user=other, role=role)
        return space_id, other

    def test_owner_can_update_currency(self, auth_client):
        """The space owner can PATCH the currency and receives the updated value."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        response = auth_client.patch(f"/api/spaces/{space_id}/", {"currency": "EUR"})
        assert response.status_code == 200
        assert response.data["currency"] == "EUR"

    def test_owner_can_rename_space(self, auth_client):
        """The space owner can PATCH the name."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        response = auth_client.patch(f"/api/spaces/{space_id}/", {"name": "New Name"})
        assert response.status_code == 200
        assert response.data["name"] == "New Name"

    def test_admin_can_update_currency(self, auth_client, api_client):
        """A space admin (not owner) can PATCH the currency."""
        space_id, admin = self._space_with_second_user(auth_client, SpaceMembership.Role.ADMIN)
        api_client.force_authenticate(user=admin)
        response = api_client.patch(f"/api/spaces/{space_id}/", {"currency": "GBP"})
        assert response.status_code == 200
        assert response.data["currency"] == "GBP"

    def test_member_cannot_update_space(self, auth_client, api_client):
        """A plain member gets 403 when PATCHing the space."""
        space_id, member = self._space_with_second_user(auth_client, SpaceMembership.Role.MEMBER)
        api_client.force_authenticate(user=member)
        response = api_client.patch(f"/api/spaces/{space_id}/", {"currency": "GBP"})
        assert response.status_code == 403

    def test_non_member_cannot_update_space(self, auth_client, api_client):
        """A user outside the space gets 404 when PATCHing it."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        outsider = User.objects.create_user(email="outsider@example.com", password="testpass123", display_name="Out")
        api_client.force_authenticate(user=outsider)
        response = api_client.patch(f"/api/spaces/{space_id}/", {"currency": "GBP"})
        assert response.status_code == 404

    @pytest.mark.parametrize("locale", ["en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "pl-PL", "ru-RU", ""])
    def test_owner_can_update_locale(self, auth_client, locale):
        """The owner can PATCH any supported locale, including '' meaning auto."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        response = auth_client.patch(f"/api/spaces/{space_id}/", {"locale": locale})
        assert response.status_code == 200
        assert response.data["locale"] == locale

    def test_unsupported_locale_rejected(self, auth_client):
        """PATCHing a locale outside the supported list returns 400."""
        space_id = auth_client.post("/api/spaces/", {"name": "Home"}).data["id"]
        response = auth_client.patch(f"/api/spaces/{space_id}/", {"locale": "xx-XX"})
        assert response.status_code == 400

    def test_locale_defaults_to_empty(self, auth_client):
        """A newly created space has locale '' (auto) in its payload."""
        response = auth_client.post("/api/spaces/", {"name": "Home"})
        assert response.data["locale"] == ""
