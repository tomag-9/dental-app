from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied

from ..access import AUTHENTICATED, is_superadmin
from ..models import AuditLog
from ..serializers import AuditLogSerializer


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = AUTHENTICATED

    def get_queryset(self):
        if not is_superadmin(self.request.user):
            raise PermissionDenied("Superadmin only endpoint")
        return AuditLog.objects.select_related("actor", "lab").all()
