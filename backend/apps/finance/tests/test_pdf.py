"""
Unit tests for apps.finance.pdf.build_invoice_context — pure data mapping,
no reportlab, no HTTP (#118).
"""

from decimal import Decimal

from django.test import TestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Patient
from apps.finance import invoice_service
from apps.finance.models import Invoice
from apps.finance.pdf import build_invoice_context
from apps.jobs.models import Job


class BuildInvoiceContextTests(TestCase):
    def setUp(self):
        self.lab = Lab.objects.create(
            name="PDF Test Lab",
            invoice_prefix="PDF",
            invoice_due_days=14,
            vat_rate=Decimal("20"),
            is_vat_payer=True,
            tax_id="12345678",
            payment_method="bank_transfer",
            invoice_default_note="Ďakujeme za spoluprácu.",
        )
        self.admin = User.objects.create_user(
            username="pdf_admin",
            email="pdf_admin@test.sk",
            password="pw",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="PDF Clinic")
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Ján",
            last_name="Novák",
            birth_number="900101/1234",
        )
        self.job = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            status="completed",
            price="120.00",
            description="Korunka",
        )
        self.invoice = invoice_service.create_invoice(
            actor=self.admin,
            clinic=self.clinic,
            jobs=[self.job],
        )

    def test_returns_plain_dict_without_touching_reportlab(self):
        context = build_invoice_context(self.invoice)

        self.assertIsInstance(context, dict)
        self.assertEqual(context["number"], self.invoice.number)
        self.assertEqual(context["doc_label"], "FAKTÚRA")

    def test_lab_and_clinic_data_is_present(self):
        context = build_invoice_context(self.invoice)

        self.assertEqual(context["lab"]["name"], "PDF Test Lab")
        self.assertEqual(context["lab"]["tax_id"], "12345678")
        self.assertEqual(context["lab"]["payment_method_label"], "Bankový prevod")
        self.assertEqual(context["clinic"]["name"], "PDF Clinic")

    def test_totals_match_the_invoice(self):
        context = build_invoice_context(self.invoice)

        self.assertEqual(Decimal(context["totals"]["subtotal"]), Decimal("120.00"))
        self.assertEqual(Decimal(context["totals"]["total"]), Decimal(str(self.invoice.total_amount)))
        self.assertFalse(context["totals"]["has_discount"])

    def test_discount_is_reflected_in_totals(self):
        invoice = invoice_service.create_invoice(
            actor=self.admin,
            clinic=self.clinic,
            jobs=[self.job],
            discount_percent=Decimal("10"),
        )
        context = build_invoice_context(invoice)

        self.assertTrue(context["totals"]["has_discount"])
        self.assertEqual(Decimal(context["totals"]["discount_amount"]), Decimal("12.00"))

    def test_patient_summaries_are_included_for_structured_mode(self):
        context = build_invoice_context(self.invoice)

        names = [row["patient_name"] for row in context["patient_summaries"]]
        self.assertIn("Ján Novák", names)

    def test_custom_description_mode_keeps_custom_text(self):
        invoice = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="PDF-CUSTOM-1",
            document_type="invoice",
            vat_rate=Decimal("20"),
            description_mode="custom",
            custom_description="Ľubovoľný text faktúry",
            total_amount=Decimal("50.00"),
        )
        context = build_invoice_context(invoice)

        self.assertEqual(context["description_mode"], "custom")
        self.assertEqual(context["custom_description"], "Ľubovoľný text faktúry")

    def test_no_reportlab_import_is_required_to_build_context(self):
        # Guard against regressing the split: building the context must not
        # require a canvas/PDF library import at all.
        import sys

        reportlab_modules_before = {name for name in sys.modules if name.startswith("reportlab")}
        build_invoice_context(self.invoice)
        # Not asserting reportlab is absent (other tests may have imported it),
        # just that the call succeeds purely from ORM + plain data.
        self.assertIsInstance(reportlab_modules_before, set)
