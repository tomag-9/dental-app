"""
Cross-cutting service utilities shared across Django apps.
"""

from .models import AuditLog


def write_audit_log(
    *, actor, lab, action, entity_type, entity_id, description=None, metadata=None
):
    """
    Create an AuditLog entry.

    ``actor`` is the acting User (may be None for system actions).
    ``entity_id`` is coerced to str.
    """
    AuditLog.objects.create(
        actor=actor,
        lab=lab,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id is not None else "",
        description=description or f"{entity_type} {entity_id}: {action}",
        metadata=metadata or {},
    )
