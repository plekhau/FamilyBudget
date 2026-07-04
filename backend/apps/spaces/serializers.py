from datetime import timedelta

from django.utils import timezone
from rest_framework import serializers

from apps.accounts.models import User

from .models import Space, SpaceInvite, SpaceMembership


SUPPORTED_LOCALES = ("en-US", "en-GB", "de-DE", "fr-FR", "es-ES", "pl-PL", "ru-RU")


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
        fields = ("id", "name", "currency", "locale", "created_at", "members")
        read_only_fields = ("id", "created_at", "members")

    def validate_currency(self, value):
        value = value.upper()
        if len(value) != 3 or not value.isalpha():
            raise serializers.ValidationError("Currency must be a 3-letter code.")
        return value

    def validate_locale(self, value):
        if value and value not in SUPPORTED_LOCALES:
            raise serializers.ValidationError("Unsupported locale.")
        return value


class SpaceInviteSerializer(serializers.ModelSerializer):
    token = serializers.UUIDField(read_only=True)

    class Meta:
        model = SpaceInvite
        fields = ("id", "space", "token", "status", "expires_at")
        read_only_fields = ("id", "space", "token", "status")
        extra_kwargs = {"expires_at": {"required": False}}

    def validate(self, attrs):
        attrs.setdefault(
            "expires_at",
            timezone.now() + timedelta(days=7),
        )
        return attrs


class AcceptInviteSerializer(serializers.Serializer):
    token = serializers.UUIDField()
