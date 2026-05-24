from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import AuditLog, Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import PriceList
from apps.jobs.dental import (
    CANONICAL_FDI_STORAGE_NOTE,
    expand_fdi_range,
    normalize_tooth_scope,
    validate_bridge_span,
    validate_tooth_range,
)
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

    def test_bridge_span_requires_at_least_two_same_arch_teeth(self):
        self.assertTrue(validate_bridge_span("45-47"))
        self.assertFalse(validate_bridge_span("45"))
        self.assertFalse(validate_bridge_span("18-48"))

    def test_canonical_fdi_storage_note_documents_api_contract(self):
        self.assertIn("canonical FDI", CANONICAL_FDI_STORAGE_NOTE)
        self.assertIn("45-47", CANONICAL_FDI_STORAGE_NOTE)

    def test_normalize_tooth_scope_accepts_supported_scope_codes(self):
        self.assertEqual(normalize_tooth_scope("a"), "A")
        self.assertEqual(normalize_tooth_scope("U"), "U")
        self.assertEqual(normalize_tooth_scope("q4"), "Q4")
        self.assertEqual(normalize_tooth_scope("Q5"), "")


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

    def test_create_job_with_item_metadata_snapshots_production_fields(self):
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "items": [
                {
                    "price_list_code": "BRIDGE",
                    "tooth": "46",
                    "quantity": 1,
                    "procedure_category": "bridge",
                    "material": "zircon",
                    "color": "A2",
                    "bridge_span": "45-47",
                    "tooth_state": "temporary",
                }
            ],
        }

        response = self.client.post(reverse("job-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = JobItem.objects.get(job_id=response.data["id"])
        self.assertEqual(item.procedure_category, "bridge")
        self.assertEqual(item.material, "zircon")
        self.assertEqual(item.color, "A2")
        self.assertEqual(item.bridge_span, "45-47")
        self.assertEqual(item.tooth_state, "temporary")
        self.assertEqual(response.data["items"][0]["bridge_span"], "45-47")

    def test_create_job_with_tooth_scope_stores_scope_separately(self):
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "items": [
                {
                    "price_list_code": "CROWN",
                    "tooth_scope": "U",
                    "quantity": 1,
                }
            ],
        }

        response = self.client.post(reverse("job-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = JobItem.objects.get(job_id=response.data["id"])
        self.assertIsNone(item.tooth)
        self.assertEqual(item.tooth_scope, "U")
        self.assertEqual(response.data["items"][0]["tooth_scope"], "U")

    def test_create_job_accepts_inline_scope_in_tooth_field(self):
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "items": [
                {
                    "price_list_code": "CROWN",
                    "tooth": "Q2",
                    "quantity": 1,
                }
            ],
        }

        response = self.client.post(reverse("job-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = JobItem.objects.get(job_id=response.data["id"])
        self.assertIsNone(item.tooth)
        self.assertEqual(item.tooth_scope, "Q2")

    def test_bridge_item_requires_valid_bridge_span(self):
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "items": [
                {
                    "price_list_code": "BRIDGE",
                    "tooth": "46",
                    "procedure_category": "bridge",
                }
            ],
        }

        response = self.client.post(reverse("job-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("bridge_span", str(response.data))

    def test_bridge_span_must_cover_item_tooth(self):
        self.client.force_authenticate(user=self.admin_a)
        payload = {
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "items": [
                {
                    "price_list_code": "BRIDGE",
                    "tooth": "44",
                    "procedure_category": "bridge",
                    "bridge_span": "45-47",
                }
            ],
        }

        response = self.client.post(reverse("job-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("within the bridge span", str(response.data))

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


class WorkOrderEndpointTests(APITestCase):
    def setUp(self):
        from apps.core.models import Lab, User
        from apps.crm.models import Clinic, Doctor, Patient
        from apps.jobs.models import Job, JobItem, Technician

        self.lab = Lab.objects.create(
            name="WO Lab", phone="0900000", email="lab@test.sk"
        )
        self.user = User.objects.create_user(
            username="wo_user", password="pw", role="admin", lab=self.lab
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="WO Clinic")
        self.doctor = Doctor.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            first_name="Jan",
            last_name="Novak",
            title_before="MUDr.",
        )
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Alice",
            last_name="Test",
            birth_number="900101/1234",
        )
        self.tech = Technician.objects.create(
            lab=self.lab, first_name="Tech", last_name="One"
        )
        self.job = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            doctor=self.doctor,
            patient=self.patient,
            technician=self.tech,
            status="in_progress",
            description="Crown work",
            priority="high",
            tooth_color="A1",
        )
        JobItem.objects.create(
            job=self.job,
            price_list_code="C001",
            description="Crown",
            quantity=1,
            unit_price="150.00",
            total="150.00",
        )

    def test_work_order_returns_structured_data(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/jobs/jobs/{self.job.id}/work_order/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["id"], self.job.id)
        self.assertIn("WO-", resp.data["number"])
        self.assertEqual(resp.data["status"], "in_progress")
        self.assertEqual(resp.data["priority"], "high")
        self.assertEqual(resp.data["tooth_color"], "A1")

    def test_work_order_includes_related_entities(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/jobs/jobs/{self.job.id}/work_order/")
        self.assertEqual(resp.status_code, 200)
        self.assertIsNotNone(resp.data["patient"])
        self.assertEqual(resp.data["patient"]["name"], "Alice Test")
        self.assertIsNotNone(resp.data["clinic"])
        self.assertIsNotNone(resp.data["doctor"])
        self.assertIn("Novak", resp.data["doctor"]["name"])
        self.assertIsNotNone(resp.data["technician"])

    def test_work_order_includes_items(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/jobs/jobs/{self.job.id}/work_order/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["items"]), 1)
        item = resp.data["items"][0]
        self.assertEqual(item["price_list_code"], "C001")
        self.assertEqual(item["description"], "Crown")
        self.assertEqual(item["unit_price"], "150.00")

    def test_work_order_respects_lab_scoping(self):
        from apps.core.models import Lab, User

        other_lab = Lab.objects.create(name="Other WO Lab")
        other_user = User.objects.create_user(
            username="other_wo_user",
            email="other_wo@test.sk",
            password="pw",
            role="admin",
            lab=other_lab,
        )
        self.client.force_authenticate(user=other_user)
        resp = self.client.get(f"/api/jobs/jobs/{self.job.id}/work_order/")
        self.assertEqual(resp.status_code, 404)


class JobStatusConfigTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="StatusConfig Lab")
        self.user = User.objects.create_user(
            username="sc_user",
            password="pw",
            email="sc_user@test.sk",
            role="user",
            lab=self.lab,
        )

    def test_status_config_returns_all_statuses(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/jobs/jobs/status-config/")
        self.assertEqual(resp.status_code, 200)
        expected_statuses = [
            "new",
            "in_progress",
            "completed",
            "cancelled",
            "finished_factured",
            "finished_unfactured",
            "closed",
        ]
        for s in expected_statuses:
            self.assertIn(s, resp.data, f"Missing status: {s}")

    def test_status_config_entry_has_required_fields(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/jobs/jobs/status-config/")
        entry = resp.data["new"]
        self.assertIn("label", entry)
        self.assertIn("label_en", entry)
        self.assertIn("color", entry)
        self.assertIn("allowed_transitions", entry)
        self.assertIsInstance(entry["allowed_transitions"], list)

    def test_status_config_new_can_transition_to_in_progress(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/jobs/jobs/status-config/")
        self.assertIn("in_progress", resp.data["new"]["allowed_transitions"])

    def test_status_config_closed_has_no_transitions(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/jobs/jobs/status-config/")
        self.assertEqual(resp.data["closed"]["allowed_transitions"], [])


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


class QuickCreateJobTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="QuickCreate Lab")
        self.clinic = Clinic.objects.create(name="QC Clinic", lab=self.lab)
        self.user = User.objects.create_user(
            username="qc_user",
            password="pw",
            email="qc@test.sk",
            role="admin",
            lab=self.lab,
        )

    def test_creates_patient_and_job_atomically(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/jobs/jobs/quick-create/",
            {
                "clinic_id": self.clinic.id,
                "patient": {
                    "first_name": "Nový",
                    "last_name": "Pacient",
                    "birth_number": "900101/9999",
                },
                "job": {
                    "description": "Korunka",
                    "status": "new",
                },
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIn("patient", resp.data)
        self.assertIn("job", resp.data)
        self.assertEqual(resp.data["patient"]["first_name"], "Nový")
        self.assertIsNotNone(resp.data["job"]["id"])

    def test_reuses_existing_patient_by_birth_number(self):
        existing = Patient.objects.create(
            first_name="Existujúci",
            last_name="Pacient",
            birth_number="800202/1111",
            lab=self.lab,
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/jobs/jobs/quick-create/",
            {
                "clinic_id": self.clinic.id,
                "patient": {
                    "first_name": "Iné",
                    "last_name": "Meno",
                    "birth_number": "800202/1111",
                },
                "job": {"description": "Mostík"},
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["patient"]["id"], existing.id)

    def test_missing_clinic_id_returns_400(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/jobs/jobs/quick-create/",
            {"patient": {"first_name": "X", "last_name": "Y"}, "job": {}},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_out_of_scope_clinic_returns_404(self):
        other_lab = Lab.objects.create(name="Other QC Lab")
        other_clinic = Clinic.objects.create(name="Other", lab=other_lab)
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/jobs/jobs/quick-create/",
            {
                "clinic_id": other_clinic.id,
                "patient": {"first_name": "X", "last_name": "Y"},
                "job": {},
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 404)

    def test_regular_user_cannot_quick_create(self):
        regular = User.objects.create_user(
            username="qc_regular",
            password="pw",
            email="qcr@test.sk",
            role="user",
            lab=self.lab,
        )
        self.client.force_authenticate(user=regular)
        resp = self.client.post(
            "/api/jobs/jobs/quick-create/",
            {
                "clinic_id": self.clinic.id,
                "patient": {
                    "first_name": "Eva",
                    "last_name": "Nova",
                    "birth_number": "9055215000",
                },
                "job": {"description": "Test"},
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 403)


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
        from django.utils import timezone

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
        from django.utils import timezone

        today = timezone.localdate().isoformat()
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/jobs/jobs/?from_date={today}")
        self.assertEqual(resp.status_code, 200)
        ids = [j["id"] for j in resp.data]
        self.assertIn(self.job_today.id, ids)
        self.assertIn(self.job_future.id, ids)
        self.assertNotIn(self.job_past.id, ids)

    def test_to_date_filters_out_future(self):
        from django.utils import timezone

        today = timezone.localdate().isoformat()
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/jobs/jobs/?to_date={today}")
        self.assertEqual(resp.status_code, 200)
        ids = [j["id"] for j in resp.data]
        self.assertIn(self.job_today.id, ids)
        self.assertIn(self.job_past.id, ids)
        self.assertNotIn(self.job_future.id, ids)

    def test_technician_id_filter(self):
        from apps.jobs.models import Technician

        tech = Technician.objects.create(lab=self.lab, first_name="T", last_name="T")
        self.job_today.technician = tech
        self.job_today.save(update_fields=["technician"])
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/jobs/jobs/?technician_id={tech.id}")
        self.assertEqual(resp.status_code, 200)
        ids = [j["id"] for j in resp.data]
        self.assertIn(self.job_today.id, ids)
        self.assertNotIn(self.job_past.id, ids)


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
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Bulk",
            last_name="Patient",
        )
        self.job1 = Job.objects.create(
            lab=self.lab, clinic=self.clinic, patient=self.patient, status="new"
        )
        self.job2 = Job.objects.create(
            lab=self.lab, clinic=self.clinic, patient=self.patient, status="new"
        )
        self.job3 = Job.objects.create(
            lab=self.lab, clinic=self.clinic, patient=self.patient, status="completed"
        )

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


class JobAttachmentTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Attach Lab")
        self.clinic = Clinic.objects.create(name="Attach Clinic", lab=self.lab)
        self.user = User.objects.create_user(
            username="attach_user",
            password="pw",
            email="attach@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="A",
            last_name="Patient",
        )
        self.job = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            patient=self.patient,
            status="new",
        )

    def test_list_attachments_empty(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/jobs/jobs/{self.job.id}/attachments/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_create_attachment(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f"/api/jobs/jobs/{self.job.id}/attachments/",
            {
                "file_name": "photo.jpg",
                "file_url": "https://example.com/photo.jpg",
                "file_type": "image/jpeg",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["file_name"], "photo.jpg")
        self.assertEqual(resp.data["uploaded_by"], self.user.id)

    def test_list_attachments_after_create(self):
        self.client.force_authenticate(user=self.user)
        self.client.post(
            f"/api/jobs/jobs/{self.job.id}/attachments/",
            {"file_name": "scan.pdf", "file_url": "https://example.com/scan.pdf"},
            format="json",
        )
        resp = self.client.get(f"/api/jobs/jobs/{self.job.id}/attachments/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["file_name"], "scan.pdf")

    def test_unauthenticated_denied(self):
        resp = self.client.get(f"/api/jobs/jobs/{self.job.id}/attachments/")
        self.assertEqual(resp.status_code, 401)


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
        self.patient = Patient.objects.create(
            first_name="Jana", last_name="Nová", lab=self.lab
        )
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
        notif = Notification.objects.filter(
            lab=self.lab, type="job", recipient=self.admin
        ).first()
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
        self.assertEqual(
            Notification.objects.filter(lab=self.lab, type="job").count(), 0
        )


class JobExportCsvTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Export Lab")
        self.admin = User.objects.create_user(
            username="export_admin",
            password="pw",
            email="export@lab.sk",
            role="admin",
            lab=self.lab,
        )
        self.patient = Patient.objects.create(
            first_name="Ján", last_name="Testovský", lab=self.lab
        )
        self.clinic = Clinic.objects.create(name="Klinika Export", lab=self.lab)
        Job.objects.create(
            patient=self.patient,
            clinic=self.clinic,
            lab=self.lab,
            status="completed",
            price="250.00",
        )
        Job.objects.create(
            patient=self.patient,
            clinic=self.clinic,
            lab=self.lab,
            status="new",
            price="100.00",
        )

    def test_export_returns_csv_with_header(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/jobs/jobs/export/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "text/csv")
        content = (
            b"".join(resp.streaming_content).decode()
            if hasattr(resp, "streaming_content")
            else resp.content.decode()
        )
        self.assertIn("id,status,patient", content)

    def test_export_contains_all_lab_jobs(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/jobs/jobs/export/")
        content = (
            b"".join(resp.streaming_content).decode()
            if hasattr(resp, "streaming_content")
            else resp.content.decode()
        )
        rows = [r for r in content.strip().split("\n") if r]
        self.assertEqual(len(rows), 3)  # header + 2 jobs

    def test_export_respects_status_filter(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/jobs/jobs/export/?status=completed")
        content = (
            b"".join(resp.streaming_content).decode()
            if hasattr(resp, "streaming_content")
            else resp.content.decode()
        )
        rows = [r for r in content.strip().split("\n") if r]
        self.assertEqual(len(rows), 2)  # header + 1 completed job

    def test_export_tenant_scoped(self):
        other_lab = Lab.objects.create(name="Other Lab")
        other_user = User.objects.create_user(
            username="other_export",
            password="pw",
            email="other@lab.sk",
            role="admin",
            lab=other_lab,
        )
        self.client.force_authenticate(user=other_user)
        resp = self.client.get("/api/jobs/jobs/export/")
        content = (
            b"".join(resp.streaming_content).decode()
            if hasattr(resp, "streaming_content")
            else resp.content.decode()
        )
        rows = [r for r in content.strip().split("\n") if r]
        self.assertEqual(len(rows), 1)  # header only, no jobs from other lab

    def test_export_unauthenticated_denied(self):
        resp = self.client.get("/api/jobs/jobs/export/")
        self.assertEqual(resp.status_code, 401)
