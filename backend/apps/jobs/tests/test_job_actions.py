from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import AuditLog, Lab, User
from apps.crm.models import Clinic, Patient
from apps.jobs.models import Job, Technician


class JobStatusChangeAuditLogTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Audit Job Lab")
        self.clinic = Clinic.objects.create(name="AuditClinic", lab=self.lab)
        self.patient = Patient.objects.create(
            first_name="Audit",
            last_name="Patient",
            birth_number="800101/1111",
            lab=self.lab,
        )
        self.user = User.objects.create_user(
            username="auditjob_user",
            password="pw",
            email="auditjob@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.regular = User.objects.create_user(
            username="auditjob_regular",
            password="pw",
            email="auditjob_regular@test.sk",
            role="user",
            lab=self.lab,
        )
        self.job = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            patient=self.patient,
            description="Audit job",
            status="new",
        )

    def test_status_change_writes_audit_log(self):
        self.client.force_authenticate(user=self.user)
        before = AuditLog.objects.filter(action="job.status_changed").count()
        resp = self.client.post(
            f"/api/jobs/jobs/{self.job.id}/transition-status/",
            {"status": "in_progress"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(
            AuditLog.objects.filter(action="job.status_changed").count(),
            before + 1,
        )
        log = AuditLog.objects.filter(action="job.status_changed").latest("created_at")
        self.assertEqual(log.entity_id, str(self.job.id))
        self.assertEqual(log.metadata["from_status"], "new")
        self.assertEqual(log.metadata["to_status"], "in_progress")

    def test_regular_user_cannot_transition_status(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.post(
            f"/api/jobs/jobs/{self.job.id}/transition-status/",
            {"status": "in_progress"},
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "new")


class JobBulkUpdateTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Bulk Lab")
        self.clinic = Clinic.objects.create(name="Bulk Clinic", lab=self.lab)
        self.user = User.objects.create_user(
            username="bulk_user",
            password="pw",
            email="bulk@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.regular = User.objects.create_user(
            username="bulk_regular",
            password="pw",
            email="bulk_regular@test.sk",
            role="user",
            lab=self.lab,
        )
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Bulk",
            last_name="Patient",
        )
        self.job1 = Job.objects.create(lab=self.lab, clinic=self.clinic, patient=self.patient, status="new")
        self.job2 = Job.objects.create(lab=self.lab, clinic=self.clinic, patient=self.patient, status="new")
        self.job3 = Job.objects.create(lab=self.lab, clinic=self.clinic, patient=self.patient, status="completed")

    def test_bulk_status_update_valid_transition(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/jobs/jobs/bulk-update/",
            {"job_ids": [self.job1.id, self.job2.id], "status": "in_progress"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["updated_count"], 2)
        self.job1.refresh_from_db()
        self.assertEqual(self.job1.status, "in_progress")

    def test_bulk_status_update_writes_audit_log(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/jobs/jobs/bulk-update/",
            {"job_ids": [self.job1.id, self.job2.id], "status": "in_progress"},
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        logs = AuditLog.objects.filter(
            action="job.status_changed",
            entity_id__in=[str(self.job1.id), str(self.job2.id)],
        )
        self.assertEqual(logs.count(), 2)
        for log in logs:
            self.assertEqual(log.actor, self.user)
            self.assertEqual(log.lab, self.lab)
            self.assertEqual(log.metadata["from_status"], "new")
            self.assertEqual(log.metadata["to_status"], "in_progress")

    def test_bulk_update_invalid_transition_skipped(self):
        self.client.force_authenticate(user=self.user)
        # job3 is completed, new→completed is invalid from new
        resp = self.client.post(
            "/api/jobs/jobs/bulk-update/",
            {"job_ids": [self.job1.id, self.job3.id], "status": "in_progress"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["updated_count"], 1)
        self.assertEqual(len(resp.data["skipped"]), 1)

    def test_bulk_priority_update(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/jobs/jobs/bulk-update/",
            {"job_ids": [self.job1.id], "priority": "high"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.job1.refresh_from_db()
        self.assertEqual(self.job1.priority, "high")

    def test_bulk_priority_update_writes_audit_log(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/jobs/jobs/bulk-update/",
            {"job_ids": [self.job1.id], "priority": "high"},
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        log = AuditLog.objects.filter(action="job.bulk_priority_changed").latest("created_at")
        self.assertEqual(log.entity_id, str(self.job1.id))
        self.assertEqual(log.actor, self.user)
        self.assertEqual(log.lab, self.lab)
        self.assertEqual(log.metadata["priority"], "high")

    def test_empty_job_ids_returns_400(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/jobs/jobs/bulk-update/",
            {"job_ids": [], "status": "in_progress"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_unauthenticated_denied(self):
        resp = self.client.post(
            "/api/jobs/jobs/bulk-update/",
            {"job_ids": [self.job1.id], "status": "in_progress"},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_regular_user_cannot_bulk_update(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.post(
            "/api/jobs/jobs/bulk-update/",
            {"job_ids": [self.job1.id], "priority": "high"},
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.job1.refresh_from_db()
        self.assertEqual(self.job1.priority, "normal")


class JobStatusNotificationTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Notif Lab")
        self.admin = User.objects.create_user(
            username="notif_admin",
            password="pw",
            email="admin@notif.sk",
            role="admin",
            lab=self.lab,
        )
        self.patient = Patient.objects.create(first_name="Jana", last_name="Nová", lab=self.lab)
        self.clinic = Clinic.objects.create(name="Klinika Test", lab=self.lab)
        self.job = Job.objects.create(
            patient=self.patient,
            clinic=self.clinic,
            lab=self.lab,
            status="new",
        )

    def test_transition_status_creates_notification_for_admin(self):
        from apps.core.models import Notification

        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            f"/api/jobs/jobs/{self.job.id}/transition-status/",
            {"status": "in_progress"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        notif = Notification.objects.filter(lab=self.lab, type="job", recipient=self.admin).first()
        self.assertIsNotNone(notif)
        self.assertIn("V riešení", notif.title)
        self.assertEqual(notif.url, f"/jobs/{self.job.id}")

    def test_transition_no_notification_for_same_status(self):
        from apps.core.models import Notification

        self.client.force_authenticate(user=self.admin)
        self.client.post(
            f"/api/jobs/jobs/{self.job.id}/transition-status/",
            {"status": "new"},
            format="json",
        )
        self.assertEqual(Notification.objects.filter(lab=self.lab, type="job").count(), 0)


class JobDateRangeFilterTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Filter Lab")
        self.clinic = Clinic.objects.create(name="Filter Clinic", lab=self.lab)
        self.user = User.objects.create_user(
            username="filter_user",
            password="pw",
            email="filter@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Filter",
            last_name="Patient",
        )
        today = timezone.localdate()
        self.job_past = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            patient=self.patient,
            status="new",
            due_date=today - timezone.timedelta(days=10),
        )
        self.job_today = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            patient=self.patient,
            status="new",
            due_date=today,
        )
        self.job_future = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            patient=self.patient,
            status="new",
            due_date=today + timezone.timedelta(days=10),
        )

    def test_from_date_filters_out_past(self):
        today = timezone.localdate().isoformat()
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/jobs/jobs/?from_date={today}")
        self.assertEqual(resp.status_code, 200)
        ids = [j["id"] for j in resp.data]
        self.assertIn(self.job_today.id, ids)
        self.assertIn(self.job_future.id, ids)
        self.assertNotIn(self.job_past.id, ids)

    def test_to_date_filters_out_future(self):
        today = timezone.localdate().isoformat()
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/jobs/jobs/?to_date={today}")
        self.assertEqual(resp.status_code, 200)
        ids = [j["id"] for j in resp.data]
        self.assertIn(self.job_today.id, ids)
        self.assertIn(self.job_past.id, ids)
        self.assertNotIn(self.job_future.id, ids)

    def test_technician_id_filter(self):
        tech = Technician.objects.create(lab=self.lab, first_name="T", last_name="T")
        self.job_today.technician = tech
        self.job_today.save(update_fields=["technician"])
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/jobs/jobs/?technician_id={tech.id}")
        self.assertEqual(resp.status_code, 200)
        ids = [j["id"] for j in resp.data]
        self.assertIn(self.job_today.id, ids)
        self.assertNotIn(self.job_past.id, ids)
