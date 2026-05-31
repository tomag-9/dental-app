"""
Unit tests for apps.finance.services — the public service interface.

These tests exercise the business-logic layer (tenant checks, job validation,
audit log routing) without going through the HTTP layer.
"""

from decimal import Decimal

from django.test import TestCase
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from apps.core.models import AuditLog, Lab, User
from apps.crm.models import Clinic, Patient
from apps.finance import services as finance_services
from apps.finance.models import Invoice, InvoiceItem
from apps.jobs.models import Job


class FinanceServiceSetupMixin:
    def setUp(self):
        self.lab = Lab.objects.create(
            name="Service Lab",
            invoice_prefix="SVC",
            invoice_due_days=14,
            vat_rate=Decimal("20"),
        )
        self.other_lab = Lab.objects.create(
            name="Other Lab",
            invoice_prefix="OTH",
            invoice_due_days=14,
            vat_rate=Decimal("20"),
        )
        self.admin = User.objects.create_user(
            username="svc_admin",
            email="svc_admin@test.sk",
            password="pw",
            role="admin",
            lab=self.lab,
        )
        self.other_admin = User.objects.create_user(
            username="other_admin",
            email="other_admin@test.sk",
            password="pw",
            role="admin",
            lab=self.other_lab,
        )
        self.superadmin = User.objects.create_user(
            username="superadmin",
            email="superadmin@test.sk",
            password="pw",
            role="superadmin",
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Test Clinic")
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Test",
            last_name="Patient",
            birth_number="900101/1234",
        )
        self.job = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            status="completed",
            price="100.00",
            description="Test work",
        )


# ---------------------------------------------------------------------------
# next_invoice_number
# ---------------------------------------------------------------------------


class NextInvoiceNumberTests(FinanceServiceSetupMixin, TestCase):
    def test_returns_string_with_lab_prefix(self):
        number = finance_services.next_invoice_number(self.lab)
        self.assertTrue(number.startswith("SVC-"), number)

    def test_sequential_calls_return_different_numbers(self):
        n1 = finance_services.next_invoice_number(self.lab)
        n2 = finance_services.next_invoice_number(self.lab)
        self.assertNotEqual(n1, n2)


# ---------------------------------------------------------------------------
# create_invoice_from_jobs
# ---------------------------------------------------------------------------


class CreateInvoiceFromJobsTests(FinanceServiceSetupMixin, TestCase):
    def _call(self, **kwargs):
        defaults = dict(
            user=self.admin,
            clinic_id=self.clinic.id,
            job_ids=[self.job.id],
            document_type="invoice",
            discount_percent=Decimal("0"),
        )
        defaults.update(kwargs)
        return finance_services.create_invoice_from_jobs(**defaults)

    def test_happy_path_creates_invoice(self):
        invoice = self._call()
        self.assertIsInstance(invoice, Invoice)
        self.assertEqual(invoice.clinic, self.clinic)
        self.assertEqual(invoice.lab, self.lab)

    def test_clinic_not_found_raises_not_found(self):
        with self.assertRaises(NotFound):
            self._call(clinic_id=99999)

    def test_wrong_lab_user_raises_permission_denied(self):
        with self.assertRaises(PermissionDenied):
            self._call(user=self.other_admin)

    def test_superadmin_can_create_for_any_lab(self):
        invoice = self._call(user=self.superadmin)
        self.assertIsInstance(invoice, Invoice)

    def test_missing_job_raises_validation_error(self):
        with self.assertRaises(ValidationError):
            self._call(job_ids=[self.job.id, 99999])

    def test_job_from_different_lab_raises_validation_error(self):
        other_clinic = Clinic.objects.create(lab=self.other_lab, name="Other Clinic")
        other_patient = Patient.objects.create(
            lab=self.other_lab,
            first_name="X",
            last_name="Y",
            birth_number="800101/0001",
        )
        other_job = Job.objects.create(
            lab=self.other_lab,
            patient=other_patient,
            clinic=other_clinic,
            status="completed",
            price="50.00",
        )
        with self.assertRaises(ValidationError):
            self._call(job_ids=[self.job.id, other_job.id])

    def test_marks_jobs_finished_factured(self):
        self._call()
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "finished_factured")

    def test_calculates_total_amount(self):
        invoice = self._call()
        self.assertGreater(invoice.total_amount, Decimal("0"))


# ---------------------------------------------------------------------------
# update_invoice_status
# ---------------------------------------------------------------------------


class UpdateInvoiceStatusTests(FinanceServiceSetupMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.invoice = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="SVC-2026-0001",
            status="issued",
            total_amount=Decimal("120.00"),
        )
        InvoiceItem.objects.create(
            invoice=self.invoice,
            job=self.job,
            description="Work",
            quantity=1,
            unit_price=Decimal("120.00"),
            line_total=Decimal("120.00"),
        )

    def test_changes_status(self):
        finance_services.update_invoice_status(user=self.admin, invoice=self.invoice, status="paid")
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, "paid")

    def test_sets_paid_at_on_paid_transition(self):
        finance_services.update_invoice_status(user=self.admin, invoice=self.invoice, status="paid")
        self.invoice.refresh_from_db()
        self.assertIsNotNone(self.invoice.paid_at)

    def test_writes_audit_log_via_core_services(self):
        before = AuditLog.objects.count()
        finance_services.update_invoice_status(user=self.admin, invoice=self.invoice, status="paid")
        self.assertEqual(AuditLog.objects.count(), before + 1)
        log = AuditLog.objects.latest("id")
        self.assertEqual(log.action, "invoice.status_changed")
        self.assertEqual(log.metadata["from_status"], "issued")
        self.assertEqual(log.metadata["to_status"], "paid")
        self.assertEqual(log.entity_type, "invoice")
        self.assertEqual(log.actor, self.admin)

    def test_syncs_linked_jobs(self):
        finance_services.update_invoice_status(user=self.admin, invoice=self.invoice, status="paid")
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "closed")

    def test_returns_updated_invoice(self):
        result = finance_services.update_invoice_status(user=self.admin, invoice=self.invoice, status="cancelled")
        self.assertEqual(result.status, "cancelled")
