"""
Public service layer for finance business logic.

This module defines the canonical interface for invoice operations.
ViewSets validate HTTP input and delegate here; this layer owns
all business rules (tenant checks, job validation, atomicity, audit).
"""

from decimal import Decimal

from django.db import transaction
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.core.access import is_superadmin
from apps.crm.models import Clinic
from apps.jobs.models import Job

from . import invoice_service

# ---------------------------------------------------------------------------
# Invoice number
# ---------------------------------------------------------------------------


def next_invoice_number(lab):
    """Return the next sequential invoice number for *lab* (must be called inside a transaction)."""
    return invoice_service.generate_invoice_number(lab)


# ---------------------------------------------------------------------------
# Invoice creation
# ---------------------------------------------------------------------------


@transaction.atomic
def create_invoice_from_jobs(
    *,
    user,
    clinic_id,
    job_ids,
    document_type="invoice",
    discount_percent=Decimal("0"),
    description_mode="structured",
    custom_description="",
    show_patient_list=True,
):
    """
    Validate access, look up clinic and jobs, and create an invoice.

    Raises ``NotFound`` if clinic is missing.
    Raises ``PermissionDenied`` if *user* does not own the clinic's lab.
    Raises ``ValidationError`` if jobs are missing or inconsistent with the clinic.

    Returns the created ``Invoice`` instance.
    """
    clinic = Clinic.objects.select_related("lab").filter(id=clinic_id).first()
    if not clinic:
        raise NotFound("Clinic not found")

    if not is_superadmin(user) and clinic.lab_id != getattr(user, "lab_id", None):
        raise PermissionDenied("Forbidden")

    jobs = list(Job.objects.filter(id__in=job_ids).select_related("lab"))
    if len(jobs) != len(set(job_ids)):
        raise ValidationError({"detail": "One or more jobs not found"})

    if any(job.lab_id != clinic.lab_id for job in jobs):
        raise ValidationError({"detail": "All jobs must belong to the same clinic lab"})

    if any(job.clinic_id != clinic.id for job in jobs):
        raise ValidationError({"detail": "All jobs must belong to the selected clinic"})

    return invoice_service.create_invoice(
        actor=user,
        clinic=clinic,
        jobs=jobs,
        document_type=document_type,
        discount_percent=discount_percent,
        description_mode=description_mode,
        custom_description=custom_description,
        show_patient_list=show_patient_list,
    )


# ---------------------------------------------------------------------------
# Invoice status
# ---------------------------------------------------------------------------


@transaction.atomic
def update_invoice_status(*, user, invoice, status):
    """
    Update *invoice* to *status*, sync linked job statuses, and write audit log.

    Returns the updated ``Invoice`` instance.
    """
    return invoice_service.update_invoice_status(user, invoice, status)
