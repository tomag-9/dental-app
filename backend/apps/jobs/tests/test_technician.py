from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Patient
from apps.jobs.models import Job, Technician


class TechnicianApiTests(APITestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Tech Lab A")
        self.lab_b = Lab.objects.create(name="Tech Lab B")

        self.admin_a = User.objects.create_user(
            username="tech_admin_a",
            email="tech_admin_a@example.com",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )
        self.admin_b = User.objects.create_user(
            username="tech_admin_b",
            email="tech_admin_b@example.com",
            password="password123",
            role="admin",
            lab=self.lab_b,
        )
        self.regular_a = User.objects.create_user(
            username="tech_regular_a",
            email="tech_regular_a@example.com",
            password="password123",
            role="user",
            lab=self.lab_a,
        )
        self.superadmin = User.objects.create_user(
            username="tech_superadmin",
            email="tech_superadmin@example.com",
            password="password123",
            role="superadmin",
            is_superuser=True,
        )

        self.tech_a = Technician.objects.create(
            lab=self.lab_a,
            first_name="Lukas",
            last_name="A",
        )
        self.tech_b = Technician.objects.create(
            lab=self.lab_b,
            first_name="Marek",
            last_name="B",
        )

    def test_create_technician_assigns_users_lab_even_without_lab_in_payload(self):
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("technician-list")

        payload = {
            "first_name": "Jozef",
            "last_name": "Novak",
            "title_before": "Ing.",
            "contact_info": {"email": "jozef@example.com"},
        }
        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["lab"], self.lab_a.id)

    def test_create_technician_ignores_client_supplied_lab(self):
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("technician-list")

        payload = {
            "first_name": "Peter",
            "last_name": "Scope",
            "lab": self.lab_b.id,
        }
        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["lab"], self.lab_a.id)

    def test_update_technician_works_without_sending_lab(self):
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("technician-detail", args=[self.tech_a.id])

        payload = {
            "first_name": "Lukas-updated",
            "last_name": "A",
            "title_after": "PhD.",
        }
        response = self.client.put(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "Lukas-updated")
        self.assertEqual(response.data["lab"], self.lab_a.id)

    def test_list_technicians_is_scoped_to_users_lab(self):
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("technician-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.tech_a.id)
        self.assertEqual(response.data[0]["jobs_count"], 0)
        self.assertEqual(response.data[0]["active_jobs"], 0)
        self.assertEqual(response.data[0]["jobs_this_month"], 0)

    def test_technician_aggregates_workload(self):
        patient = Patient.objects.create(
            lab=self.lab_a,
            first_name="Tech",
            last_name="Patient",
            birth_number="960101/1111",
        )
        clinic = Clinic.objects.create(lab=self.lab_a, name="Tech Clinic")
        Job.objects.create(
            lab=self.lab_a,
            patient=patient,
            clinic=clinic,
            technician=self.tech_a,
            status="in_progress",
            description="Active technician job",
        )
        Job.objects.create(
            lab=self.lab_a,
            patient=patient,
            clinic=clinic,
            technician=self.tech_a,
            status="completed",
            description="Completed technician job",
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(reverse("technician-detail", args=[self.tech_a.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["jobs_count"], 2)
        self.assertEqual(response.data["active_jobs"], 1)
        self.assertEqual(response.data["jobs_this_month"], 2)

    def test_superadmin_lists_technicians_across_labs(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get(reverse("technician-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_regular_user_cannot_create_technician(self):
        self.client.force_authenticate(user=self.regular_a)
        response = self.client.post(
            reverse("technician-list"),
            {"first_name": "Blocked", "last_name": "Technician"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Technician.objects.filter(first_name="Blocked").exists())
