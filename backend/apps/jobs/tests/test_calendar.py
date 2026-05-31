from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Patient
from apps.jobs.models import CalendarEvent, Job, Vacation


class CalendarApiTests(APITestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Calendar Lab A")
        self.lab_b = Lab.objects.create(name="Calendar Lab B")
        self.admin_a = User.objects.create_user(
            username="calendar_admin_a",
            email="calendar_admin_a@example.com",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )
        self.admin_b = User.objects.create_user(
            username="calendar_admin_b",
            email="calendar_admin_b@example.com",
            password="password123",
            role="admin",
            lab=self.lab_b,
        )
        self.regular_a = User.objects.create_user(
            username="calendar_regular_a",
            email="calendar_regular_a@example.com",
            password="password123",
            role="user",
            lab=self.lab_a,
        )
        self.superadmin = User.objects.create_user(
            username="calendar_superadmin",
            email="calendar_superadmin@example.com",
            password="password123",
            role="superadmin",
            is_superuser=True,
        )
        self.patient_a = Patient.objects.create(
            lab=self.lab_a,
            first_name="Calendar",
            last_name="Patient",
            birth_number="970101/1111",
        )
        self.clinic_a = Clinic.objects.create(lab=self.lab_a, name="Calendar Clinic A")
        self.patient_b = Patient.objects.create(
            lab=self.lab_b,
            first_name="Other",
            last_name="Patient",
            birth_number="970101/2222",
        )
        self.clinic_b = Clinic.objects.create(lab=self.lab_b, name="Calendar Clinic B")

    def test_calendar_event_crud_is_lab_scoped(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(
            reverse("calendarevent-list"),
            {
                "title": "Pickup",
                "event_type": "pickup",
                "start": timezone.now().isoformat(),
                "description": "Pick up work",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["lab"], self.lab_a.id)
        event = CalendarEvent.objects.get(id=response.data["id"])
        self.assertEqual(event.lab_id, self.lab_a.id)

        other_event = CalendarEvent.objects.create(
            lab=self.lab_b,
            title="Other lab event",
            event_type="meeting",
            start=timezone.now(),
        )
        detail_response = self.client.get(reverse("calendarevent-detail", args=[other_event.id]))
        self.assertEqual(detail_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_calendar_event_rejects_related_job_from_other_lab(self):
        other_job = Job.objects.create(
            lab=self.lab_b,
            patient=self.patient_b,
            clinic=self.clinic_b,
            status="new",
            due_date=timezone.localdate(),
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(
            reverse("calendarevent-list"),
            {
                "title": "Bad reference",
                "event_type": "meeting",
                "start": timezone.now().isoformat(),
                "related_job": other_job.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(CalendarEvent.objects.filter(title="Bad reference").exists())

    def test_calendar_endpoint_aggregates_jobs_vacations_and_events(self):
        today = timezone.localdate()
        job = Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            status="in_progress",
            due_date=today,
            description="Due job",
        )
        Job.objects.create(
            lab=self.lab_b,
            patient=self.patient_b,
            clinic=self.clinic_b,
            status="in_progress",
            due_date=today,
            description="Other lab job",
        )
        vacation = Vacation.objects.create(
            lab=self.lab_a,
            start=timezone.now(),
            end=timezone.now() + timezone.timedelta(hours=2),
            description="Lab vacation",
        )
        event = CalendarEvent.objects.create(
            lab=self.lab_a,
            title="Delivery",
            event_type="delivery",
            start=timezone.now(),
            related_job=job,
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(
            reverse("calendar"),
            {"start": today.isoformat(), "end": today.isoformat()},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event_ids = {item["id"] for item in response.data["events"]}
        self.assertIn(f"job:{job.id}", event_ids)
        self.assertIn(f"vacation:{vacation.id}", event_ids)
        self.assertIn(f"event:{event.id}", event_ids)
        self.assertFalse(any("Other lab" in item["title"] for item in response.data["events"]))

    def test_superadmin_calendar_sees_all_labs(self):
        today = timezone.localdate()
        job_a = Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            status="new",
            due_date=today,
        )
        job_b = Job.objects.create(
            lab=self.lab_b,
            patient=self.patient_b,
            clinic=self.clinic_b,
            status="new",
            due_date=today,
        )

        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get(
            reverse("jobs-calendar"),
            {"start": today.isoformat(), "end": today.isoformat()},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        event_ids = {item["id"] for item in response.data["events"]}
        self.assertIn(f"job:{job_a.id}", event_ids)
        self.assertIn(f"job:{job_b.id}", event_ids)

    def test_regular_user_cannot_create_calendar_event(self):
        self.client.force_authenticate(user=self.regular_a)
        response = self.client.post(
            reverse("calendarevent-list"),
            {
                "title": "Blocked",
                "event_type": "meeting",
                "start": timezone.now().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(CalendarEvent.objects.filter(title="Blocked").exists())


class CalendarEventContactFieldsTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Cal Lab")
        self.user = User.objects.create_user(
            username="cal_user",
            password="pw",
            email="cal@test.sk",
            role="admin",
            lab=self.lab,
        )

    def test_create_event_with_contact_fields(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/jobs/calendar-events/",
            {
                "title": "Pickup",
                "event_type": "pickup",
                "start": "2026-06-01T10:00:00Z",
                "location": "Klinika Bratislava, Hlavná 1",
                "contact_person": "Dr. Novák",
                "contact_phone": "+421 900 000 000",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["location"], "Klinika Bratislava, Hlavná 1")
        self.assertEqual(resp.data["contact_person"], "Dr. Novák")
        self.assertEqual(resp.data["contact_phone"], "+421 900 000 000")

    def test_event_contact_fields_nullable(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/jobs/calendar-events/",
            {
                "title": "Meeting",
                "event_type": "meeting",
                "start": "2026-06-02T09:00:00Z",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIsNone(resp.data["location"])
        self.assertIsNone(resp.data["contact_person"])
