from django.test import TestCase
from django.utils import timezone

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Patient
from apps.jobs.models import CalendarEvent, Job, Technician
from apps.jobs.selectors import calendar_events_for_user, jobs_for_user, technicians_for_user


class JobSelectorTests(TestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Job Selector Lab A")
        self.lab_b = Lab.objects.create(name="Job Selector Lab B")
        self.user_a = User.objects.create_user(
            username="job_selector_a",
            email="job_selector_a@example.com",
            password="pw",
            lab=self.lab_a,
        )
        self.user_without_lab = User.objects.create_user(
            username="job_selector_no_lab",
            email="job_selector_no_lab@example.com",
            password="pw",
        )
        self.superadmin = User.objects.create_user(
            username="job_selector_superadmin",
            email="job_selector_superadmin@example.com",
            password="pw",
            role="superadmin",
            is_superuser=True,
        )
        self.patient_a = Patient.objects.create(
            lab=self.lab_a,
            first_name="A",
            last_name="Patient",
            birth_number="333333/3333",
        )
        self.patient_b = Patient.objects.create(
            lab=self.lab_b,
            first_name="B",
            last_name="Patient",
            birth_number="444444/4444",
        )
        self.clinic_a = Clinic.objects.create(lab=self.lab_a, name="Clinic A")
        self.clinic_b = Clinic.objects.create(lab=self.lab_b, name="Clinic B")
        self.job_a = Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
        )
        self.job_b = Job.objects.create(
            lab=self.lab_b,
            patient=self.patient_b,
            clinic=self.clinic_b,
        )
        self.tech_a = Technician.objects.create(
            lab=self.lab_a,
            first_name="A",
            last_name="Tech",
        )
        self.tech_b = Technician.objects.create(
            lab=self.lab_b,
            first_name="B",
            last_name="Tech",
        )
        self.event_a = CalendarEvent.objects.create(
            lab=self.lab_a,
            title="A Event",
            start=timezone.now(),
        )
        self.event_b = CalendarEvent.objects.create(
            lab=self.lab_b,
            title="B Event",
            start=timezone.now(),
        )

    def test_selectors_scope_to_users_lab(self):
        self.assertEqual(list(jobs_for_user(self.user_a)), [self.job_a])
        self.assertEqual(list(technicians_for_user(self.user_a)), [self.tech_a])
        self.assertEqual(list(calendar_events_for_user(self.user_a)), [self.event_a])

    def test_selectors_return_all_for_superadmin_and_none_without_lab(self):
        self.assertCountEqual(jobs_for_user(self.superadmin), [self.job_a, self.job_b])
        self.assertCountEqual(
            technicians_for_user(self.superadmin),
            [self.tech_a, self.tech_b],
        )
        self.assertCountEqual(
            calendar_events_for_user(self.superadmin),
            [self.event_a, self.event_b],
        )
        self.assertFalse(jobs_for_user(self.user_without_lab).exists())
        self.assertFalse(technicians_for_user(self.user_without_lab).exists())
        self.assertFalse(calendar_events_for_user(self.user_without_lab).exists())
