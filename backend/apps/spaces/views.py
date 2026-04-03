from django.utils import timezone
from rest_framework import generics, status, permissions
from rest_framework.response import Response
from rest_framework.views import APIView
from .models import Space, SpaceMembership, SpaceInvite
from .serializers import SpaceSerializer, SpaceInviteSerializer, AcceptInviteSerializer
from .permissions import IsSpaceOwner, IsSpaceOwnerOrAdmin


class SpaceListCreateView(generics.ListCreateAPIView):
    serializer_class = SpaceSerializer

    def get_queryset(self):
        return Space.objects.filter(memberships__user=self.request.user)

    def perform_create(self, serializer):
        space = serializer.save(created_by=self.request.user)
        SpaceMembership.objects.create(
            space=space,
            user=self.request.user,
            role=SpaceMembership.Role.OWNER,
        )


class SpaceDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = SpaceSerializer

    def get_queryset(self):
        return Space.objects.filter(memberships__user=self.request.user)

    def destroy(self, request, *args, **kwargs):
        space = self.get_object()
        self.check_object_permissions(request, space)
        space.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    def get_permissions(self):
        if self.request.method == "DELETE":
            return [permissions.IsAuthenticated(), IsSpaceOwner()]
        return [permissions.IsAuthenticated()]


class SpaceInviteCreateView(generics.CreateAPIView):
    serializer_class = SpaceInviteSerializer

    def perform_create(self, serializer):
        space = Space.objects.get(
            pk=self.kwargs["space_id"],
            memberships__user=self.request.user,
        )
        serializer.save(space=space, invited_by=self.request.user)


class AcceptInviteView(APIView):
    def post(self, request):
        serializer = AcceptInviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        token = serializer.validated_data["token"]

        try:
            invite = SpaceInvite.objects.get(token=token, status=SpaceInvite.Status.PENDING)
        except SpaceInvite.DoesNotExist:
            return Response({"detail": "Invalid or expired invite."}, status=status.HTTP_400_BAD_REQUEST)

        if invite.expires_at < timezone.now():
            invite.status = SpaceInvite.Status.EXPIRED
            invite.save()
            return Response({"detail": "Invite has expired."}, status=status.HTTP_400_BAD_REQUEST)

        if invite.email and invite.email != request.user.email:
            return Response({"detail": "This invite is for a different email address."}, status=status.HTTP_403_FORBIDDEN)

        SpaceMembership.objects.get_or_create(
            space=invite.space,
            user=request.user,
            defaults={"role": SpaceMembership.Role.MEMBER},
        )
        invite.status = SpaceInvite.Status.ACCEPTED
        invite.save()
        return Response({"detail": "Joined space successfully."}, status=status.HTTP_200_OK)


class RevokeInviteView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, space_id, invite_id):
        try:
            invite = SpaceInvite.objects.get(
                pk=invite_id,
                space_id=space_id,
                space__memberships__user=request.user,
            )
        except SpaceInvite.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        membership = SpaceMembership.objects.get(user=request.user, space_id=space_id)
        if membership.role not in (SpaceMembership.Role.OWNER, SpaceMembership.Role.ADMIN):
            return Response(status=status.HTTP_403_FORBIDDEN)

        invite.status = SpaceInvite.Status.REVOKED
        invite.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
