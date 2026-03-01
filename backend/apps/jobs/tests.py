from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.jobs.models import Vacation


class VacationApiTests(APITestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Lab A")
        self.lab_b = Lab.objects.create(name="Lab B")

        self.admin_a = User.objects.create_user(
            username="admin_a",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )
        self.admin_b = User.objects.create_user(
            username="admin_b",
            password="password123",
            role="admin",
            lab=self.lab_b,
        )
        self.superadmin = User.objects.create_user(
            username="superadmin",
            password="password123",
            role="superadmin",
        )

        self.vacation_a = Vacation.objects.create(
            lab=self.lab_a,
            start=timezone.now(),
            end=timezone.now() + timezone.timedelta(days=1),
            description="Lab A vacation",
        )
        self.vacation_b = Vacation.objects.create(
            lab=self.lab_b,
            start=timezone.now(),
            end=timezone.now() + timezone.timedelta(days=2),
            description="Lab B vacation",
        )

    def test_list_vacations_scoped_by_lab_for_non_superadmin(self):
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("vacation-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.vacation_a.id)

    def test_list_vacations_all_for_superadmin(self):
        self.client.force_authenticate(user=self.superadmin)
        url = reverse("vacation-list")
        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_create_vacation_assigns_current_users_lab_for_non_superadmin(self):
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("vacation-list")
        payload = {
            "start": timezone.now().isoformat(),
            "end": (timezone.now() + timezone.timedelta(days=3)).isoformat(),
            "description": "Scoped create",
            # Non-superadmin attempt to override lab must be ignored by server.
            "lab": self.lab_b.id,
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["lab"], self.lab_a.id)

    def test_create_vacation_allows_superadmin_without_lab(self):
        self.client.force_authenticate(user=self.superadmin)
        url = reverse("vacation-list")
        payload = {
            "start": timezone.now().isoformat(),
            "end": (timezone.now() + timezone.timedelta(days=3)).isoformat(),
            "description": "Global vacation",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data["lab"])
