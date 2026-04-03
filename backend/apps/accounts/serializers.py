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
