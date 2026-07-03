import pytest


@pytest.mark.django_db
class TestSpaceCurrency:
    def test_create_space_with_currency(self, auth_client):
        """Creating a space with an explicit currency stores and returns it."""
        response = auth_client.post("/api/spaces/", {"name": "Euro Home", "currency": "EUR"})
        assert response.status_code == 201
        assert response.data["currency"] == "EUR"

    def test_create_space_defaults_to_usd(self, auth_client):
        """Creating a space without a currency defaults to USD."""
        response = auth_client.post("/api/spaces/", {"name": "Plain Home"})
        assert response.status_code == 201
        assert response.data["currency"] == "USD"

    def test_currency_is_uppercased(self, auth_client):
        """A lowercase currency code is normalized to uppercase."""
        response = auth_client.post("/api/spaces/", {"name": "Lower", "currency": "eur"})
        assert response.status_code == 201
        assert response.data["currency"] == "EUR"

    def test_currency_must_be_three_letters(self, auth_client):
        """A currency code that is not exactly 3 alphabetic characters is rejected with 400."""
        for bad in ("EURO", "E1R", "€"):
            response = auth_client.post("/api/spaces/", {"name": "Bad", "currency": bad})
            assert response.status_code == 400

    def test_list_spaces_includes_currency(self, auth_client):
        """Listing spaces includes each space's currency."""
        auth_client.post("/api/spaces/", {"name": "Home", "currency": "PLN"})
        response = auth_client.get("/api/spaces/")
        assert response.data[0]["currency"] == "PLN"
