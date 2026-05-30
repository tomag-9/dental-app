from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.calculations import calculate_invoice_amounts
from apps.finance.models import Invoice
from apps.jobs.models import Job, Technician


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
            "aging",
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


class InvoiceVatRateSnapshotTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(
            name="VAT Lab", invoice_prefix="VAT", vat_rate="20.00"
        )
        self.user = User.objects.create_user(
            username="vat_user", password="pw", role="admin", lab=self.lab
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="VAT Clinic")
        self.doctor = Doctor.objects.create(
            lab=self.lab, clinic=self.clinic, first_name="D", last_name="R"
        )
        self.patient = Patient.objects.create(
            lab=self.lab, first_name="V", last_name="T", birth_number="900101/0007"
        )
        self.tech = Technician.objects.create(
            lab=self.lab, first_name="T", last_name="T"
        )

    def test_vat_rate_snapshot_stored_at_creation(self):
        from apps.jobs.models import Job

        job = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            doctor=self.doctor,
            patient=self.patient,
            technician=self.tech,
            status="completed",
            price="100.00",
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/finance/invoices/",
            {
                "clinic_id": self.clinic.id,
                "job_ids": [job.id],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["vat_rate"], "20.00")
        # total = 100 + 20% VAT = 120
        self.assertEqual(resp.data["total_amount"], "120.00")

    def test_vat_rate_in_serializer_response(self):
        from apps.finance.models import Invoice

        inv = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="VAT-2026-001",
            status="draft",
            vat_rate="20.00",
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/finance/invoices/{inv.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("vat_rate", resp.data)
        self.assertEqual(resp.data["vat_rate"], "20.00")

    def test_invoice_amounts_without_vat_or_discount(self):
        amounts = calculate_invoice_amounts("100.00", vat_rate="0.00")

        self.assertEqual(amounts["subtotal_amount"], 100)
        self.assertEqual(amounts["discount_amount"], 0)
        self.assertEqual(amounts["taxable_amount"], 100)
        self.assertEqual(amounts["vat_amount"], 0)
        self.assertEqual(amounts["total_amount"], 100)

    def test_invoice_amounts_with_vat_and_no_discount(self):
        amounts = calculate_invoice_amounts("100.00", vat_rate="20.00")

        self.assertEqual(amounts["subtotal_amount"], 100)
        self.assertEqual(amounts["discount_amount"], 0)
        self.assertEqual(amounts["taxable_amount"], 100)
        self.assertEqual(amounts["vat_amount"], 20)
        self.assertEqual(amounts["total_amount"], 120)

    def test_invoice_amounts_with_vat_and_discount(self):
        amounts = calculate_invoice_amounts(
            "100.00", vat_rate="20.00", discount_percent="10.00"
        )

        self.assertEqual(amounts["subtotal_amount"], 100)
        self.assertEqual(amounts["discount_amount"], 10)
        self.assertEqual(amounts["taxable_amount"], 90)
        self.assertEqual(amounts["vat_amount"], 18)
        self.assertEqual(amounts["total_amount"], 108)

    def test_serializer_vat_amount_uses_discounted_tax_base(self):
        job = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            doctor=self.doctor,
            patient=self.patient,
            technician=self.tech,
            status="completed",
            price="100.00",
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/finance/invoices/",
            {
                "clinic_id": self.clinic.id,
                "job_ids": [job.id],
                "discount_percent": "10.00",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["subtotal_amount"], "100.00")
        self.assertEqual(resp.data["vat_amount"], "18.00")
        self.assertEqual(resp.data["total_amount"], "108.00")


class MultiProcedurePricingTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Pricing Lab", invoice_prefix="PRC")
        self.user = User.objects.create_user(
            username="pricing_user", password="pw", role="admin", lab=self.lab
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Pricing Clinic")
        self.doctor = Doctor.objects.create(
            lab=self.lab, clinic=self.clinic, first_name="D", last_name="R"
        )
        self.patient = Patient.objects.create(
            lab=self.lab, first_name="P", last_name="Q", birth_number="900101/0007"
        )
        self.tech = Technician.objects.create(
            lab=self.lab, first_name="T", last_name="T"
        )
        from apps.finance.models import PriceList

        PriceList.objects.create(
            lab=self.lab, code="C001", description="Crown", price="150.00"
        )
        PriceList.objects.create(
            lab=self.lab, code="C002", description="Bridge", price="300.00"
        )

    def _make_job(self, procedure_codes, quantities=None):
        from apps.jobs.models import Job

        return Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            doctor=self.doctor,
            patient=self.patient,
            technician=self.tech,
            status="completed",
            description="Test",
            procedure_codes=procedure_codes,
            procedure_quantities=quantities or {},
        )

    def test_single_procedure_uses_job_price(self):
        from apps.jobs.models import Job

        job = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            doctor=self.doctor,
            patient=self.patient,
            technician=self.tech,
            status="completed",
            price="200.00",
            procedure_codes=["C001"],
            procedure_quantities={"C001": 1},
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/finance/invoices/",
            {
                "clinic_id": self.clinic.id,
                "job_ids": [job.id],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        item = resp.data["items"][0]
        self.assertEqual(item["unit_price"], "200.00")

    def test_multi_procedure_looks_up_pricelist(self):
        job = self._make_job(["C001", "C002"], {"C001": 1, "C002": 2})
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/finance/invoices/",
            {
                "clinic_id": self.clinic.id,
                "job_ids": [job.id],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        by_desc = {i["description"]: i for i in resp.data["items"]}
        self.assertIn("Crown", by_desc)
        self.assertIn("Bridge", by_desc)
        self.assertEqual(by_desc["Crown"]["unit_price"], "150.00")
        self.assertEqual(by_desc["Bridge"]["unit_price"], "300.00")

    def test_multi_procedure_unknown_code_gets_zero(self):
        job = self._make_job(["C001", "UNKNOWN"], {"C001": 1, "UNKNOWN": 1})
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/finance/invoices/",
            {
                "clinic_id": self.clinic.id,
                "job_ids": [job.id],
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        by_desc = {i["description"]: i for i in resp.data["items"]}
        self.assertEqual(by_desc["UNKNOWN"]["unit_price"], "0.00")


class InvoiceAgingBucketsTests(APITestCase):
    def setUp(self):
        from apps.finance.models import InvoiceSequence

        self.lab = Lab.objects.create(name="Aging Lab")
        self.user = User.objects.create_user(
            username="aging_admin",
            password="pw",
            email="aging@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(name="AgingClinic", lab=self.lab)
        InvoiceSequence.objects.create(lab=self.lab, last_number=0)
        today = timezone.localdate()

        def _inv(number, days_overdue):
            due = today - timezone.timedelta(days=days_overdue)
            return Invoice.objects.create(
                lab=self.lab,
                clinic=self.clinic,
                number=number,
                status="issued",
                total_amount="100.00",
                due_date=due,
            )

        self.current = _inv("AGE-0001", 0)  # due today → current
        self.d15 = _inv("AGE-0002", 15)  # 15 days → 1-30
        self.d45 = _inv("AGE-0003", 45)  # 45 days → 31-60
        self.d75 = _inv("AGE-0004", 75)  # 75 days → 61-90
        self.d100 = _inv("AGE-0005", 100)  # 100 days → over_90

    def test_aging_buckets_in_finance_stats(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/finance/stats/")
        self.assertEqual(resp.status_code, 200)
        aging = resp.data["aging"]
        self.assertIn("current", aging)
        self.assertIn("1_30", aging)
        self.assertIn("31_60", aging)
        self.assertIn("61_90", aging)
        self.assertIn("over_90", aging)
        self.assertEqual(aging["current"], 1)
        self.assertEqual(aging["1_30"], 1)
        self.assertEqual(aging["31_60"], 1)
        self.assertEqual(aging["61_90"], 1)
        self.assertEqual(aging["over_90"], 1)


class InvoiceAgingTests(APITestCase):
    def setUp(self):
        from datetime import date, timedelta

        self.lab = Lab.objects.create(name="Aging Lab")
        self.admin = User.objects.create_user(
            username="aging_admin",
            password="pw",
            email="aging@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Aging Clinic")
        today = date.today()
        Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="AG-0001",
            status="issued",
            total_amount="100.00",
            vat_rate="20.00",
            due_date=today + timedelta(days=5),
        )
        Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="AG-0002",
            status="issued",
            total_amount="200.00",
            vat_rate="20.00",
            due_date=today - timedelta(days=15),
        )
        Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="AG-0003",
            status="issued",
            total_amount="300.00",
            vat_rate="20.00",
            due_date=today - timedelta(days=45),
        )
        Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="AG-0004",
            status="paid",
            total_amount="400.00",
            vat_rate="20.00",
            due_date=today - timedelta(days=10),
        )

    def _bucket(self, resp_data, key):
        return next(b for b in resp_data if b["bucket"] == key)

    def test_aging_returns_five_buckets(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/invoices/aging/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 5)

    def test_current_bucket_contains_not_overdue(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/invoices/aging/")
        current = self._bucket(resp.data, "current")
        self.assertEqual(current["count"], 1)
        self.assertEqual(current["amount"], "100.00")

    def test_1_30_bucket_contains_fifteen_day_overdue(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/invoices/aging/")
        b = self._bucket(resp.data, "1_30")
        self.assertEqual(b["count"], 1)
        self.assertEqual(b["amount"], "200.00")

    def test_31_60_bucket_contains_45_day_overdue(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/invoices/aging/")
        b = self._bucket(resp.data, "31_60")
        self.assertEqual(b["count"], 1)
        self.assertEqual(b["amount"], "300.00")

    def test_paid_invoices_excluded(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/invoices/aging/")
        total = sum(int(b["count"]) for b in resp.data)
        self.assertEqual(total, 3)

    def test_unauthenticated_denied(self):
        resp = self.client.get("/api/finance/invoices/aging/")
        self.assertEqual(resp.status_code, 401)
