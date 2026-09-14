"""
Thin service layer for job business logic.

Extracted from JobViewSet so the logic can be tested independently
and reused without going through the HTTP layer.
"""

import re
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.models import AuditLog
from apps.jobs.models import JobTimelineEvent, ProstheticLabelSequence

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
    "diagnosis_code",
    "health_note",
    "received_at",
    "assigned_at",
    "completed_at",
    "seated_at",
    "handover_at",
    "try_in_date",
)

# MKCH-10 (ICD-10) diagnosis code shape, e.g. K08 or K08.9
DIAGNOSIS_CODE_PATTERN = re.compile(r"^[A-Z]\d{2}(\.\d)?$")

# Statuses that mean the job is finished in the lab.
COMPLETED_STATUSES = ("completed", "finished_unfactured", "finished_factured", "closed")

PAYMENT_SPLIT_TOLERANCE = Decimal("0.01")


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


def generate_label_number(lab):
    """
    Return the next prosthetic label number for *lab*.

    Must be called inside a transaction - the sequence row is locked with
    ``select_for_update`` so two concurrent requests cannot get the same number
    (same pattern as ``finance.invoice_service.generate_invoice_number``).
    """
    start = max(1, int(getattr(lab, "label_start_number", 1) or 1))
    seq, created = ProstheticLabelSequence.objects.select_for_update().get_or_create(
        lab=lab,
        defaults={"last_number": start - 1},
    )
    if created:
        next_number = seq.last_number + 1
    else:
        next_number = max(seq.last_number + 1, start)
    seq.last_number = next_number
    seq.save(update_fields=["last_number"])
    prefix = (getattr(lab, "label_prefix", "") or "").strip()
    return f"{prefix}{next_number:06d}"


@transaction.atomic
def issue_label_number(job):
    """
    Assign a prosthetic label number to *job* if it does not have one yet.

    Idempotent: a job that already carries a label number keeps it, so repeated
    label generation never burns a number from the series.
    """
    locked = job.__class__.objects.select_for_update().get(pk=job.pk)
    if locked.label_number:
        job.label_number = locked.label_number
        job.label_issued_at = locked.label_issued_at
        return locked.label_number

    locked.label_number = generate_label_number(locked.lab)
    locked.label_issued_at = timezone.now()
    locked.save(update_fields=["label_number", "label_issued_at", "updated_at"])

    job.label_number = locked.label_number
    job.label_issued_at = locked.label_issued_at
    return locked.label_number


MATERIAL_USAGE_REQUIRED_MESSAGE = (
    "Prácu nie je možné dokončiť bez zaevidovanej spotreby materiálu. "
    "Zaevidujte použité šarže (MDR) v module Materiály."
)


def material_usage_recorded(job):
    """Whether *job* has at least one MDR material usage snapshot."""
    # Local import: apps.materials imports apps.jobs.models.
    from apps.materials.models import MaterialUsage

    return MaterialUsage.objects.filter(job=job).exists()


def material_usage_missing(job):
    """
    Whether *job* still needs a material usage record before it can be finished.

    ``False`` for labs that have not enabled ``Lab.require_material_usage`` — a
    lab that does not use the MDR module must never be blocked (#101).
    """
    lab = job.lab
    if not lab or not getattr(lab, "require_material_usage", False):
        return False
    return not material_usage_recorded(job)


def assert_material_usage_recorded(job, new_status):
    """
    Enforce ``Lab.require_material_usage`` on the transition into a finished state.

    Checked in the service layer, not on the frontend, so the rule also holds for
    bulk updates and API clients.
    """
    if new_status not in COMPLETED_STATUSES:
        return
    if job.status in COMPLETED_STATUSES:
        # Already finished — a later transition must not be blocked retroactively.
        return
    if material_usage_missing(job):
        raise ValidationError(MATERIAL_USAGE_REQUIRED_MESSAGE)


def resolve_payment_split(total, insurance_amount=None, patient_amount=None, price_list_item=None, quantity=1):
    """
    Resolve the insurance/patient split for a job item worth *total*.

    Rules (in order):
    * both amounts given - the invariant ``insurance + patient == total`` is enforced
      with a one-cent tolerance;
    * one amount given - the other is derived as the remainder, so a price change
      without a matching split change cannot silently break the invariant;
    * neither given - the price list defaults (scaled by *quantity*) are used when
      they add up to *total*, otherwise the whole amount falls on the patient.

    Returns a ``(insurance_amount, patient_amount)`` tuple of ``Decimal``.
    Raises ``ValidationError`` (Slovak message) on an inconsistent split.
    """
    total = Decimal(str(total or "0.00"))

    def _dec(value):
        return None if value is None or value == "" else Decimal(str(value))

    insurance = _dec(insurance_amount)
    patient = _dec(patient_amount)

    if insurance is None and patient is None and price_list_item is not None:
        default_insurance = getattr(price_list_item, "default_insurance_amount", None)
        default_patient = getattr(price_list_item, "default_patient_amount", None)
        if default_insurance is not None or default_patient is not None:
            insurance = (default_insurance or Decimal("0.00")) * quantity
            patient = (default_patient or Decimal("0.00")) * quantity
            if abs((insurance + patient) - total) > PAYMENT_SPLIT_TOLERANCE:
                # Defaults do not fit the actual price - keep the invariant, drop the defaults.
                patient = total - insurance

    if insurance is None and patient is None:
        return Decimal("0.00"), total
    if patient is None:
        patient = total - insurance
    elif insurance is None:
        insurance = total - patient

    if insurance < 0 or patient < 0:
        raise ValidationError("Úhrada poisťovňou ani doplatok pacienta nesmú byť záporné.")
    if abs((insurance + patient) - total) > PAYMENT_SPLIT_TOLERANCE:
        raise ValidationError("Úhrada poisťovňou a doplatok pacienta musia dať dokopy cenu položky.")
    return insurance, patient


def sync_completion_date(job, new_status, save=True):
    """
    Keep ``Job.completed_at`` in sync with the job status (#97).

    Fills the date when the job first reaches a finished status; clears it when the
    job goes back to an unfinished one. Returns the list of changed field names.
    """
    changed = []
    if new_status in COMPLETED_STATUSES:
        if job.completed_at is None:
            job.completed_at = timezone.localdate()
            changed.append("completed_at")
    elif job.completed_at is not None:
        job.completed_at = None
        changed.append("completed_at")

    if changed and save:
        job.save(update_fields=[*changed, "updated_at"])
    return changed


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
        assert_material_usage_recorded(old, new_status)

    job = serializer.save()

    if old_status != job.status:
        sync_completion_date(job, job.status)

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

    Raises ``ValidationError`` if the job is closed, has linked invoice items, or
    already carries an issued prosthetic label.

    The label check is a retention rule, not a convenience: the MDR declaration
    issued with the label (Annex XIII, section 1) has to be retained for at least
    10 years, and the label number must never be reassigned (#95, #99).
    """
    if job.status == "closed" or job.invoice_items.exists():
        raise ValidationError("Uzavreté alebo vyfakturované práce nie je možné vymazať")
    if job.label_number:
        raise ValidationError(
            "Prácu s vystaveným protetickým štítkom nie je možné vymazať — "
            "vyhlásenie podľa MDR sa uchováva najmenej 10 rokov."
        )
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
    assert_material_usage_recorded(job, new_status)

    old_status = job.status
    old_completed_at = job.completed_at
    job.status = new_status
    job.save(update_fields=["status", "updated_at"])
    sync_completion_date(job, new_status)

    changed_fields = None
    if old_completed_at != job.completed_at:
        changed_fields = {"completed_at": {"from": str(old_completed_at), "to": str(job.completed_at)}}

    record_job_timeline(
        job,
        actor,
        "status_changed",
        note=note or "Stav práce bol zmenený.",
        from_status=old_status,
        to_status=new_status,
        changed_fields=changed_fields,
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
