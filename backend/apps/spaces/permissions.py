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
