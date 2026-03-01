from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.jobs.models import Job, Technician


class PatientCumulativeToothMapApiTests(APITestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Lab A")
        self.lab_b = Lab.objects.create(name="Lab B")

        self.admin_a = User.objects.create_user(
            username="admin_a",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )

        self.clinic_a = Clinic.objects.create(lab=self.lab_a, name="Clinic A")
        self.doctor_a = Doctor.objects.create(
            lab=self.lab_a, clinic=self.clinic_a, first_name="John", last_name="Doe"
        )
        self.tech_a = Technician.objects.create(
            lab=self.lab_a, first_name="Tech", last_name="One"
        )
        self.patient_a = Patient.objects.create(
            lab=self.lab_a,
            first_name="Alice",
            last_name="Patient",
            birth_number="123456/7890",
        )

        self.clinic_b = Clinic.objects.create(lab=self.lab_b, name="Clinic B")
        self.doctor_b = Doctor.objects.create(
            lab=self.lab_b, clinic=self.clinic_b, first_name="Jane", last_name="Doe"
        )
        self.tech_b = Technician.objects.create(
            lab=self.lab_b, first_name="Tech", last_name="Two"
        )
        self.patient_b = Patient.objects.create(
            lab=self.lab_b,
            first_name="Bob",
            last_name="Patient",
            birth_number="223456/7890",
        )

    def _endpoint(self, patient_id):
        return f"/api/crm/patients/{patient_id}/cumulative_tooth_map/"

    def test_cumulative_tooth_map_merges_completed_jobs_with_newer_overrides(self):
        Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.tech_a,
            status="completed",
            output_tooth_procedures={"11": "crown", "12": "veneer"},
            created_at=timezone.now() - timezone.timedelta(days=2),
        )
        Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.tech_a,
            status="completed",
            output_tooth_procedures={"11": "bridge", "13": "implant"},
            created_at=timezone.now() - timezone.timedelta(days=1),
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(self._endpoint(self.patient_a.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data, {"11": "bridge", "12": "veneer", "13": "implant"}
        )

    def test_cumulative_tooth_map_ignores_non_completed_jobs(self):
        Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.tech_a,
            status="new",
            output_tooth_procedures={"21": "temporary"},
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(self._endpoint(self.patient_a.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {})

    def test_cumulative_tooth_map_respects_lab_scoping(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(self._endpoint(self.patient_b.id))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
