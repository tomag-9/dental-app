"""
Thin service layer for user management business logic.

Extracted from UserViewSet so the logic can be tested independently
and reused without going through the HTTP layer.
"""

from rest_framework.exceptions import PermissionDenied, ValidationError

from .access import is_admin_or_superadmin, is_superadmin
from .models import AuditLog

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _audit_snapshot(user):
    return {
        "email": user.email,
        "role": user.role,
        "lab_id": user.lab_id,
        "is_active": user.is_active,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "nickname": user.nickname,
    }


def _audit_changed_fields(before, user):
    after = _audit_snapshot(user)
    return sorted(field for field, value in before.items() if after[field] != value)


def _write_audit(*, actor, action, entity_id, lab, description, metadata=None):
    AuditLog.objects.create(
        actor=actor,
        lab=lab,
        action=action,
        entity_type="user",
        entity_id=str(entity_id) if entity_id else "",
        description=description,
        metadata=metadata or {},
    )


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


def create_user(actor, serializer):
    """
    Validate actor permissions, enforce lab/role constraints, save user,
    and write an audit log entry.

    ``serializer`` must already be valid (``is_valid(raise_exception=True)``
    called by the caller).  The function calls ``serializer.save(...)`` and
    returns the created ``User`` instance.

    Raises ``PermissionDenied`` if the actor is not admin or superadmin.
    """
    if not is_admin_or_superadmin(actor):
        raise PermissionDenied("Používateľov môže spravovať iba administrátor alebo superadministrátor")

    if not is_superadmin(actor):
        role = serializer.validated_data.get("role")
        if role == "superadmin":
            raise PermissionDenied("Rolu superadministrátora môže priradiť iba superadministrátor")
        user = serializer.save(lab=actor.lab)
    else:
        user = serializer.save()

    _write_audit(
        actor=actor,
        action="user.created",
        entity_id=user.id,
        lab=user.lab,
        description=f"User {user.username} created",
        metadata={"role": user.role, "lab_id": user.lab_id},
    )
    return user


def update_user(actor, target, serializer, data):
    """
    Validate field-level restrictions for actor updating *target*, save the
    user via *serializer*, and write an audit log entry with changed fields.

    ``serializer`` must already be valid.  ``data`` is the raw request payload
    (used for permission checks before deserialization).

    Returns the updated ``User`` instance.

    Raises ``PermissionDenied`` or ``ValidationError`` on constraint violations.
    """
    if not is_admin_or_superadmin(actor):
        raise PermissionDenied("Používateľov môže spravovať iba administrátor alebo superadministrátor")

    _validate_update_contract(actor, target, data)

    before = _audit_snapshot(target)
    user = serializer.save()
    changed_fields = _audit_changed_fields(before, user)

    _write_audit(
        actor=actor,
        action="user.updated",
        entity_id=user.id,
        lab=user.lab,
        description=f"User {user.username} updated",
        metadata={
            "fields": changed_fields,
            "role": user.role,
            "lab_id": user.lab_id,
        },
    )
    return user


def delete_user(actor, instance):
    """
    Validate deletion permissions, write an audit log entry, and delete the
    user.

    Raises ``PermissionDenied`` if the actor is not admin or superadmin.
    """
    if not is_admin_or_superadmin(actor):
        raise PermissionDenied("Používateľov môže spravovať iba administrátor alebo superadministrátor")

    _write_audit(
        actor=actor,
        action="user.deleted",
        entity_id=instance.id,
        lab=instance.lab,
        description=f"User {instance.username} deleted",
        metadata={"role": instance.role, "lab_id": instance.lab_id},
    )
    instance.delete()


# ---------------------------------------------------------------------------
# Internal validation helpers
# ---------------------------------------------------------------------------


def _validate_update_contract(actor, target, data):
    """Enforce field-level restrictions on update operations."""

    def _requested_bool(value):
        if isinstance(value, str):
            return value.lower() not in ("false", "0", "no", "")
        return bool(value)

    if is_superadmin(actor):
        return
    if is_superadmin(target):
        raise PermissionDenied("Cannot manage superadmin users")

    requested_role = data.get("role")
    if requested_role == "superadmin":
        raise PermissionDenied("Only superadmin can assign superadmin role")
    if target.id == actor.id and requested_role and requested_role != target.role:
        raise PermissionDenied("Cannot change your own role")

    if "lab" in data:
        try:
            requested_lab_id = int(data["lab"])
        except (TypeError, ValueError):
            raise ValidationError({"lab": "Invalid lab"})
        if requested_lab_id != getattr(actor, "lab_id", None):
            raise PermissionDenied("Cannot move users to another lab")

    if "is_active" in data and _requested_bool(data["is_active"]) != target.is_active:
        raise PermissionDenied("Only superadmin can change user active state")
