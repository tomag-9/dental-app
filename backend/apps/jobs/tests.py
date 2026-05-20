from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import PriceList
from apps.jobs.dental import expand_fdi_range, validate_tooth_range
from apps.jobs.models import (
    CalendarEvent,
    Job,
    JobItem,
    JobTimelineEvent,
    Technician,
    Vacation,
)


class DentalNotationTests(APITestCase):
    def test_expand_fdi_range_accepts_single_tooth_and_same_arch_ranges(self):
        self.assertEqual(expand_fdi_range("26"), ["26"])
        self.assertCountEqual(expand_fdi_range("45-47"), ["45", "46", "47"])
        self.assertCountEqual(expand_fdi_range("47–45"), ["45", "46", "47"])

    def test_expand_fdi_range_rejects_invalid_or_cross_arch_ranges(self):
        self.assertEqual(expand_fdi_range("99"), [])
        self.assertEqual(expand_fdi_range("18-48"), [])
        self.assertFalse(validate_tooth_range("31-11"))


class VacationApiTests(APITestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Lab A")
        self.lab_b = Lab.objects.create(name="Lab B")

        self.admin_a = User.objects.create_user(
            username="admin_a",
            email="vacation_admin_a@test.com",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )
        self.admin_b = User.objects.create_user(
            username="admin_b",
            email="vacation_admin_b@test.com",
            password="password123",
            role="admin",
            lab=self.lab_b,
        )
        self.superadmin = User.objects.create_user(
            username="superadmin",
            email="vacation_superadmin@test.com",
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
        detail_response = self.client.get(
            reverse("calendarevent-detail", args=[other_event.id])
        )
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
        self.assertFalse(
            any("Other lab" in item["title"] for item in response.data["events"])
        )

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


class JobValidationApiTests(APITestCase):
    """Test job validation and filtering behavior matching legacy backend."""

    def setUp(self):
        # Create labs
        self.lab_a = Lab.objects.create(name="Lab A")
        self.lab_b = Lab.objects.create(name="Lab B")

        # Create users
        self.admin_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@test.com",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )
        self.admin_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@test.com",
            password="password123",
            role="admin",
            lab=self.lab_b,
        )
        self.superadmin = User.objects.create_user(
            username="superadmin",
            email="superadmin@test.com",
            password="password123",
            role="superadmin",
        )

        # Create price list entries
        self.price_valid = PriceList.objects.create(
            lab=self.lab_a,
            code="CROWN",
            description="Crown procedure",
            price=150.0,
        )
        self.price_bridge = PriceList.objects.create(
            lab=self.lab_a,
            code="BRIDGE",
            description="Bridge procedure",
            price=300.0,
        )

        # Create entities for Lab A
        self.patient_a = Patient.objects.create(
            lab=self.lab_a,
            first_name="John",
            last_name="Doe",
            birth_number="900101/1234",
        )
        self.clinic_a = Clinic.objects.create(
            lab=self.lab_a,
            name="Clinic A",
        )
        self.doctor_a = Doctor.objects.create(
            lab=self.lab_a,
            first_name="Dr.",
            last_name="Smith",
        )
        self.technician_a = Technician.objects.create(
            lab=self.lab_a,
            first_name="Tech",
            last_name="A",
        )

        # Create entities for Lab B
        self.patient_b = Patient.objects.create(
            lab=self.lab_b,
            first_name="Jane",
            last_name="Smith",
            birth_number="910202/5678",
        )
        self.clinic_b = Clinic.objects.create(
            lab=self.lab_b,
            name="Clinic B",
        )
        self.doctor_b = Doctor.objects.create(
            lab=self.lab_b,
            first_name="Dr.",
            last_name="Jones",
        )
        self.technician_b = Technician.objects.create(
            lab=self.lab_b,
            first_name="Tech",
            last_name="B",
        )

        # Create a job for Lab A
        self.job_a = Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.technician_a,
            price=150.0,
            procedure_codes=["CROWN"],
            procedure_quantities={"CROWN": 1},
            description="Job for Lab A",
        )

        # Create a job for Lab B
        self.job_b = Job.objects.create(
            lab=self.lab_b,
            patient=self.patient_b,
            clinic=self.clinic_b,
            doctor=self.doctor_b,
            technician=self.technician_b,
            price=200.0,
            procedure_codes=["BRIDGE"],
            procedure_quantities={"BRIDGE": 1},
            description="Job for Lab B",
        )

    def test_create_job_with_valid_procedure_code(self):
        """Valid procedure code should be accepted."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-list")
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "doctor": self.doctor_a.id,
            "technician": self.technician_a.id,
            "price": 150.0,
            "procedure_codes": ["CROWN"],
            "procedure_quantities": {"CROWN": 1},
            "description": "Valid job",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["description"], "Valid job")
        self.assertEqual(response.data["lab"], self.lab_a.id)

    def test_create_job_with_invalid_procedure_code_returns_400(self):
        """Invalid procedure code should return 400."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-list")
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "doctor": self.doctor_a.id,
            "technician": self.technician_a.id,
            "price": 150.0,
            "procedure_codes": ["NONEXISTENT_CODE"],
            "procedure_quantities": {"NONEXISTENT_CODE": 1},
            "description": "Invalid job",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid procedure codes", str(response.data))

    def test_create_job_rejects_procedure_code_from_other_lab(self):
        """Procedure code validation must use the request user's lab."""
        self.client.force_authenticate(user=self.admin_b)
        url = reverse("job-list")
        payload = {
            "patient": self.patient_b.id,
            "clinic": self.clinic_b.id,
            "doctor": self.doctor_b.id,
            "technician": self.technician_b.id,
            "price": 150.0,
            "procedure_codes": ["CROWN"],
            "procedure_quantities": {"CROWN": 1},
            "description": "Other lab price-list code",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Invalid procedure codes", str(response.data))

    def test_create_job_with_mismatched_codes_and_quantities_returns_400(self):
        """Procedure codes and quantities must match."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-list")
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "doctor": self.doctor_a.id,
            "technician": self.technician_a.id,
            "price": 150.0,
            "procedure_codes": ["CROWN", "BRIDGE"],
            "procedure_quantities": {"CROWN": 1},  # Missing BRIDGE
            "description": "Mismatched job",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("must match", str(response.data))

    def test_create_job_with_cross_lab_entities_returns_400_for_non_superadmin(self):
        """Non-superadmin cannot create job with entities from different lab."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-list")
        payload = {
            "patient": self.patient_b.id,  # From Lab B
            "clinic": self.clinic_a.id,
            "doctor": self.doctor_a.id,
            "technician": self.technician_a.id,
            "price": 150.0,
            "procedure_codes": ["CROWN"],
            "procedure_quantities": {"CROWN": 1},
            "description": "Cross-lab job",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("same lab", str(response.data))

    def test_list_jobs_filtered_by_patient_id(self):
        """GET /jobs/?patient_id=X should filter by patient."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-list")

        response = self.client.get(url, {"patient_id": self.patient_a.id})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.job_a.id)

    def test_list_jobs_with_patient_filter_no_results_returns_404(self):
        """GET /jobs/?patient_id=X should return 404 if no jobs found."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-list")
        # Use a patient ID that exists but has no jobs
        non_job_patient = Patient.objects.create(
            lab=self.lab_a,
            first_name="No",
            last_name="Jobs",
            birth_number="920303/9876",
        )

        response = self.client.get(url, {"patient_id": non_job_patient.id})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertIn(f"patient_id: {non_job_patient.id}", str(response.data))

    def test_list_jobs_scoped_by_lab_for_non_superadmin(self):
        """Non-superadmin should only see jobs from their lab."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.job_a.id)

    def test_list_jobs_filters_by_status_priority_and_search(self):
        Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.technician_a,
            status="in_progress",
            priority="urgent",
            description="Urgent zircon bridge",
        )
        Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.technician_a,
            status="cancelled",
            priority="urgent",
            description="Cancelled zircon bridge",
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(
            reverse("job-list"),
            {
                "status": "new,in_progress",
                "priority": "urgent",
                "search": "zircon",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["status"], "in_progress")
        self.assertEqual(response.data[0]["priority"], "urgent")

    def test_list_jobs_search_matches_related_patient_and_clinic(self):
        self.client.force_authenticate(user=self.admin_a)

        patient_response = self.client.get(reverse("job-list"), {"q": "John"})
        clinic_response = self.client.get(reverse("job-list"), {"search": "Clinic A"})
        other_lab_response = self.client.get(reverse("job-list"), {"search": "Jane"})

        self.assertEqual(patient_response.status_code, status.HTTP_200_OK)
        self.assertEqual(clinic_response.status_code, status.HTTP_200_OK)
        self.assertEqual(other_lab_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in patient_response.data], [self.job_a.id]
        )
        self.assertEqual([item["id"] for item in clinic_response.data], [self.job_a.id])
        self.assertEqual(other_lab_response.data, [])

    def test_list_jobs_all_for_superadmin(self):
        """Superadmin should see all jobs across labs."""
        self.client.force_authenticate(user=self.superadmin)
        url = reverse("job-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_create_job_assigns_current_users_lab(self):
        """Job should always be assigned to current user's lab."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-list")
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "doctor": self.doctor_a.id,
            "technician": self.technician_a.id,
            "price": 250.0,
            "procedure_codes": ["CROWN"],
            "procedure_quantities": {"CROWN": 2},
            "description": "Lab assignment test",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["lab"], self.lab_a.id)

    def test_create_job_with_items_snapshots_price_and_timeline(self):
        """Nested job items should snapshot price-list data and create timeline."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-list")
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "doctor": self.doctor_a.id,
            "technician": self.technician_a.id,
            "priority": "urgent",
            "items": [
                {
                    "price_list_code": "CROWN",
                    "tooth": "11",
                    "quantity": 2,
                }
            ],
            "description": "Nested item job",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        job = Job.objects.get(id=response.data["id"])
        self.assertEqual(job.priority, "urgent")
        self.assertEqual(job.price, self.price_valid.price * 2)
        self.assertEqual(job.procedure_codes, ["CROWN"])
        self.assertEqual(job.procedure_quantities, {"CROWN": 2})
        self.assertEqual(JobItem.objects.filter(job=job).count(), 1)
        item = job.items.get()
        self.assertEqual(item.description, self.price_valid.description)
        self.assertEqual(item.unit_price, self.price_valid.price)
        self.assertEqual(item.tooth, "11")
        self.assertTrue(
            JobTimelineEvent.objects.filter(job=job, event="created").exists()
        )

    def test_create_job_rejects_invalid_fdi_tooth_item(self):
        """Nested items must use valid FDI tooth or same-arch ranges."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-list")
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "items": [
                {
                    "price_list_code": "CROWN",
                    "tooth": "99",
                    "quantity": 1,
                }
            ],
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("FDI", str(response.data))

    def test_create_job_accepts_bridge_tooth_range_item(self):
        """Bridge items can target a valid same-arch FDI range."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-list")
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "items": [
                {
                    "price_list_code": "BRIDGE",
                    "tooth": "45-47",
                    "quantity": 3,
                }
            ],
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = JobItem.objects.get(job_id=response.data["id"])
        self.assertEqual(item.tooth, "45-47")
        self.assertEqual(item.quantity, 3)

    def test_transition_status_validates_flow_and_records_timeline(self):
        """Status changes must use the transition endpoint and write audit events."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-transition-status", args=[self.job_a.id])

        response = self.client.post(
            url,
            {"status": "in_progress", "note": "Začíname výrobu"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.job_a.refresh_from_db()
        self.assertEqual(self.job_a.status, "in_progress")
        event = JobTimelineEvent.objects.get(
            job=self.job_a,
            event="status_changed",
            from_status="new",
            to_status="in_progress",
        )
        self.assertEqual(event.note, "Začíname výrobu")
        self.assertEqual(event.actor, self.admin_a)

    def test_transition_status_rejects_invalid_flow(self):
        """Invalid status jumps must be rejected."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-transition-status", args=[self.job_a.id])

        response = self.client.post(url, {"status": "closed"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.job_a.refresh_from_db()
        self.assertEqual(self.job_a.status, "new")

    def test_regular_update_rejects_invalid_status_jump(self):
        """PUT/PATCH must not bypass the validated status workflow."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("job-detail", args=[self.job_a.id])

        response = self.client.patch(url, {"status": "closed"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.job_a.refresh_from_db()
        self.assertEqual(self.job_a.status, "new")

    def test_delete_invoiced_job_is_blocked(self):
        """Jobs attached to invoices are protected from deletion."""
        from apps.finance.models import Invoice, InvoiceItem

        invoice = Invoice.objects.create(
            lab=self.lab_a,
            clinic=self.clinic_a,
            number="INV-JOB-LOCK",
            status="issued",
            total_amount=150,
        )
        InvoiceItem.objects.create(
            invoice=invoice,
            job=self.job_a,
            description="Locked job",
            quantity=1,
            unit_price=150,
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.delete(reverse("job-detail", args=[self.job_a.id]))

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertTrue(Job.objects.filter(id=self.job_a.id).exists())


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
