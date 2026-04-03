from django.urls import path
from .views import (
    SpaceListCreateView,
    SpaceDetailView,
    SpaceInviteCreateView,
    AcceptInviteView,
    RevokeInviteView,
)

urlpatterns = [
    path("", SpaceListCreateView.as_view(), name="space-list"),
    path("<int:pk>/", SpaceDetailView.as_view(), name="space-detail"),
    path("<int:space_id>/invites/", SpaceInviteCreateView.as_view(), name="space-invite-create"),
    path("invites/accept/", AcceptInviteView.as_view(), name="space-invite-accept"),
    path("<int:space_id>/invites/<int:invite_id>/", RevokeInviteView.as_view(), name="space-invite-revoke"),
]
