from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import Invoice, PriceList, Subscription
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
        self.assertGreaterEqual(len(response.data["items"]), 2)

        self.job_a1.refresh_from_db()
        self.job_a2.refresh_from_db()
        self.assertEqual(self.job_a1.status, "finished_factured")
        self.assertEqual(self.job_a2.status, "finished_factured")

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
            "monthly_growth_pct",
            "monthly_revenue",
        ]
        for field in required:
            self.assertIn(field, response.data, f"Missing field: {field}")

        self.assertIsInstance(response.data["pending_invoices"], int)
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
