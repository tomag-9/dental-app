"""
Contract tests to prevent API response drift during migration.

These tests verify that API responses match expected shapes and field types
to ensure frontend compatibility. Tests will fail if critical fields are
removed or renamed, preventing accidental breaking changes.
"""

from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import Invoice, InvoiceItem, PriceList, Subscription
from apps.inventory.models import WarehouseItem
from apps.jobs.models import Job, Technician


class UserAuthContractTests(APITestCase):
    """Contract tests for user authentication endpoints."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Test Lab")
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )

    def test_signup_response_contract(self):
        """Signup response must include lab, user, and token objects."""
        url = reverse("user-signup")
        payload = {
            "email": "new@example.com",
            "password": "newpass123",
            "lab_name": "New Lab",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Critical top-level objects that frontend expects
        self.assertIn("lab", response.data)
        self.assertIn("user", response.data)
        self.assertIn("token", response.data)

        # Lab object fields
        self.assertIn("id", response.data["lab"])
        self.assertIn("name", response.data["lab"])
        self.assertIn("invoice_prefix", response.data["lab"])
        self.assertIn("invoice_due_days", response.data["lab"])
        self.assertIn("vat_rate", response.data["lab"])
        self.assertIn("payment_method", response.data["lab"])
        self.assertIn("invoice_default_note", response.data["lab"])
        self.assertIsInstance(response.data["lab"]["id"], int)
        self.assertEqual(response.data["lab"]["name"], "New Lab")
        self.assertEqual(response.data["lab"]["invoice_prefix"], "INV")
        self.assertEqual(response.data["lab"]["invoice_due_days"], 14)

        # User object fields
        self.assertIn("id", response.data["user"])
        self.assertIn("username", response.data["user"])
        self.assertIn("email", response.data["user"])
        self.assertIsInstance(response.data["user"]["id"], int)

        # Token object fields
        self.assertIn("access_token", response.data["token"])
        self.assertIn("refresh_token", response.data["token"])
        self.assertIn("token_type", response.data["token"])
        self.assertIsInstance(response.data["token"]["access_token"], str)
        self.assertIsInstance(response.data["token"]["refresh_token"], str)
        self.assertEqual(response.data["token"]["token_type"], "bearer")

    def test_token_obtain_response_contract(self):
        """Token response must include access and refresh tokens."""
        url = reverse("token_obtain_pair")
        payload = {
            "username": "testuser",
            "password": "password123",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertIsInstance(response.data["access"], str)
        self.assertIsInstance(response.data["refresh"], str)

    def test_me_endpoint_response_contract(self):
        """GET /users/me response must include critical user fields."""
        self.client.force_authenticate(user=self.user)
        url = reverse("user-me")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Critical fields
        required_fields = ["id", "username", "email", "role", "lab", "is_active"]
        for field in required_fields:
            self.assertIn(field, response.data, f"Missing required field: {field}")

        # Type validation
        self.assertIsInstance(response.data["id"], int)
        self.assertIsInstance(response.data["username"], str)
        self.assertIsInstance(response.data["role"], str)
        self.assertIsInstance(response.data["is_active"], bool)


class JobContractTests(APITestCase):
    """Contract tests for job endpoints."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Test Lab")
        self.user = User.objects.create_user(
            username="testuser",
            email="job_contract@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Test Clinic")
        self.doctor = Doctor.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            first_name="John",
            last_name="Doe",
        )
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Jane",
            last_name="Patient",
            birth_number="900101/1234",
        )
        self.technician = Technician.objects.create(
            lab=self.lab,
            first_name="Tech",
            last_name="One",
        )

    def test_job_list_response_contract(self):
        """Job list response must include detailed nested objects."""
        Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            doctor=self.doctor,
            technician=self.technician,
            price=100.0,
            status="new",
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("job-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)

        job = response.data[0]

        # Critical fields
        required_fields = [
            "id",
            "lab",
            "patient",
            "clinic",
            "doctor",
            "technician",
            "price",
            "status",
            "created_at",
            "updated_at",
            "patient_details",
            "clinic_details",
            "doctor_details",
            "technician_details",
        ]
        for field in required_fields:
            self.assertIn(field, job, f"Missing required field: {field}")

        # Nested object validation
        self.assertIn("first_name", job["patient_details"])
        self.assertIn("last_name", job["patient_details"])
        self.assertIn("name", job["clinic_details"])
        self.assertIn("first_name", job["doctor_details"])
        self.assertIn("last_name", job["doctor_details"])


class InvoiceContractTests(APITestCase):
    """Contract tests for invoice endpoints."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Test Lab")
        self.user = User.objects.create_user(
            username="testuser",
            email="invoice_contract@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Test Clinic")
        self.doctor = Doctor.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            first_name="John",
            last_name="Doe",
        )
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Jane",
            last_name="Patient",
            birth_number="900101/1234",
        )
        self.technician = Technician.objects.create(
            lab=self.lab,
            first_name="Tech",
            last_name="One",
        )
        PriceList.objects.create(
            lab=self.lab,
            code="CROWN",
            description="Crown",
            price=150.0,
        )

    def test_invoice_create_from_jobs_response_contract(self):
        """Invoice created from jobs must include enriched fields."""
        job = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            doctor=self.doctor,
            technician=self.technician,
            price=150.0,
            status="completed",
            procedure_codes=["CROWN"],
            procedure_quantities={"CROWN": 1},
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("invoice-list")
        payload = {
            "clinic_id": self.clinic.id,
            "job_ids": [job.id],
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Critical enriched fields
        required_fields = [
            "id",
            "lab",
            "clinic",
            "number",
            "status",
            "total_amount",
            "subtotal_amount",
            "vat_amount",
            "is_overdue",
            "days_overdue",
            "created_at",
            "clinic_name",
            "patient_names",
            "items",
            "related_jobs",
        ]
        for field in required_fields:
            self.assertIn(field, response.data, f"Missing required field: {field}")

        # Enriched fields must be populated
        self.assertEqual(response.data["clinic_name"], "Test Clinic")
        self.assertIsInstance(response.data["patient_names"], list)
        self.assertIn("Jane Patient", response.data["patient_names"])
        self.assertIsInstance(response.data["related_jobs"], list)
        self.assertFalse(response.data["is_overdue"])
        self.assertEqual(response.data["vat_amount"], "0.00")

        # Items must be included
        self.assertGreater(len(response.data["items"]), 0)
        item = response.data["items"][0]
        self.assertIn("description", item)
        self.assertIn("quantity", item)
        self.assertIn("unit_price", item)
        self.assertIn("line_total", item)

    def test_invoice_list_response_contract(self):
        """Invoice list must include enriched clinic_name and patient_names."""
        invoice = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="INV-001",
            status="draft",
            total_amount=150.0,
        )
        job = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            doctor=self.doctor,
            technician=self.technician,
            price=150.0,
        )
        InvoiceItem.objects.create(
            invoice=invoice,
            job=job,
            description="Crown",
            quantity=1,
            unit_price=150.0,
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("invoice-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)

        invoice_data = response.data[0]

        # Enriched fields must be present
        self.assertIn("clinic_name", invoice_data)
        self.assertIn("patient_names", invoice_data)
        self.assertIn("related_jobs", invoice_data)
        self.assertIn("is_overdue", invoice_data)
        self.assertIn("days_overdue", invoice_data)
        self.assertEqual(invoice_data["clinic_name"], "Test Clinic")
        self.assertIsInstance(invoice_data["patient_names"], list)
        self.assertIsInstance(invoice_data["related_jobs"], list)


class PatientContractTests(APITestCase):
    """Contract tests for patient endpoints."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Test Lab")
        self.user = User.objects.create_user(
            username="testuser",
            email="patient_contract@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Test Clinic")
        self.doctor = Doctor.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            first_name="John",
            last_name="Doe",
        )
        self.technician = Technician.objects.create(
            lab=self.lab,
            first_name="Tech",
            last_name="One",
        )

    def test_patient_list_response_contract(self):
        """Patient list response must include all critical fields."""
        Patient.objects.create(
            lab=self.lab,
            first_name="Jane",
            last_name="Doe",
            birth_number="900101/1234",
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("patient-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)

        patient = response.data[0]

        required_fields = [
            "id",
            "lab",
            "first_name",
            "last_name",
            "birth_number",
            "address",
            "phone",
            "email",
            "tooth_procedures",
            "created_at",
        ]
        for field in required_fields:
            self.assertIn(field, patient, f"Missing required field: {field}")

    def test_cumulative_tooth_map_response_contract(self):
        """Cumulative tooth map must return dictionary of tooth->procedure mappings."""
        patient = Patient.objects.create(
            lab=self.lab,
            first_name="Jane",
            last_name="Doe",
            birth_number="900101/1234",
        )
        Job.objects.create(
            lab=self.lab,
            patient=patient,
            clinic=self.clinic,
            doctor=self.doctor,
            technician=self.technician,
            status="completed",
            output_tooth_procedures={"11": "crown", "12": "bridge"},
        )

        self.client.force_authenticate(user=self.user)
        url = f"/api/crm/patients/{patient.id}/cumulative_tooth_map/"

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Must be a dictionary
        self.assertIsInstance(response.data, dict)

        # Tooth numbers as keys, procedures as values
        if response.data:
            for tooth, procedure in response.data.items():
                self.assertIsInstance(tooth, str)
                self.assertIsInstance(procedure, str)


class SubscriptionContractTests(APITestCase):
    """Contract tests for subscription endpoints."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Test Lab")
        self.user = User.objects.create_user(
            username="testuser",
            email="subscription_contract@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )
        self.subscription = Subscription.objects.create(
            lab=self.lab,
            plan="free",
            status="active",
            seats=5,
        )

    def test_subscription_my_response_contract(self):
        """GET /subscriptions/my must return subscription with critical fields."""
        self.client.force_authenticate(user=self.user)
        url = reverse("subscription-my")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        required_fields = [
            "id",
            "lab",
            "plan",
            "status",
            "seats",
            "created_at",
            "current_period_start",
            "current_period_end",
        ]
        for field in required_fields:
            self.assertIn(field, response.data, f"Missing required field: {field}")

        # Type validation
        self.assertIsInstance(response.data["id"], int)
        self.assertIsInstance(response.data["plan"], str)
        self.assertIsInstance(response.data["status"], str)
        self.assertIsInstance(response.data["seats"], int)


class WarehouseContractTests(APITestCase):
    """Contract tests for warehouse/inventory endpoints."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Test Lab")
        self.user = User.objects.create_user(
            username="testuser",
            email="warehouse_contract@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )

    def test_warehouse_item_list_response_contract(self):
        """Warehouse item list must include all inventory fields."""
        WarehouseItem.objects.create(
            lab=self.lab,
            name="Zircon blocks",
            sku="ZIR-001",
            quantity=50,
            unit="pcs",
            min_threshold=10,
            category="Materials",
            location="A1",
            supplier="Dental Supplier",
            cost_price=12.5,
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("warehouseitem-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(len(response.data), 0)

        item = response.data[0]

        required_fields = [
            "id",
            "lab",
            "name",
            "sku",
            "quantity",
            "unit",
            "min_threshold",
            "category",
            "location",
            "supplier",
            "cost_price",
            "notes",
            "created_at",
            "updated_at",
        ]
        for field in required_fields:
            self.assertIn(field, item, f"Missing required field: {field}")


class DashboardStatsContractTests(APITestCase):
    """Contract tests for GET /api/dashboard/stats/."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Stats Lab")
        self.clinic = Clinic.objects.create(lab=self.lab, name="Stats Clinic")
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Today",
            last_name="Patient",
            birth_number="900101/1111",
        )
        self.admin = User.objects.create_user(
            username="stats_admin",
            email="stats_admin@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )
        self.superadmin = User.objects.create_user(
            username="stats_superadmin",
            email="stats_superadmin@example.com",
            password="password123",
            role="superadmin",
            is_superuser=True,
        )

    def test_response_contract(self):
        """GET /api/dashboard/stats/ must return the expected fields."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/dashboard/stats/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        required = [
            "total_patients",
            "active_jobs",
            "completed_jobs",
            "total_revenue",
            "current_period",
            "monthly_totals",
            "deltas",
            "recent_jobs",
            "recent_invoices",
            "today_schedule",
        ]
        for field in required:
            self.assertIn(field, response.data, f"Missing field: {field}")

        self.assertIsInstance(response.data["total_patients"], int)
        self.assertIsInstance(response.data["active_jobs"], int)
        self.assertIsInstance(response.data["completed_jobs"], int)
        self.assertIsInstance(response.data["current_period"], dict)
        self.assertIn("start", response.data["current_period"])
        self.assertIn("end", response.data["current_period"])
        self.assertIsInstance(response.data["monthly_totals"], dict)
        self.assertIn("new_patients", response.data["monthly_totals"])
        self.assertIn("new_jobs", response.data["monthly_totals"])
        self.assertIn("revenue", response.data["monthly_totals"])
        self.assertIsInstance(response.data["deltas"], dict)
        self.assertIn("new_patients", response.data["deltas"])
        self.assertIn("new_jobs", response.data["deltas"])
        self.assertIn("revenue", response.data["deltas"])
        self.assertIsInstance(response.data["recent_jobs"], list)
        self.assertIsInstance(response.data["recent_invoices"], list)
        self.assertIsInstance(response.data["today_schedule"], list)

    def test_monthly_period_totals_include_current_month_activity(self):
        Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            status="new",
        )
        Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="DASH-MONTH-001",
            status="paid",
            total_amount="99.00",
            paid_at=timezone.now(),
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/dashboard/stats/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(response.data["monthly_totals"]["new_patients"], 1)
        self.assertGreaterEqual(response.data["monthly_totals"]["new_jobs"], 1)
        self.assertEqual(response.data["monthly_totals"]["revenue"], "99.00")

    def test_today_schedule_contains_due_open_jobs_only(self):
        """Today schedule must include due open jobs and exclude completed ones."""
        due_job = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            due_date=timezone.localdate(),
            status="in_progress",
        )
        Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            due_date=timezone.localdate(),
            status="completed",
        )

        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/dashboard/stats/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        schedule_ids = [item["id"] for item in response.data["today_schedule"]]
        self.assertIn(due_job.id, schedule_ids)
        self.assertEqual(len(response.data["today_schedule"]), 1)
        self.assertEqual(response.data["today_schedule"][0]["type"], "job")

    def test_unauthenticated_denied(self):
        """Unauthenticated requests must be rejected."""
        response = self.client.get("/api/dashboard/stats/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_no_lab_user_denied(self):
        """Users without a lab association must receive 403."""
        no_lab = User.objects.create_user(
            username="no_lab_stats",
            email="no_lab_stats@example.com",
            password="password123",
            role="user",
        )
        self.client.force_authenticate(user=no_lab)
        response = self.client.get("/api/dashboard/stats/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_receives_all_data(self):
        """Superadmin must get a 200 response (sees all labs)."""
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get("/api/dashboard/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
