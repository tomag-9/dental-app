"""Helpers shared by several modules in this package.

Kept separate from ``apps.core.services`` because that module already hosts
an unrelated ``write_audit_log`` helper with a different signature (keyword
args, no request/IP handling) — merging the two would change behaviour, which
this refactor (issue #120) is explicitly not allowed to do.
"""

from datetime import timedelta

from ..models import AuditLog

#: Impersonation tokens are deliberately much shorter-lived than a normal
#: login (issue #111) — accessing another lab's data must be time-boxed.
IMPERSONATION_TOKEN_LIFETIME = timedelta(minutes=30)


def _client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _write_audit_log(
    request,
    *,
    action,
    entity_type="",
    entity_id="",
    lab=None,
    description="",
    metadata=None,
):
    return AuditLog.objects.create(
        actor=request.user if getattr(request, "user", None).is_authenticated else None,
        lab=lab,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else "",
        description=description,
        metadata=metadata or {},
        ip_address=_client_ip(request),
    )
