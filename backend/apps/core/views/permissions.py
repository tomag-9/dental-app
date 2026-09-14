from rest_framework import status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from ..access import (
    AUTHENTICATED,
    LAB_PERMISSION_ACTIONS,
    UI_PERMISSION_ACTIONS,
    has_lab_permission,
    invalidate_lab_permission_cache,
    is_admin_or_superadmin,
    is_superadmin,
    role_permission_matrix,
)
from ..models import Lab, LabRolePermission
from ._shared import _write_audit_log


def _role_permission_payload(user):
    role = getattr(user, "role", "user") or "user"
    superadmin = is_superadmin(user)
    admin = is_admin_or_superadmin(user)

    navigation = [
        ("dashboard", "Nástenka", "/dashboard", "dashboard", True),
        ("jobs", "Práce", "/jobs", "briefcase", True),
        ("calendar", "Kalendár", "/calendar", "calendar", True),
        ("patients", "Pacienti", "/patients", "user", role != "technician"),
        ("crm", "CRM", "/clinics", "building", role != "technician"),
        ("finance", "Finance", "/finance", "euro", admin),
        ("inventory", "Sklad", "/inventory", "package", admin),
        ("settings", "Nastavenia", "/settings", "settings", admin),
        ("superadmin", "Superadmin", "/superadmin", "shield", superadmin),
    ]
    # Actions come from the shared registry in apps.core.access and honour
    # per-lab LabRolePermission overrides, so the UI and the API answer the
    # very same question.
    actions = {action: has_lab_permission(user, action) for action in UI_PERMISSION_ACTIONS}

    return {
        "role": role,
        "is_superadmin": superadmin,
        "navigation": [
            {
                "id": item_id,
                "label": label,
                "path": path,
                "icon": icon,
                "allowed": allowed,
            }
            for item_id, label, path, icon, allowed in navigation
        ],
        "actions": actions,
    }


class PermissionsView(APIView):
    permission_classes = AUTHENTICATED

    def get(self, request):
        return Response(_role_permission_payload(request.user))


class PermissionsMatrixView(APIView):
    """Return the full role → allowed actions matrix.

    ``matrix`` lists the *defaults* per role; ``current_permissions`` is the
    caller's effective set with per-lab overrides already applied.
    """

    permission_classes = AUTHENTICATED

    def get(self, request):
        user = request.user
        role = getattr(user, "role", "user")
        matrix = role_permission_matrix()
        if role in matrix:
            effective = [action for action in sorted(LAB_PERMISSION_ACTIONS) if has_lab_permission(user, action)]
        else:
            effective = []
        return Response(
            {
                "current_role": role,
                "current_permissions": effective,
                "matrix": matrix,
            }
        )


class LabRolePermissionViewSet(viewsets.ViewSet):
    """Manage per-lab role permission metadata overrides. Admin-only."""

    permission_classes = AUTHENTICATED

    def _get_lab(self, request, lab_pk):
        user = request.user
        if is_superadmin(user):
            return Lab.objects.filter(pk=lab_pk).first()
        try:
            requested_lab_id = int(lab_pk)
        except (TypeError, ValueError):
            return None
        if is_admin_or_superadmin(user) and getattr(user, "lab_id", None) == requested_lab_id:
            return user.lab
        return None

    def list(self, request, lab_pk=None):
        lab = self._get_lab(request, lab_pk)
        if not lab:
            raise PermissionDenied("Access denied or lab not found.")
        overrides = LabRolePermission.objects.filter(lab=lab)
        data = [{"id": o.id, "role": o.role, "action": o.action, "allowed": o.allowed} for o in overrides]
        return Response(data)

    def create(self, request, lab_pk=None):
        lab = self._get_lab(request, lab_pk)
        if not lab:
            raise PermissionDenied("Access denied or lab not found.")
        role = request.data.get("role")
        action_name = request.data.get("action")
        raw_allowed = request.data.get("allowed", True)
        if not role or not action_name:
            return Response(
                {"detail": "role and action are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if action_name not in LAB_PERMISSION_ACTIONS:
            return Response(
                {"detail": f"Neznáma akcia: {action_name}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        valid_roles = {r for r, _ in LabRolePermission.ROLE_CHOICES}
        if role not in valid_roles:
            return Response(
                {"detail": f"role must be one of: {', '.join(sorted(valid_roles))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Normalise: JSON bool → Python bool; string "false"/"0" → False.
        if isinstance(raw_allowed, str):
            allowed = raw_allowed.lower() not in ("false", "0", "no")
        else:
            allowed = bool(raw_allowed)
        override, _ = LabRolePermission.objects.update_or_create(
            lab=lab,
            role=role,
            action=action_name,
            defaults={"allowed": allowed},
        )
        invalidate_lab_permission_cache(request.user)
        _write_audit_log(
            request,
            action="permission_override.saved",
            entity_type="lab_role_permission",
            entity_id=override.id,
            lab=lab,
            description=f"Permission override {role}:{action_name}={allowed}",
            metadata={"role": role, "action": action_name, "allowed": allowed},
        )
        return Response(
            {
                "id": override.id,
                "role": override.role,
                "action": override.action,
                "allowed": override.allowed,
            },
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, lab_pk=None, pk=None):
        lab = self._get_lab(request, lab_pk)
        if not lab:
            raise PermissionDenied("Access denied or lab not found.")
        override = LabRolePermission.objects.filter(lab=lab, pk=pk).first()
        if not override:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        metadata = {
            "role": override.role,
            "action": override.action,
            "allowed": override.allowed,
        }
        entity_id = override.id
        description = f"Permission override {override.role}:{override.action} deleted"
        override.delete()
        invalidate_lab_permission_cache(request.user)
        _write_audit_log(
            request,
            action="permission_override.deleted",
            entity_type="lab_role_permission",
            entity_id=entity_id,
            lab=lab,
            description=description,
            metadata=metadata,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
