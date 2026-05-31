"""
Thin service layer for job business logic.

Extracted from JobViewSet so the logic can be tested independently
and reused without going through the HTTP layer.
"""

from rest_framework.exceptions import ValidationError

from apps.core.models import AuditLog
from apps.jobs.models import JobTimelineEvent

ALLOWED_TRANSITIONS = {
    "new": {"in_progress", "cancelled"},
    "in_progress": {"completed", "cancelled"},
    "completed": {"finished_unfactured", "finished_factured", "closed"},
    "finished_unfactured": {"finished_factured", "closed"},
    "finished_factured": {"closed"},
    "cancelled": set(),
    "closed": set(),
}

STATUS_LABELS = {
    "new": "Nová",
    "in_progress": "V riešení",
    "completed": "Dokončená",
    "cancelled": "Zrušená",
    "finished_factured": "Dokončená/Fakturovaná",
    "finished_unfactured": "Dokončená/Nefakturovaná",
    "closed": "Uzavretá",
}

# Fields whose before/after values are tracked in the timeline.
TRACKED_FIELDS = (
    "due_date",
    "priority",
    "description",
    "price",
    "technician_id",
    "tooth_color",
)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _notify_lab_admins(lab, notification_type, title, message, url=None):
    from apps.core.models import Notification, User

    if not lab:
        return
    for admin in User.objects.filter(lab=lab, role__in=("admin", "superadmin"), is_active=True):
        Notification.objects.create(
            lab=lab,
            recipient=admin,
            type=notification_type,
            title=title,
            message=message,
            url=url,
        )


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


def record_job_timeline(
    job,
    actor,
    event_type,
    note=None,
    from_status=None,
    to_status=None,
    changed_fields=None,
):
    """
    Create a ``JobTimelineEvent`` for *job*.

    For ``status_changed`` events also writes a ``job.status_changed`` audit log entry.
    """
    JobTimelineEvent.objects.create(
        job=job,
        actor=actor,
        event=event_type,
        note=note,
        from_status=from_status,
        to_status=to_status,
        changed_fields=changed_fields,
    )
    if event_type == "status_changed" and (from_status or to_status):
        AuditLog.objects.create(
            actor=actor,
            lab=job.lab,
            action="job.status_changed",
            entity_type="job",
            entity_id=str(job.id),
            description=f"Job #{job.id} status: {from_status} → {to_status}",
            metadata={"from_status": from_status, "to_status": to_status},
        )


def create_job(actor, serializer, lab):
    """
    Save *serializer* with *lab*, record a creation timeline event, and return the job.

    The caller (ViewSet) is responsible for resolving the correct lab for the actor.
    """
    job = serializer.save(lab=lab)
    record_job_timeline(job, actor, "created", note="Práca bola vytvorená.")
    return job


def update_job(actor, serializer):
    """
    Validate any status transition, save the job via *serializer*, record a timeline
    event for the change type (status/technician/general update), and return the job.

    Raises ``ValidationError`` on invalid status transitions.
    """
    old = serializer.instance
    old_status = old.status
    old_technician_id = old.technician_id
    old_snapshot = {f: getattr(old, f) for f in TRACKED_FIELDS}

    new_status = serializer.validated_data.get("status", old_status)
    if new_status != old_status:
        allowed = ALLOWED_TRANSITIONS.get(old_status, set())
        if new_status not in allowed:
            raise ValidationError(f"Invalid status transition from {old_status} to {new_status}")

    job = serializer.save()

    changed = {
        f: {"from": str(old_snapshot[f]), "to": str(getattr(job, f))}
        for f in TRACKED_FIELDS
        if old_snapshot[f] != getattr(job, f)
    }

    if old_status != job.status:
        record_job_timeline(
            job,
            actor,
            "status_changed",
            note="Stav práce bol zmenený.",
            from_status=old_status,
            to_status=job.status,
            changed_fields=changed or None,
        )
    elif old_technician_id != job.technician_id:
        record_job_timeline(
            job,
            actor,
            "assigned",
            note="Technik bol zmenený.",
            changed_fields=changed or None,
        )
    else:
        record_job_timeline(
            job,
            actor,
            "updated",
            note="Práca bola upravená.",
            changed_fields=changed or None,
        )
    return job


def delete_job(job):
    """
    Validate that *job* can be deleted and delete it.

    Raises ``ValidationError`` if the job is closed or has linked invoice items.
    """
    if job.status == "closed" or job.invoice_items.exists():
        raise ValidationError("Closed or invoiced jobs cannot be deleted")
    job.delete()


def transition_job_status(actor, job, new_status, note=None):
    """
    Transition *job* to *new_status*, record timeline/audit, notify lab admins.

    Returns the updated job (no-op if already at *new_status*).
    Raises ``ValidationError`` if the transition is not allowed.
    """
    if new_status == job.status:
        return job

    allowed = ALLOWED_TRANSITIONS.get(job.status, set())
    if new_status not in allowed:
        raise ValidationError(f"Invalid status transition from {job.status} to {new_status}")

    old_status = job.status
    job.status = new_status
    job.save(update_fields=["status", "updated_at"])

    record_job_timeline(
        job,
        actor,
        "status_changed",
        note=note or "Stav práce bol zmenený.",
        from_status=old_status,
        to_status=new_status,
    )

    patient = job.patient
    patient_name = f"{patient.first_name} {patient.last_name}".strip() if patient else f"#{job.id}"
    _notify_lab_admins(
        lab=job.lab,
        notification_type="job",
        title=f"Stav práce #{job.id} zmenený na {STATUS_LABELS.get(new_status, new_status)}",
        message=(
            f"Pacient: {patient_name}. "
            f"Zmena: {STATUS_LABELS.get(old_status, old_status)}"
            f" → {STATUS_LABELS.get(new_status, new_status)}"
        ),
        url=f"/jobs/{job.id}",
    )

    return job
