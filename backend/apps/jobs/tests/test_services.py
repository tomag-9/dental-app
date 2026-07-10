"""
Unit tests for apps.jobs.services — the public cross-domain service API.
"""

from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Patient
from apps.jobs import services as job_services
from apps.jobs.models import Job


class JobServicesSetupMixin:
    def setUp(self):
        self.lab = Lab.objects.create(name="Services Test Lab")
        self.user = User.objects.create_user(
            username="svc_user",
            email="svc_user@test.sk",
            password="pw",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Clinic")
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Jan",
            last_name="Novak",
            birth_number="900101/1234",
        )
        self.job = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            status="new",
        )


class TransitionJobStatusTests(JobServicesSetupMixin, TestCase):
    def test_transitions_valid_status_via_keyword_args(self):
        job = job_services.transition_job_status(user=self.user, job=self.job, new_status="in_progress")
        self.assertEqual(job.status, "in_progress")

    def test_raises_for_invalid_transition(self):
        with self.assertRaises(ValidationError):
            job_services.transition_job_status(user=self.user, job=self.job, new_status="completed")

    def test_noop_when_already_at_target(self):
        job = job_services.transition_job_status(user=self.user, job=self.job, new_status="new")
        self.assertEqual(job.status, "new")

    def test_note_is_forwarded(self):
        from apps.jobs.models import JobTimelineEvent

        job_services.transition_job_status(user=self.user, job=self.job, new_status="in_progress", note="Custom note")
        event = JobTimelineEvent.objects.filter(job=self.job, event="status_changed").first()
        self.assertIsNotNone(event)
        self.assertEqual(event.note, "Custom note")


class MarkJobsInvoicedTests(JobServicesSetupMixin, TestCase):
    def _make_job(self, status="completed"):
        return Job.objects.create(lab=self.lab, patient=self.patient, clinic=self.clinic, status=status)

    def test_paid_closes_jobs(self):
        j1, j2 = self._make_job(), self._make_job()
        job_services.mark_jobs_invoiced([j1.id, j2.id], invoice_status="paid")
        j1.refresh_from_db()
        j2.refresh_from_db()
        self.assertEqual(j1.status, "closed")
        self.assertEqual(j2.status, "closed")

    def test_issued_marks_factured(self):
        j = self._make_job()
        job_services.mark_jobs_invoiced([j.id], invoice_status="issued")
        j.refresh_from_db()
        self.assertEqual(j.status, "finished_factured")

    def test_cancelled_marks_unfactured(self):
        j = self._make_job()
        job_services.mark_jobs_invoiced([j.id], invoice_status="cancelled")
        j.refresh_from_db()
        self.assertEqual(j.status, "finished_unfactured")

    def test_draft_marks_unfactured(self):
        j = self._make_job()
        job_services.mark_jobs_invoiced([j.id], invoice_status="draft")
        j.refresh_from_db()
        self.assertEqual(j.status, "finished_unfactured")

    def test_empty_job_ids_is_noop(self):
        job_services.mark_jobs_invoiced([], invoice_status="paid")


class MarkJobsInvoiceCancelledTests(JobServicesSetupMixin, TestCase):
    def test_resets_jobs_to_unfactured(self):
        j = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            status="finished_factured",
        )
        job_services.mark_jobs_invoice_cancelled([j.id])
        j.refresh_from_db()
        self.assertEqual(j.status, "finished_unfactured")

    def test_empty_list_is_noop(self):
        job_services.mark_jobs_invoice_cancelled([])
