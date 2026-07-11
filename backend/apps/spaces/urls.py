from django.urls import path

from .views import (
    AcceptInviteView,
    InvitePreviewView,
    RevokeInviteView,
    SpaceDetailView,
    SpaceInviteCreateView,
    SpaceListCreateView,
)

urlpatterns = [
    path("", SpaceListCreateView.as_view(), name="space-list"),
    path("<int:pk>/", SpaceDetailView.as_view(), name="space-detail"),
    path(
        "<int:space_id>/invites/",
        SpaceInviteCreateView.as_view(),
        name="space-invite-create",
    ),
    path("invites/preview/", InvitePreviewView.as_view(), name="space-invite-preview"),
    path("invites/accept/", AcceptInviteView.as_view(), name="space-invite-accept"),
    path(
        "<int:space_id>/invites/<int:invite_id>/",
        RevokeInviteView.as_view(),
        name="space-invite-revoke",
    ),
]
