"""Regression test for the job-list N+1 explosion found in a real-data load test.

With 3000 jobs, GET /api/jobs/jobs/ took ~72-160s and issued 9000+ queries
(capped by Django's query-log limit — the real count was higher). Root cause:
JobSerializer embedded the full CRM detail serializers (ClinicSerializer,
DoctorSerializer, TechnicianSerializer, PatientSerializer) as
patient_details/clinic_details/doctor_details/technician_details. Those
serializers carry SerializerMethodFields meant for their own list/detail
pages (jobs_count, active_jobs, ytd_revenue, jobs_this_month, doctor_count,
insurer_details, ...) — each running its own COUNT/SUM query with no
annotation or caching. Nested once per job, per related entity, the query
count scales with (jobs × related entities × aggregate fields) instead of
staying flat.

This test asserts the query count for the job list endpoint is flat (does
not grow with the number of jobs), which only holds once the nested
*_details use lightweight, field-only serializers instead of the CRM
detail serializers.
"""

from django.test.utils import CaptureQueriesContext
from django.db import connection
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.jobs.models import Job, Technician


class JobListQueryCountTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Perf Lab")
        self.admin = User.objects.create_user(
            username="perf_admin",
            password="pw",
            email="perf_admin@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Perf Clinic")
        self.doctor = Doctor.objects.create(lab=self.lab, clinic=self.clinic, first_name="D", last_name="R")
        self.technician = Technician.objects.create(lab=self.lab, first_name="T", last_name="Tech")

    def _make_jobs(self, n):
        base = Patient.objects.filter(lab=self.lab).count()
        for i in range(n):
            idx = base + i
            patient = Patient.objects.create(
                lab=self.lab,
                first_name=f"P{idx}",
                last_name="Test",
                birth_number=f"{900100 + idx:06d}/{idx:04d}",
            )
            Job.objects.create(
                lab=self.lab,
                patient=patient,
                clinic=self.clinic,
                doctor=self.doctor,
                technician=self.technician,
                status="new",
            )

    def test_job_list_query_count_does_not_grow_with_job_count(self):
        self.client.force_authenticate(user=self.admin)

        self._make_jobs(3)
        with CaptureQueriesContext(connection) as ctx_small:
            resp = self.client.get("/api/jobs/jobs/")
        self.assertEqual(resp.status_code, 200)
        small_count = len(ctx_small.captured_queries)

        self._make_jobs(15)  # 18 jobs total
        with CaptureQueriesContext(connection) as ctx_large:
            resp = self.client.get("/api/jobs/jobs/")
        self.assertEqual(resp.status_code, 200)
        large_count = len(ctx_large.captured_queries)

        # A flat (select_related/prefetch_related-backed) implementation issues
        # the same handful of queries regardless of row count. Allow a small
        # constant-factor margin (e.g. pagination internals) but never
        # per-row growth.
        self.assertLess(
            large_count,
            small_count + 5,
            f"query count grew with job count ({small_count} -> {large_count} for "
            f"3 -> 18 jobs) — a nested serializer is issuing a per-row query",
        )

    def test_job_list_nested_details_still_expose_the_fields_the_frontend_reads(self):
        self.client.force_authenticate(user=self.admin)
        self._make_jobs(1)
        resp = self.client.get("/api/jobs/jobs/")
        self.assertEqual(resp.status_code, 200)
        job = resp.data[0] if isinstance(resp.data, list) else resp.data["results"][0]
        self.assertIn("first_name", job["patient_details"])
        self.assertIn("last_name", job["patient_details"])
        self.assertIn("birth_number", job["patient_details"])
        self.assertIn("phone", job["patient_details"])
        self.assertIn("name", job["clinic_details"])
        self.assertIn("first_name", job["doctor_details"])
        self.assertIn("last_name", job["doctor_details"])
        self.assertIn("first_name", job["technician_details"])
        self.assertIn("last_name", job["technician_details"])
