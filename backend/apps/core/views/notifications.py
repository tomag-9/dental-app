from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from ..access import AUTHENTICATED, is_superadmin
from ..models import Notification, User
from ..serializers import NotificationSerializer
from ._shared import _write_audit_log


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = AUTHENTICATED

    def get_queryset(self):
        qs = Notification.objects.select_related("lab", "recipient")
        if not is_superadmin(self.request.user):
            qs = qs.filter(recipient=self.request.user)

        # Only apply query-param filters for list/retrieve — not for bulk actions
        # like mark_all_read or unread_count which must see the full recipient scope.
        if getattr(self, "action", None) in ("list", "retrieve"):
            notification_type = self.request.query_params.get("type")
            if notification_type:
                qs = qs.filter(type=notification_type)

            if self.request.query_params.get("unread") in ("1", "true"):
                qs = qs.filter(read_at__isnull=True)

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        if is_superadmin(user):
            recipient = serializer.validated_data.get("recipient") or user
            lab = serializer.validated_data.get("lab") or getattr(recipient, "lab", None)
            serializer.save(recipient=recipient, lab=lab)
            return

        serializer.save(recipient=user, lab=getattr(user, "lab", None))

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = self.get_queryset().filter(read_at__isnull=True).update(read_at=timezone.now())
        return Response({"updated": updated})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response({"unread_count": self.get_queryset().filter(read_at__isnull=True).count()})

    @action(detail=False, methods=["post"], url_path="broadcast")
    def broadcast(self, request):
        if not is_superadmin(request.user):
            raise PermissionDenied("Superadmin only endpoint")

        title = (request.data.get("title") or "").strip()
        if not title:
            raise ValidationError({"title": "Title is required"})
        message = (request.data.get("message") or "").strip()
        notif_type = request.data.get("type") or "system"

        recipients = User.objects.filter(is_active=True).exclude(role="superadmin")
        notifications = [
            Notification(lab=user.lab, recipient=user, type=notif_type, title=title, message=message)
            for user in recipients
        ]
        created = Notification.objects.bulk_create(notifications)

        _write_audit_log(
            request,
            action="notification.broadcast",
            entity_type="notification",
            description=f"Broadcast to all tenants: {title}",
            metadata={"title": title, "recipients": len(created)},
        )
        return Response({"created": len(created)}, status=status.HTTP_201_CREATED)
