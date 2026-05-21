from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import Invoice, InvoiceSequence, PriceList, Subscription
from apps.jobs.models import Job, Technician


class SubscriptionApiTests(APITestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Lab A")
        self.lab_b = Lab.objects.create(name="Lab B")

        self.superadmin = User.objects.create_user(
            username="superadmin",
            email="superadmin@example.com",
            password="password123",
            role="superadmin",
            is_superuser=True,
        )
        self.admin_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@example.com",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )
        self.user_b = User.objects.create_user(
            username="user_b",
            email="user_b@example.com",
            password="password123",
            role="user",
            lab=self.lab_b,
        )
        self.no_lab_user = User.objects.create_user(
            username="nolab",
            email="nolab@example.com",
            password="password123",
            role="user",
        )

        self.sub_a = Subscription.objects.create(
            lab=self.lab_a,
            plan="free",
            status="active",
            seats=5,
        )
        self.sub_b = Subscription.objects.create(
            lab=self.lab_b,
            plan="pro",
            status="active",
            seats=10,
        )

    def test_my_returns_current_users_lab_subscription(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/finance/subscriptions/my/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.sub_a.id)
        self.assertEqual(response.data["lab"], self.lab_a.id)

    def test_my_returns_404_when_user_has_no_lab(self):
        self.client.force_authenticate(user=self.no_lab_user)
        response = self.client.get("/api/finance/subscriptions/my/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["detail"], "No lab associated with user")

    def test_non_superadmin_cannot_list_subscriptions(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/finance/subscriptions/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_can_list_and_retrieve_subscriptions(self):
        self.client.force_authenticate(user=self.superadmin)

        list_response = self.client.get("/api/finance/subscriptions/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(list_response.data), 2)

        retrieve_response = self.client.get(
            f"/api/finance/subscriptions/{self.sub_b.id}/"
        )
        self.assertEqual(retrieve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(retrieve_response.data["id"], self.sub_b.id)

    def test_non_superadmin_cannot_update_subscription(self):
        self.client.force_authenticate(user=self.user_b)
        response = self.client.patch(
            f"/api/finance/subscriptions/{self.sub_b.id}/",
            {"plan": "enterprise"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class InvoiceLifecycleApiTests(APITestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Lab A")
        self.lab_b = Lab.objects.create(name="Lab B")

        self.superadmin = User.objects.create_user(
            username="superadmin",
            email="superadmin@example.com",
            password="password123",
            role="superadmin",
            is_superuser=True,
        )
        self.admin_a = User.objects.create_user(
            username="admin_a",
            email="admin_a@example.com",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )
        self.admin_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@example.com",
            password="password123",
            role="admin",
            lab=self.lab_b,
        )

        self.clinic_a = Clinic.objects.create(lab=self.lab_a, name="Clinic A")
        self.doctor_a = Doctor.objects.create(
            lab=self.lab_a,
            clinic=self.clinic_a,
            first_name="Doc",
            last_name="A",
        )
        self.patient_a = Patient.objects.create(
            lab=self.lab_a,
            first_name="Alice",
            last_name="Patient",
            birth_number="111111/1111",
        )
        self.tech_a = Technician.objects.create(
            lab=self.lab_a,
            first_name="Tech",
            last_name="A",
        )

        self.clinic_b = Clinic.objects.create(lab=self.lab_b, name="Clinic B")
        self.doctor_b = Doctor.objects.create(
            lab=self.lab_b,
            clinic=self.clinic_b,
            first_name="Doc",
            last_name="B",
        )
        self.patient_b = Patient.objects.create(
            lab=self.lab_b,
            first_name="Bob",
            last_name="Patient",
            birth_number="222222/2222",
        )
        self.tech_b = Technician.objects.create(
            lab=self.lab_b,
            first_name="Tech",
            last_name="B",
        )

        self.job_a1 = Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.tech_a,
            status="completed",
            price="120.00",
            procedure_codes=["CROWN"],
            procedure_quantities={"CROWN": 2},
            description="Crowns",
        )
        self.job_a2 = Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.tech_a,
            status="completed",
            price="80.00",
            description="Repair",
        )
        self.job_b = Job.objects.create(
            lab=self.lab_b,
            patient=self.patient_b,
            clinic=self.clinic_b,
            doctor=self.doctor_b,
            technician=self.tech_b,
            status="completed",
            price="90.00",
            description="Other lab",
        )

    def test_create_invoice_from_jobs_generates_items_enriched_payload_and_marks_jobs_factured(
        self,
    ):
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.post(
            "/api/finance/invoices/",
            {
                "clinic_id": self.clinic_a.id,
                "job_ids": [self.job_a1.id, self.job_a2.id],
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["status"], "issued")
        self.assertEqual(response.data["clinic_name"], "Clinic A")
        self.assertIn("Alice Patient", response.data["patient_names"])
        self.assertEqual(response.data["subtotal_amount"], "320.00")
        self.assertEqual(response.data["vat_amount"], "0.00")
        self.assertFalse(response.data["is_overdue"])
        self.assertEqual(response.data["days_overdue"], 0)
        self.assertEqual(
            response.data["related_jobs"],
            [
                {
                    "id": self.job_a1.id,
                    "status": "finished_factured",
                    "description": "Crowns",
                    "patient_name": "Alice Patient",
                    "due_date": None,
                },
                {
                    "id": self.job_a2.id,
                    "status": "finished_factured",
                    "description": "Repair",
                    "patient_name": "Alice Patient",
                    "due_date": None,
                },
            ],
        )
        self.assertGreaterEqual(len(response.data["items"]), 2)

        self.job_a1.refresh_from_db()
        self.job_a2.refresh_from_db()
        self.assertEqual(self.job_a1.status, "finished_factured")
        self.assertEqual(self.job_a2.status, "finished_factured")

    def test_create_invoice_uses_lab_billing_defaults(self):
        self.lab_a.invoice_prefix = "MOL"
        self.lab_a.invoice_due_days = 21
        self.lab_a.vat_rate = "20.00"
        self.lab_a.save(
            update_fields=["invoice_prefix", "invoice_due_days", "vat_rate"]
        )
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.post(
            "/api/finance/invoices/",
            {"clinic_id": self.clinic_a.id, "job_ids": [self.job_a2.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(response.data["number"].startswith("MOL-"))
        self.assertEqual(
            response.data["due_date"],
            (timezone.localdate() + timezone.timedelta(days=21)).isoformat(),
        )
        self.assertEqual(response.data["subtotal_amount"], "80.00")
        self.assertEqual(response.data["vat_amount"], "16.00")
        self.assertEqual(response.data["total_amount"], "96.00")

    def test_status_transition_syncs_job_statuses(self):
        self.client.force_authenticate(user=self.admin_a)

        create_resp = self.client.post(
            "/api/finance/invoices/",
            {"clinic_id": self.clinic_a.id, "job_ids": [self.job_a1.id]},
            format="json",
        )
        invoice_id = create_resp.data["id"]

        paid_resp = self.client.put(
            f"/api/finance/invoices/{invoice_id}/status/",
            {"status": "paid"},
            format="json",
        )
        self.assertEqual(paid_resp.status_code, status.HTTP_200_OK)
        self.job_a1.refresh_from_db()
        self.assertEqual(self.job_a1.status, "closed")

        cancelled_resp = self.client.put(
            f"/api/finance/invoices/{invoice_id}/status/",
            {"status": "cancelled"},
            format="json",
        )
        self.assertEqual(cancelled_resp.status_code, status.HTTP_200_OK)
        self.job_a1.refresh_from_db()
        self.assertEqual(self.job_a1.status, "finished_unfactured")

    def test_qr_and_pdf_endpoints(self):
        self.client.force_authenticate(user=self.admin_a)
        create_resp = self.client.post(
            "/api/finance/invoices/",
            {"clinic_id": self.clinic_a.id, "job_ids": [self.job_a1.id]},
            format="json",
        )
        invoice_id = create_resp.data["id"]

        qr_resp = self.client.get(f"/api/finance/invoices/{invoice_id}/qr/")
        self.assertEqual(qr_resp.status_code, status.HTTP_200_OK)
        self.assertIn("image/svg+xml", qr_resp["Content-Type"])

        pdf_resp = self.client.get(f"/api/finance/invoices/{invoice_id}/pdf/")
        self.assertEqual(pdf_resp.status_code, status.HTTP_200_OK)
        self.assertIn("application/pdf", pdf_resp["Content-Type"])
        self.assertTrue(pdf_resp.content.startswith(b"%PDF"))

    def test_non_superadmin_cannot_create_invoice_for_other_lab(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(
            "/api/finance/invoices/",
            {"clinic_id": self.clinic_b.id, "job_ids": [self.job_b.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_can_create_cross_lab_invoice(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.post(
            "/api/finance/invoices/",
            {"clinic_id": self.clinic_b.id, "job_ids": [self.job_b.id]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["clinic_name"], "Clinic B")

    def test_invoice_serializer_exposes_overdue_fields(self):
        self.client.force_authenticate(user=self.admin_a)
        create_resp = self.client.post(
            "/api/finance/invoices/",
            {"clinic_id": self.clinic_a.id, "job_ids": [self.job_a2.id]},
            format="json",
        )
        invoice = Invoice.objects.get(id=create_resp.data["id"])
        invoice.due_date = timezone.localdate() - timezone.timedelta(days=3)
        invoice.save(update_fields=["due_date"])

        response = self.client.get(f"/api/finance/invoices/{invoice.id}/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data["is_overdue"])
        self.assertEqual(response.data["days_overdue"], 3)


class PriceListCrudApiTests(APITestCase):
    """Test CRUD operations for PriceList model."""

    def setUp(self):
        self.lab_a = Lab.objects.create(name="Lab A")
        self.lab_b = Lab.objects.create(name="Lab B")

        self.admin_a = User.objects.create_user(
            username="admin_a",
            email="pricelist_admin_a@example.com",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )
        self.admin_b = User.objects.create_user(
            username="admin_b",
            email="pricelist_admin_b@example.com",
            password="password123",
            role="admin",
            lab=self.lab_b,
        )
        self.superadmin = User.objects.create_user(
            username="pricelist_superadmin",
            email="pricelist_superadmin@example.com",
            password="password123",
            role="superadmin",
            is_superuser=True,
        )

    def test_create_price_list_item(self):
        """Test creating a new price list item."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("pricelist-list")
        payload = {
            "code": "CROWN123",
            "description": "Test item",
            "price": 12.5,
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["code"], "CROWN123")
        self.assertEqual(response.data["description"], "Test item")
        self.assertEqual(float(response.data["price"]), 12.5)
        self.assertEqual(response.data["lab"], self.lab_a.id)

    def test_superadmin_can_create_price_list_item_for_selected_lab(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.post(
            reverse("pricelist-list"),
            {
                "lab": self.lab_b.id,
                "code": "SUPER-001",
                "description": "Superadmin item",
                "price": 99.0,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["lab"], self.lab_b.id)

    def test_list_price_list_items(self):
        """Test listing price list items scoped to lab."""
        PriceList.objects.create(
            lab=self.lab_a,
            code="ITEM-A1",
            description="Item A1",
            price=10.0,
        )
        PriceList.objects.create(
            lab=self.lab_a,
            code="ITEM-A2",
            description="Item A2",
            price=20.0,
        )
        PriceList.objects.create(
            lab=self.lab_b,
            code="ITEM-B1",
            description="Item B1",
            price=30.0,
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse("pricelist-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)  # Only lab_a items

    def test_superadmin_lists_price_list_items_across_labs(self):
        PriceList.objects.create(
            lab=self.lab_a,
            code="ITEM-A1",
            description="Item A1",
            price=10.0,
        )
        PriceList.objects.create(
            lab=self.lab_b,
            code="ITEM-B1",
            description="Item B1",
            price=30.0,
        )

        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get(reverse("pricelist-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_duplicate_price_list_code_allowed_across_labs(self):
        PriceList.objects.create(
            lab=self.lab_a,
            code="DUP",
            description="Lab A item",
            price=10.0,
        )

        self.client.force_authenticate(user=self.admin_b)
        response = self.client.post(
            reverse("pricelist-list"),
            {"code": "DUP", "description": "Lab B item", "price": 20.0},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["lab"], self.lab_b.id)

    def test_duplicate_price_list_code_rejected_within_lab(self):
        PriceList.objects.create(
            lab=self.lab_a,
            code="DUP",
            description="Lab A item",
            price=10.0,
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(
            reverse("pricelist-list"),
            {"code": "DUP", "description": "Second item", "price": 20.0},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_get_price_list_item(self):
        """Test retrieving a specific price list item."""
        item = PriceList.objects.create(
            lab=self.lab_a,
            code="TEST-001",
            description="Test item",
            price=15.0,
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse("pricelist-detail", args=[item.id])

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["code"], "TEST-001")

    def test_update_price_list_item(self):
        """Test updating a price list item."""
        item = PriceList.objects.create(
            lab=self.lab_a,
            code="UPDATE-001",
            description="Test item",
            price=12.5,
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse("pricelist-detail", args=[item.id])
        payload = {
            "code": "UPDATE-001",
            "description": "Updated description",
            "price": 15.0,
        }

        response = self.client.put(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["description"], "Updated description")
        self.assertEqual(float(response.data["price"]), 15.0)

    def test_delete_price_list_item(self):
        """Test deleting a price list item."""
        item = PriceList.objects.create(
            lab=self.lab_a,
            code="DEL-001",
            description="Test item",
            price=10.0,
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse("pricelist-detail", args=[item.id])

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify deletion
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_lab_access_denied(self):
        """Test that users cannot access price list items from other labs."""
        item_b = PriceList.objects.create(
            lab=self.lab_b,
            code="LAB-B-001",
            description="Lab B item",
            price=5.0,
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse("pricelist-detail", args=[item_b.id])

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_duplicate_price_list_item_creates_copy_in_same_lab(self):
        item = PriceList.objects.create(
            lab=self.lab_a,
            code="CROWN",
            description="Zircon crown",
            price=150.0,
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(reverse("pricelist-duplicate", args=[item.id]))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["lab"], self.lab_a.id)
        self.assertEqual(response.data["code"], "CROWN-COPY")
        self.assertEqual(response.data["description"], "Zircon crown")
        self.assertEqual(float(response.data["price"]), 150.0)

    def test_duplicate_price_list_item_generates_unique_copy_code(self):
        item = PriceList.objects.create(
            lab=self.lab_a,
            code="CROWN",
            description="Zircon crown",
            price=150.0,
        )
        PriceList.objects.create(
            lab=self.lab_a,
            code="CROWN-COPY",
            description="Existing copy",
            price=150.0,
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(reverse("pricelist-duplicate", args=[item.id]))

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["code"], "CROWN-COPY-2")

    def test_duplicate_price_list_item_respects_lab_scope(self):
        item_b = PriceList.objects.create(
            lab=self.lab_b,
            code="LAB-B",
            description="Other lab item",
            price=10.0,
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(reverse("pricelist-duplicate", args=[item_b.id]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class FinanceStatsViewTests(APITestCase):
    """Tests for GET /api/finance/stats/."""

    def setUp(self):
        self.lab_a = Lab.objects.create(name="Finance Lab A")
        self.lab_b = Lab.objects.create(name="Finance Lab B")
        self.admin_a = User.objects.create_user(
            username="fin_admin_a",
            email="fin_admin_a@example.com",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )
        self.admin_b = User.objects.create_user(
            username="fin_admin_b",
            email="fin_admin_b@example.com",
            password="password123",
            role="admin",
            lab=self.lab_b,
        )
        self.superadmin = User.objects.create_user(
            username="fin_superadmin",
            email="fin_superadmin@example.com",
            password="password123",
            role="superadmin",
            is_superuser=True,
        )

    def _get_stats(self, user):
        self.client.force_authenticate(user=user)
        return self.client.get("/api/finance/stats/")

    def test_response_contract(self):
        """Response must contain all required fields with correct types."""
        response = self._get_stats(self.admin_a)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        required = [
            "total_revenue",
            "pending_invoices",
            "overdue_invoices",
            "overdue_amount",
            "average_payment_days",
            "top_clinics",
            "monthly_growth_pct",
            "monthly_revenue",
        ]
        for field in required:
            self.assertIn(field, response.data, f"Missing field: {field}")

        self.assertIsInstance(response.data["pending_invoices"], int)
        self.assertIsInstance(response.data["overdue_invoices"], int)
        self.assertIsInstance(response.data["overdue_amount"], str)
        self.assertIsInstance(response.data["average_payment_days"], float)
        self.assertIsInstance(response.data["top_clinics"], list)
        self.assertIsInstance(response.data["monthly_revenue"], list)
        self.assertEqual(len(response.data["monthly_revenue"]), 6)

        for entry in response.data["monthly_revenue"]:
            self.assertIn("month", entry)
            self.assertIn("revenue", entry)
            # Revenue must be a string (Decimal-safe serialization)
            self.assertIsInstance(entry["revenue"], str)

    def test_unauthenticated_denied(self):
        response = self.client.get("/api/finance/stats/")
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_no_lab_user_denied(self):
        no_lab = User.objects.create_user(
            username="fin_no_lab",
            email="fin_no_lab@example.com",
            password="password123",
            role="user",
        )
        self.client.force_authenticate(user=no_lab)
        response = self.client.get("/api/finance/stats/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_lab_scoping(self):
        """Lab A admin must not see lab B invoice revenue."""
        clinic_b = Clinic.objects.create(lab=self.lab_b, name="Clinic B")
        Invoice.objects.create(
            lab=self.lab_b,
            clinic=clinic_b,
            number="INV-B-001",
            status="paid",
            total_amount="500.00",
        )

        response = self._get_stats(self.admin_a)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        # Lab A has no paid invoices — revenue must be zero
        self.assertEqual(response.data["total_revenue"], "0.00")

    def test_superadmin_sees_all_labs(self):
        """Superadmin must receive 200 and aggregate across all labs."""
        response = self._get_stats(self.superadmin)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_overdue_average_payment_and_top_clinics(self):
        clinic_a = Clinic.objects.create(lab=self.lab_a, name="Clinic A")
        clinic_b = Clinic.objects.create(lab=self.lab_a, name="Clinic B")
        other_lab_clinic = Clinic.objects.create(lab=self.lab_b, name="Other Lab")
        now = timezone.now()

        Invoice.objects.create(
            lab=self.lab_a,
            clinic=clinic_a,
            number="INV-PAID-A",
            status="paid",
            total_amount="100.00",
            issued_at=now - timezone.timedelta(days=8),
            paid_at=now - timezone.timedelta(days=2),
        )
        Invoice.objects.create(
            lab=self.lab_a,
            clinic=clinic_a,
            number="INV-PAID-B",
            status="paid",
            total_amount="50.00",
            issued_at=now - timezone.timedelta(days=5),
            paid_at=now - timezone.timedelta(days=1),
        )
        Invoice.objects.create(
            lab=self.lab_a,
            clinic=clinic_b,
            number="INV-PAID-C",
            status="paid",
            total_amount="25.00",
            issued_at=now - timezone.timedelta(days=3),
            paid_at=now - timezone.timedelta(days=1),
        )
        Invoice.objects.create(
            lab=self.lab_a,
            clinic=clinic_b,
            number="INV-OVERDUE",
            status="issued",
            total_amount="80.00",
            due_date=timezone.localdate() - timezone.timedelta(days=1),
        )
        Invoice.objects.create(
            lab=self.lab_b,
            clinic=other_lab_clinic,
            number="INV-OTHER-LAB",
            status="paid",
            total_amount="999.00",
            issued_at=now - timezone.timedelta(days=3),
            paid_at=now,
        )

        response = self._get_stats(self.admin_a)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["overdue_invoices"], 1)
        self.assertEqual(response.data["overdue_amount"], "80.00")
        self.assertEqual(response.data["average_payment_days"], 4.0)
        self.assertEqual(
            response.data["top_clinics"],
            [
                {
                    "clinic_id": clinic_a.id,
                    "clinic_name": "Clinic A",
                    "revenue": "150.00",
                },
                {
                    "clinic_id": clinic_b.id,
                    "clinic_name": "Clinic B",
                    "revenue": "25.00",
                },
            ],
        )


class InvoiceSequenceTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Seq Lab", invoice_prefix="FAK")
        self.clinic = Clinic.objects.create(lab=self.lab, name="Clinic")
        patient = Patient.objects.create(lab=self.lab, first_name="A", last_name="B")
        self.job = Job.objects.create(
            lab=self.lab,
            patient=patient,
            clinic=self.clinic,
            status="completed",
        )
        self.admin = User.objects.create_user(
            username="seq_admin",
            email="seq_admin@example.com",
            password="pass",
            role="admin",
            lab=self.lab,
        )

    def _create_invoice(self):
        self.client.force_authenticate(user=self.admin)
        return self.client.post(
            "/api/invoices/",
            {"clinic_id": self.clinic.id, "job_ids": [self.job.id]},
            format="json",
        )

    def test_invoice_number_uses_prefix_and_year(self):
        from django.utils import timezone

        resp = self._create_invoice()
        self.assertEqual(resp.status_code, 201)
        year = timezone.now().year
        self.assertTrue(
            resp.data["number"].startswith(f"FAK-{year}-"),
            f"Expected FAK-{year}-NNNN, got {resp.data['number']}",
        )

    def test_sequential_numbers_increment(self):
        resp1 = self._create_invoice()
        self.job2 = Job.objects.create(
            lab=self.lab,
            patient=Patient.objects.get(lab=self.lab),
            clinic=self.clinic,
            status="completed",
        )
        self.job = self.job2
        resp2 = self._create_invoice()
        num1 = int(resp1.data["number"].split("-")[-1])
        num2 = int(resp2.data["number"].split("-")[-1])
        self.assertEqual(num2, num1 + 1)

    def test_sequence_row_created_per_lab(self):
        self._create_invoice()
        self.assertTrue(InvoiceSequence.objects.filter(lab=self.lab).exists())
        seq = InvoiceSequence.objects.get(lab=self.lab)
        self.assertEqual(seq.last_number, 1)


class ProcedureCatalogTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Catalog Lab")
        self.admin = User.objects.create_user(
            username="cat_admin",
            email="cat_admin@example.com",
            password="pass",
            role="admin",
            lab=self.lab,
        )
        self.other_lab = Lab.objects.create(name="Other Lab")
        self.other_user = User.objects.create_user(
            username="other_u",
            email="other_u@example.com",
            password="pass",
            role="user",
            lab=self.other_lab,
        )
        PriceList.objects.create(
            lab=self.lab, code="C001", description="Full crown", price="150.00",
            category="crown"
        )
        PriceList.objects.create(
            lab=self.lab, code="B001", description="3-unit bridge", price="400.00",
            category="bridge"
        )
        PriceList.objects.create(
            lab=self.lab, code="X001", description="Misc", price="50.00",
            category=None
        )
        PriceList.objects.create(
            lab=self.other_lab, code="C001", description="Other crown", price="200.00",
            category="crown"
        )

    def test_catalog_returns_own_lab_items_grouped(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/procedure-catalog/")
        self.assertEqual(resp.status_code, 200)
        categories = {g["category"] for g in resp.data}
        self.assertIn("crown", categories)
        self.assertIn("bridge", categories)
        crown_group = next(g for g in resp.data if g["category"] == "crown")
        self.assertEqual(len(crown_group["items"]), 1)
        self.assertEqual(crown_group["items"][0]["code"], "C001")

    def test_catalog_excludes_other_lab_items(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/procedure-catalog/")
        all_ids = [i["id"] for g in resp.data for i in g["items"]]
        other_ids = list(
            PriceList.objects.filter(lab=self.other_lab).values_list("id", flat=True)
        )
        for oid in other_ids:
            self.assertNotIn(oid, all_ids)

    def test_uncategorized_items_grouped_separately(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/procedure-catalog/")
        uncat_group = next((g for g in resp.data if g["category"] is None), None)
        self.assertIsNotNone(uncat_group)
        self.assertEqual(uncat_group["label"], "Uncategorized")
        self.assertEqual(len(uncat_group["items"]), 1)

    def test_unauthenticated_returns_401(self):
        resp = self.client.get("/api/finance/procedure-catalog/")
        self.assertEqual(resp.status_code, 401)


class InvoiceCSVExportTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Export Lab")
        self.other_lab = Lab.objects.create(name="Other Lab")
        self.clinic = Clinic.objects.create(lab=self.lab, name="Klinika A")
        self.other_clinic = Clinic.objects.create(lab=self.other_lab, name="Other Clinic")
        self.admin = User.objects.create_user(
            username="export_admin",
            email="export_admin@example.com",
            password="pass",
            role="admin",
            lab=self.lab,
        )
        from django.utils import timezone

        now = timezone.now()
        Invoice.objects.create(
            lab=self.lab, clinic=self.clinic, number="EXP-001",
            status="paid", total_amount="100.00", issued_at=now, paid_at=now,
        )
        Invoice.objects.create(
            lab=self.lab, clinic=self.clinic, number="EXP-002",
            status="issued", total_amount="200.00", issued_at=now,
        )
        Invoice.objects.create(
            lab=self.other_lab, clinic=self.other_clinic, number="OTHER-001",
            status="paid", total_amount="999.00",
        )

    def test_export_returns_csv(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/invoices/export/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["Content-Type"], "text/csv")
        content = resp.content.decode("utf-8")
        self.assertIn("number", content)
        self.assertIn("EXP-001", content)
        self.assertIn("EXP-002", content)

    def test_export_excludes_other_lab(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/invoices/export/")
        content = resp.content.decode("utf-8")
        self.assertNotIn("OTHER-001", content)

    def test_export_status_filter(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/invoices/export/?status=paid")
        content = resp.content.decode("utf-8")
        self.assertIn("EXP-001", content)
        self.assertNotIn("EXP-002", content)

    def test_export_unauthenticated_returns_401(self):
        resp = self.client.get("/api/finance/invoices/export/")
        self.assertEqual(resp.status_code, 401)
