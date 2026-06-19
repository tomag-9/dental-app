from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.core.test_helpers import RoleMatrixTestMixin
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import PriceList
from apps.jobs.models import Job, JobItem, JobTimelineEvent, Technician
from apps.jobs.views import JobViewSet


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
        self.regular_a = User.objects.create_user(
            username="job_regular_a",
            email="job_regular_a@test.com",
            password="password123",
            role="user",
            lab=self.lab_a,
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

    def test_regular_user_cannot_create_job(self):
        self.client.force_authenticate(user=self.regular_a)
        response = self.client.post(
            reverse("job-list"),
            {
                "patient": self.patient_a.id,
                "clinic": self.clinic_a.id,
                "doctor": self.doctor_a.id,
                "technician": self.technician_a.id,
                "price": 150.0,
                "description": "Forbidden job",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Job.objects.filter(description="Forbidden job").exists())

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
        self.assertIn("v rozsahu mostíka", str(response.data))

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

    def test_status_config_matches_enforced_transitions(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/jobs/jobs/status-config/")
        self.assertEqual(resp.status_code, 200)
        for status_name, allowed in JobViewSet.allowed_transitions.items():
            self.assertCountEqual(
                resp.data[status_name]["allowed_transitions"],
                allowed,
            )


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


class JobRoleMatrixTests(RoleMatrixTestMixin, APITestCase):
    """
    Full role matrix coverage for Job endpoints.

    Covers: anonymous 401, no_lab, user, technician, admin, superadmin
    for list, create, retrieve, update, delete, and transition-status.
    """

    def setUp(self):
        self.setup_role_matrix(prefix="job_matrix")
        self.clinic = Clinic.objects.create(lab=self.lab_a, name="Job Matrix Clinic")
        self.doctor = Doctor.objects.create(
            lab=self.lab_a,
            clinic=self.clinic,
            first_name="Job",
            last_name="Doctor",
        )
        self.patient = Patient.objects.create(
            lab=self.lab_a,
            first_name="Job",
            last_name="Patient",
            birth_number="8001021234",
        )
        self.technician_obj = Technician.objects.create(
            lab=self.lab_a,
            first_name="Job",
            last_name="Technician",
        )
        self.job = Job.objects.create(
            lab=self.lab_a,
            patient=self.patient,
            clinic=self.clinic,
            doctor=self.doctor,
            technician=self.technician_obj,
            status="new",
            description="Matrix job",
            price="100.00",
        )

    def _job_payload(self, role):
        return {
            "lab": self.lab_a.id,
            "patient": self.patient.id,
            "clinic": self.clinic.id,
            "doctor": self.doctor.id,
            "price": "100.00",
            "description": f"Created by {role}",
        }

    def _fresh_job(self):
        return Job.objects.create(
            lab=self.lab_a,
            patient=self.patient,
            clinic=self.clinic,
            doctor=self.doctor,
            technician=self.technician_obj,
            status="new",
            description="Fresh job for delete",
            price="100.00",
        )

    # ── List ─────────────────────────────────────────────────────────────────

    def test_job_list_role_matrix(self):
        self.assert_endpoint_matrix(
            "GET",
            "/api/jobs/jobs/",
            {
                "anonymous": status.HTTP_401_UNAUTHORIZED,
                "no_lab": status.HTTP_200_OK,
                "user": status.HTTP_200_OK,
                "technician": status.HTTP_200_OK,
                "admin": status.HTTP_200_OK,
                "superadmin": status.HTTP_200_OK,
            },
        )

    # ── Create ───────────────────────────────────────────────────────────────

    def test_job_create_role_matrix(self):
        # anonymous
        resp = self.client.post(
            "/api/jobs/jobs/",
            self._job_payload("anonymous"),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

        deny_roles = ["no_lab", "user", "technician"]
        for role in deny_roles:
            with self.subTest(role=role):
                self.client.force_authenticate(user=self.role_users[role])
                resp = self.client.post(
                    "/api/jobs/jobs/",
                    self._job_payload(role),
                    format="json",
                )
                self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
                self.client.force_authenticate(user=None)

        for role in ["admin", "superadmin"]:
            with self.subTest(role=role):
                self.client.force_authenticate(user=self.role_users[role])
                resp = self.client.post(
                    "/api/jobs/jobs/",
                    self._job_payload(role),
                    format="json",
                )
                self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
                self.client.force_authenticate(user=None)

    # ── Retrieve ─────────────────────────────────────────────────────────────

    def test_job_retrieve_role_matrix(self):
        self.assert_endpoint_matrix(
            "GET",
            f"/api/jobs/jobs/{self.job.id}/",
            {
                "anonymous": status.HTTP_401_UNAUTHORIZED,
                "no_lab": status.HTTP_404_NOT_FOUND,
                "user": status.HTTP_200_OK,
                "technician": status.HTTP_200_OK,
                "admin": status.HTTP_200_OK,
                "superadmin": status.HTTP_200_OK,
            },
        )

    # ── Update ───────────────────────────────────────────────────────────────

    def test_job_update_role_matrix(self):
        # no_lab gets 403 (permission check fires before queryset scoping for writes)
        self.assert_endpoint_matrix(
            "PATCH",
            f"/api/jobs/jobs/{self.job.id}/",
            {
                "anonymous": status.HTTP_401_UNAUTHORIZED,
                "no_lab": status.HTTP_403_FORBIDDEN,
                "user": status.HTTP_403_FORBIDDEN,
                "technician": status.HTTP_403_FORBIDDEN,
                "admin": status.HTTP_200_OK,
                "superadmin": status.HTTP_200_OK,
            },
            data={"description": "Updated description"},
            format="json",
        )

    # ── Delete ───────────────────────────────────────────────────────────────

    def test_job_delete_role_matrix(self):
        def _delete_matrix(role):
            j = self._fresh_job()
            self.client.force_authenticate(user=self.role_users[role])
            resp = self.client.delete(f"/api/jobs/jobs/{j.id}/")
            self.client.force_authenticate(user=None)
            return resp

        # anonymous
        resp = self.client.delete(f"/api/jobs/jobs/{self.job.id}/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

        # no_lab gets 403 (permission check fires before queryset scoping for writes)
        expectations = {
            "no_lab": status.HTTP_403_FORBIDDEN,
            "user": status.HTTP_403_FORBIDDEN,
            "technician": status.HTTP_403_FORBIDDEN,
            "admin": status.HTTP_204_NO_CONTENT,
            "superadmin": status.HTTP_204_NO_CONTENT,
        }
        for role, expected in expectations.items():
            with self.subTest(role=role):
                resp = _delete_matrix(role)
                self.assertEqual(resp.status_code, expected, f"DELETE job as {role}")

    # ── transition-status ────────────────────────────────────────────────────

    def test_job_transition_status_role_matrix(self):
        def _transition_matrix(role):
            j = Job.objects.create(
                lab=self.lab_a,
                patient=self.patient,
                clinic=self.clinic,
                doctor=self.doctor,
                status="new",
                description=f"Transition job {role}",
                price="100.00",
            )
            self.client.force_authenticate(user=self.role_users[role])
            resp = self.client.post(
                f"/api/jobs/jobs/{j.id}/transition-status/",
                {"status": "in_progress"},
                format="json",
            )
            self.client.force_authenticate(user=None)
            return resp

        # anonymous — use the shared job
        j_anon = self._fresh_job()
        resp = self.client.post(
            f"/api/jobs/jobs/{j_anon.id}/transition-status/",
            {"status": "in_progress"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

        # no_lab gets 403 (permission check fires before queryset scoping for writes)
        expectations = {
            "no_lab": status.HTTP_403_FORBIDDEN,
            "user": status.HTTP_403_FORBIDDEN,
            "technician": status.HTTP_403_FORBIDDEN,
            "admin": status.HTTP_200_OK,
            "superadmin": status.HTTP_200_OK,
        }
        for role, expected in expectations.items():
            with self.subTest(role=role):
                resp = _transition_matrix(role)
                self.assertEqual(
                    resp.status_code, expected, f"transition-status as {role}"
                )
