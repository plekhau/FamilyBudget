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
