"""
Unit tests for apps.jobs.job_service — business logic only, no HTTP layer.
"""

from unittest.mock import MagicMock

from django.test import TestCase
from rest_framework.exceptions import ValidationError

from apps.core.models import AuditLog, Lab, User
from apps.crm.models import Clinic, Patient
from apps.jobs import job_service
from apps.jobs.models import Job, JobTimelineEvent, Technician


class JobServiceSetupMixin:
    """Common test fixtures for job service tests."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Job Service Lab")
        self.admin = User.objects.create_user(
            username="js_admin",
            email="js_admin@test.sk",
            password="pw",
            role="admin",
            lab=self.lab,
        )
        self.regular = User.objects.create_user(
            username="js_user",
            email="js_user@test.sk",
            password="pw",
            role="user",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Test Clinic")
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Test",
            last_name="Patient",
            birth_number="900101/5678",
        )
        self.tech = Technician.objects.create(
            lab=self.lab,
            first_name="Tech",
            last_name="One",
        )
        self.job = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            status="new",
            description="Test job",
        )


class CreateJobTests(JobServiceSetupMixin, TestCase):
    def _mock_serializer(self):
        mock = MagicMock()
        job = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            status="new",
            description="Created via service",
        )
        mock.save.return_value = job
        return mock, job

    def test_saves_job_with_given_lab(self):
        mock, job = self._mock_serializer()
        job_service.create_job(self.admin, mock, self.lab)
        mock.save.assert_called_once_with(lab=self.lab)

    def test_creates_timeline_event_on_creation(self):
        mock, job = self._mock_serializer()
        job_service.create_job(self.admin, mock, self.lab)
        self.assertTrue(JobTimelineEvent.objects.filter(job=job, event="created").exists())


class UpdateJobTests(JobServiceSetupMixin, TestCase):
    def _mock_serializer_for(self, job, new_status=None, new_description=None):
        mock = MagicMock()
        mock.instance = job
        new_desc = new_description or job.description
        new_st = new_status or job.status
        mock.validated_data = {"status": new_st, "description": new_desc}

        def _save(**kwargs):
            job.status = new_st
            job.description = new_desc
            job.save(update_fields=["status", "description"])
            return job

        mock.save.side_effect = _save
        return mock

    def test_raises_on_invalid_transition(self):
        self.job.status = "new"
        self.job.save()
        mock = self._mock_serializer_for(self.job, new_status="completed")
        with self.assertRaises(ValidationError):
            job_service.update_job(self.admin, mock)

    def test_records_status_changed_timeline_on_valid_transition(self):
        self.job.status = "new"
        self.job.save()
        mock = self._mock_serializer_for(self.job, new_status="in_progress")
        job_service.update_job(self.admin, mock)
        self.assertTrue(JobTimelineEvent.objects.filter(job=self.job, event="status_changed").exists())

    def test_records_updated_timeline_on_non_status_change(self):
        mock = self._mock_serializer_for(self.job, new_description="New desc")
        job_service.update_job(self.admin, mock)
        self.assertTrue(JobTimelineEvent.objects.filter(job=self.job, event="updated").exists())


class DeleteJobTests(JobServiceSetupMixin, TestCase):
    def test_deletes_job(self):
        job_id = self.job.id
        job_service.delete_job(self.job)
        self.assertFalse(Job.objects.filter(id=job_id).exists())

    def test_raises_for_closed_job(self):
        self.job.status = "closed"
        self.job.save()
        with self.assertRaises(ValidationError):
            job_service.delete_job(self.job)


class TransitionJobStatusTests(JobServiceSetupMixin, TestCase):
    def test_transitions_to_valid_status(self):
        self.job.status = "new"
        self.job.save()
        job_service.transition_job_status(self.admin, self.job, "in_progress")
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "in_progress")

    def test_raises_for_invalid_transition(self):
        self.job.status = "new"
        self.job.save()
        with self.assertRaises(ValidationError):
            job_service.transition_job_status(self.admin, self.job, "completed")

    def test_writes_audit_log_on_transition(self):
        self.job.status = "new"
        self.job.save()
        before = AuditLog.objects.count()
        job_service.transition_job_status(self.admin, self.job, "in_progress")
        self.assertEqual(AuditLog.objects.count(), before + 1)
        log = AuditLog.objects.latest("id")
        self.assertEqual(log.action, "job.status_changed")
        self.assertEqual(log.metadata["from_status"], "new")
        self.assertEqual(log.metadata["to_status"], "in_progress")

    def test_noop_when_already_at_target_status(self):
        self.job.status = "new"
        self.job.save()
        before_events = JobTimelineEvent.objects.count()
        job_service.transition_job_status(self.admin, self.job, "new")
        self.assertEqual(JobTimelineEvent.objects.count(), before_events)

    def test_creates_timeline_event_on_transition(self):
        self.job.status = "new"
        self.job.save()
        job_service.transition_job_status(self.admin, self.job, "in_progress")
        self.assertTrue(
            JobTimelineEvent.objects.filter(
                job=self.job, event="status_changed", from_status="new", to_status="in_progress"
            ).exists()
        )


class RecordJobTimelineTests(JobServiceSetupMixin, TestCase):
    def test_creates_timeline_event(self):
        job_service.record_job_timeline(self.job, self.admin, "created", note="Test note")
        event = JobTimelineEvent.objects.get(job=self.job, event="created")
        self.assertEqual(event.note, "Test note")
        self.assertEqual(event.actor, self.admin)

    def test_writes_audit_log_for_status_changed(self):
        before = AuditLog.objects.count()
        job_service.record_job_timeline(
            self.job, self.admin, "status_changed", from_status="new", to_status="in_progress"
        )
        self.assertEqual(AuditLog.objects.count(), before + 1)

    def test_no_audit_log_for_non_status_event(self):
        before = AuditLog.objects.count()
        job_service.record_job_timeline(self.job, self.admin, "updated", note="General update")
        self.assertEqual(AuditLog.objects.count(), before)
