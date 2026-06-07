"""
Unit tests for apps.finance.invoice_service — business logic only, no HTTP layer.
"""

from decimal import Decimal
from unittest.mock import patch

from django.test import TestCase

from apps.core.models import AuditLog, Lab, User
from apps.crm.models import Clinic, Patient
from apps.finance import invoice_service
from apps.finance.models import Invoice, InvoiceItem
from apps.jobs.models import Job, Technician


class InvoiceServiceSetupMixin:
    """Common test fixtures for invoice service tests."""

    def setUp(self):
        self.lab = Lab.objects.create(
            name="Service Lab",
            invoice_prefix="SVC",
            invoice_due_days=14,
            vat_rate=Decimal("20"),
        )
        self.admin = User.objects.create_user(
            username="svc_inv_admin",
            email="svc_inv_admin@test.sk",
            password="pw",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Test Clinic")
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Test",
            last_name="Patient",
            birth_number="900101/1234",
        )
        self.tech = Technician.objects.create(
            lab=self.lab,
            first_name="Tech",
            last_name="One",
        )
        self.job = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            status="completed",
            price="100.00",
            description="Test work",
        )


class GenerateInvoiceNumberTests(InvoiceServiceSetupMixin, TestCase):
    def test_generates_sequential_numbers(self):
        n1 = invoice_service.generate_invoice_number(self.lab)
        n2 = invoice_service.generate_invoice_number(self.lab)
        self.assertNotEqual(n1, n2)

    def test_uses_lab_prefix(self):
        number = invoice_service.generate_invoice_number(self.lab)
        self.assertTrue(number.startswith("SVC-"), number)

    def test_format_is_prefix_year_sequence(self):
        number = invoice_service.generate_invoice_number(self.lab)
        parts = number.split("-")
        self.assertEqual(len(parts), 3)
        self.assertTrue(parts[2].isdigit())


class SyncJobsForInvoiceStatusTests(InvoiceServiceSetupMixin, TestCase):
    def _make_invoice(self, job_status="completed"):
        self.job.status = job_status
        self.job.save(update_fields=["status"])
        invoice = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="SVC-2026-0001",
            status="issued",
            total_amount=Decimal("100.00"),
        )
        InvoiceItem.objects.create(
            invoice=invoice,
            job=self.job,
            description="Test",
            quantity=1,
            unit_price=Decimal("100.00"),
            line_total=Decimal("100.00"),
        )
        return invoice

    def test_paid_status_closes_linked_jobs(self):
        invoice = self._make_invoice()
        invoice_service.sync_jobs_for_invoice_status(invoice, "paid")
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "closed")

    def test_issued_status_marks_jobs_factured(self):
        invoice = self._make_invoice()
        invoice_service.sync_jobs_for_invoice_status(invoice, "issued")
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "finished_factured")

    def test_cancelled_status_marks_jobs_unfactured(self):
        invoice = self._make_invoice()
        invoice_service.sync_jobs_for_invoice_status(invoice, "cancelled")
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "finished_unfactured")


class CreateInvoiceTests(InvoiceServiceSetupMixin, TestCase):
    def test_creates_invoice_with_correct_lab_and_clinic(self):
        invoice = invoice_service.create_invoice(self.admin, self.clinic, [self.job])
        self.assertEqual(invoice.lab, self.lab)
        self.assertEqual(invoice.clinic, self.clinic)
        self.assertEqual(invoice.status, "issued")

    def test_creates_invoice_items_for_each_job(self):
        invoice = invoice_service.create_invoice(self.admin, self.clinic, [self.job])
        self.assertEqual(invoice.items.count(), 1)
        item = invoice.items.first()
        self.assertEqual(item.job, self.job)

    def test_marks_linked_jobs_factured(self):
        invoice_service.create_invoice(self.admin, self.clinic, [self.job])
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "finished_factured")

    def test_total_amount_is_calculated(self):
        invoice = invoice_service.create_invoice(self.admin, self.clinic, [self.job])
        self.assertGreater(invoice.total_amount, Decimal("0"))


class UpdateInvoiceStatusTests(InvoiceServiceSetupMixin, TestCase):
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

    def test_updates_invoice_status(self):
        invoice_service.update_invoice_status(self.admin, self.invoice, "paid")
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.status, "paid")

    def test_writes_audit_log_with_from_and_to_status(self):
        before = AuditLog.objects.count()
        invoice_service.update_invoice_status(self.admin, self.invoice, "paid")
        self.assertEqual(AuditLog.objects.count(), before + 1)
        log = AuditLog.objects.latest("id")
        self.assertEqual(log.action, "invoice.status_changed")
        self.assertEqual(log.metadata["from_status"], "issued")
        self.assertEqual(log.metadata["to_status"], "paid")

    def test_sets_paid_at_on_paid_transition(self):
        invoice_service.update_invoice_status(self.admin, self.invoice, "paid")
        self.invoice.refresh_from_db()
        self.assertIsNotNone(self.invoice.paid_at)

    def test_draft_transition_resets_linked_job_to_unfactured(self):
        self.job.status = "finished_factured"
        self.job.save(update_fields=["status"])
        invoice_service.update_invoice_status(self.admin, self.invoice, "draft")
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "finished_unfactured")


class DeleteInvoiceTests(InvoiceServiceSetupMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.invoice = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="SVC-2026-0001",
            status="issued",
            total_amount=Decimal("50.00"),
        )
        InvoiceItem.objects.create(
            invoice=self.invoice,
            job=self.job,
            description="Work",
            quantity=1,
            unit_price=Decimal("50.00"),
            line_total=Decimal("50.00"),
        )

    def test_deletes_invoice(self):
        invoice_id = self.invoice.id
        invoice_service.delete_invoice(self.admin, self.invoice)
        self.assertFalse(Invoice.objects.filter(id=invoice_id).exists())

    def test_writes_audit_log_before_deletion(self):
        before = AuditLog.objects.count()
        invoice_service.delete_invoice(self.admin, self.invoice)
        self.assertEqual(AuditLog.objects.count(), before + 1)
        log = AuditLog.objects.latest("id")
        self.assertEqual(log.action, "invoice.deleted")

    def test_cancels_linked_job_status(self):
        invoice_service.delete_invoice(self.admin, self.invoice)
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "finished_unfactured")


class SendInvoiceEmailTests(InvoiceServiceSetupMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.invoice = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="SVC-2026-0001",
            status="issued",
            total_amount=Decimal("80.00"),
            document_type="invoice",
        )

    def test_writes_audit_log_on_send(self):
        before = AuditLog.objects.count()
        with patch("django.core.mail.EmailMessage.send"):
            invoice_service.send_invoice_email(
                self.admin, self.invoice, b"PDF", "test@example.com"
            )
        self.assertEqual(AuditLog.objects.count(), before + 1)
        log = AuditLog.objects.latest("id")
        self.assertEqual(log.action, "invoice.email_sent")
        self.assertEqual(log.metadata["sent_to"], "test@example.com")

    def test_raises_on_email_failure(self):
        with patch(
            "django.core.mail.EmailMessage.send", side_effect=Exception("SMTP error")
        ):
            with self.assertRaises(Exception):
                invoice_service.send_invoice_email(
                    self.admin, self.invoice, b"PDF", "bad@example.com"
                )
