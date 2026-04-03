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
