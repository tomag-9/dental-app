"""
Public service API for the jobs domain.

This module is the canonical entry point for cross-domain callers (e.g. finance).
All job state mutations should go through these functions rather than touching
Job.objects directly from outside this app.
"""

from apps.jobs import job_service
from apps.jobs.models import Job

# Re-export so callers that previously used job_service can migrate incrementally.
# The signature uses keyword-only ``user`` to match the rest of the service layer.

INVOICE_STATUS_TO_JOB_STATUS = {
    "draft": "finished_unfactured",
    "paid": "closed",
    "issued": "finished_factured",
    "cancelled": "finished_unfactured",
}


def transition_job_status(*, user, job, new_status, note=None):
    """
    Transition *job* to *new_status* on behalf of *user*.

    Delegates to ``job_service.transition_job_status`` which handles
    validation, timeline recording, audit logging, and lab-admin notifications.

    Returns the updated job.
    Raises ``ValidationError`` if the transition is not allowed.
    """
    return job_service.transition_job_status(user, job, new_status, note)


def mark_jobs_invoiced(job_ids, *, invoice_status):
    """
    Bulk-update the status of jobs in *job_ids* to reflect *invoice_status*.

    Mapping:
        ``draft``     → ``finished_unfactured``
        ``issued``    → ``finished_factured``
        ``paid``      → ``closed``
        ``cancelled`` → ``finished_unfactured``

    Unknown invoice statuses are silently ignored (no jobs updated).
    """
    new_job_status = INVOICE_STATUS_TO_JOB_STATUS.get(invoice_status)
    if new_job_status is None:
        return
    Job.objects.filter(id__in=job_ids).update(status=new_job_status)


def mark_jobs_invoice_cancelled(job_ids):
    """
    Reset the status of jobs in *job_ids* to ``finished_unfactured``.

    Called when an invoice that covered these jobs is deleted/cancelled so
    the jobs are no longer considered invoiced.
    """
    Job.objects.filter(id__in=job_ids).update(status="finished_unfactured")
