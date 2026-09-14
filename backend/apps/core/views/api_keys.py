import secrets

from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle

from ..access import AUTHENTICATED, is_admin_or_superadmin, is_superadmin
from ..models import Lab, LabApiKey
from ._shared import _write_audit_log


class LabApiKeyViewSet(viewsets.ViewSet):
    """Generate and manage lab API keys (hashed storage, plaintext shown once)."""

    permission_classes = AUTHENTICATED

    def get_throttles(self):
        if self.action == "create":
            self.throttle_scope = "api_key_create"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def _assert_admin(self, user):
        if not is_admin_or_superadmin(user):
            raise PermissionDenied("API kľúče môže spravovať iba administrátor alebo superadministrátor")

    def _get_lab(self, user):
        if is_superadmin(user):
            return None
        lab = getattr(user, "lab", None)
        if not lab:
            raise PermissionDenied("Používateľ nemá priradené laboratórium")
        return lab

    def list(self, request):
        self._assert_admin(request.user)
        lab = self._get_lab(request.user)
        qs = LabApiKey.objects.filter(is_active=True)
        if lab:
            qs = qs.filter(lab=lab)
        return Response(
            [
                {
                    "id": k.id,
                    "name": k.name,
                    "prefix": k.prefix,
                    "is_active": k.is_active,
                    "last_used_at": (k.last_used_at.isoformat() if k.last_used_at else None),
                    "created_at": k.created_at.isoformat(),
                }
                for k in qs
            ]
        )

    def create(self, request):
        import hashlib

        self._assert_admin(request.user)
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response({"name": "Name is required"}, status=status.HTTP_400_BAD_REQUEST)

        lab = self._get_lab(request.user)
        if lab is None:
            lab_id = request.data.get("lab_id")
            if not lab_id:
                return Response(
                    {"lab_id": "lab_id required for superadmin"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            lab = Lab.objects.filter(id=lab_id).first()
            if not lab:
                return Response({"detail": "Lab not found"}, status=status.HTTP_404_NOT_FOUND)

        raw_key = secrets.token_urlsafe(32)
        prefix = raw_key[:8]
        hashed = hashlib.sha256(raw_key.encode()).hexdigest()

        key = LabApiKey.objects.create(
            lab=lab,
            name=name,
            prefix=prefix,
            hashed_key=hashed,
            created_by=request.user,
        )
        _write_audit_log(
            request,
            action="api_key.created",
            entity_type="lab_api_key",
            entity_id=key.id,
            lab=lab,
            description=f"API key {key.name} created",
            metadata={"name": key.name, "prefix": key.prefix},
        )
        return Response(
            {
                "id": key.id,
                "name": key.name,
                "prefix": key.prefix,
                "key": raw_key,
                "created_at": key.created_at.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, pk=None):
        self._assert_admin(request.user)
        lab = self._get_lab(request.user)
        qs = LabApiKey.objects.filter(pk=pk)
        if lab:
            qs = qs.filter(lab=lab)
        key = qs.first()
        if not key:
            return Response({"detail": "API key not found"}, status=status.HTTP_404_NOT_FOUND)
        key.is_active = False
        key.save(update_fields=["is_active"])
        _write_audit_log(
            request,
            action="api_key.revoked",
            entity_type="lab_api_key",
            entity_id=key.id,
            lab=key.lab,
            description=f"API key {key.name} revoked",
            metadata={"name": key.name, "prefix": key.prefix},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
