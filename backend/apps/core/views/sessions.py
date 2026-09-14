from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from ..access import AUTHENTICATED
from ..models import UserSession


class SessionViewSet(viewsets.ViewSet):
    """List and revoke the current user's active sessions."""

    permission_classes = AUTHENTICATED

    def list(self, request):
        qs = UserSession.objects.filter(user=request.user, revoked=False, expires_at__gt=timezone.now()).order_by(
            "-created_at"
        )
        return Response(
            [
                {
                    "id": s.id,
                    "jti": s.jti,
                    "ip_address": s.ip_address,
                    "device_info": s.device_info,
                    "created_at": s.created_at.isoformat(),
                    "expires_at": s.expires_at.isoformat(),
                }
                for s in qs
            ]
        )

    def destroy(self, request, pk=None):
        session = UserSession.objects.filter(pk=pk, user=request.user).first()
        if session is None:
            return Response({"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND)
        session.revoked = True
        session.save(update_fields=["revoked"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["delete"], url_path="revoke-all")
    def revoke_all(self, request):
        updated = UserSession.objects.filter(user=request.user, revoked=False).update(revoked=True)
        return Response({"revoked": updated})
