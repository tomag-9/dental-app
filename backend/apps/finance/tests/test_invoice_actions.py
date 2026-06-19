from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import AuditLog, Lab, User
from apps.crm.models import Clinic
from apps.finance.models import Invoice


class InvoiceSendEmailTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Email Lab")
        self.admin = User.objects.create_user(
            username="email_admin",
            password="pw",
            email="email_admin@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.regular = User.objects.create_user(
            username="email_regular",
            password="pw",
            email="email_regular@test.sk",
            role="user",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(
            lab=self.lab,
            name="Email Klinika",
            contact_info={"email": "klinika@test.sk"},
        )
        self.invoice = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="LAB-2026-0010",
            status="issued",
            total_amount="500.00",
            vat_rate="20.00",
        )

    def test_send_email_to_explicit_address(self):
        from django.core import mail
        from django.test import override_settings

        self.client.force_authenticate(user=self.admin)
        with override_settings(
            EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
        ):
            resp = self.client.post(
                f"/api/finance/invoices/{self.invoice.id}/send-email/",
                {"email": "recipient@test.sk"},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["sent_to"], "recipient@test.sk")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn(self.invoice.number, mail.outbox[0].subject)

    def test_send_email_writes_audit_log(self):
        from django.test import override_settings

        self.client.force_authenticate(user=self.admin)
        with override_settings(
            EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
        ):
            resp = self.client.post(
                f"/api/finance/invoices/{self.invoice.id}/send-email/",
                {"email": "recipient@test.sk"},
                format="json",
            )

        self.assertEqual(resp.status_code, 200)
        log = AuditLog.objects.filter(action="invoice.email_sent").latest("created_at")
        self.assertEqual(log.entity_id, str(self.invoice.id))
        self.assertEqual(log.actor, self.admin)
        self.assertEqual(log.lab, self.lab)
        self.assertEqual(log.metadata["sent_to"], "recipient@test.sk")

    def test_send_email_falls_back_to_clinic_contact(self):
        from django.test import override_settings

        self.client.force_authenticate(user=self.admin)
        with override_settings(
            EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
        ):
            resp = self.client.post(
                f"/api/finance/invoices/{self.invoice.id}/send-email/",
                {},
                format="json",
            )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["sent_to"], "klinika@test.sk")

    def test_send_email_no_recipient_returns_400(self):
        clinic_no_email = Clinic.objects.create(lab=self.lab, name="No Email Clinic")
        invoice_no_email = Invoice.objects.create(
            lab=self.lab,
            clinic=clinic_no_email,
            number="LAB-2026-0011",
            status="issued",
            total_amount="100.00",
            vat_rate="20.00",
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            f"/api/finance/invoices/{invoice_no_email.id}/send-email/",
            {},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_send_email_unauthenticated_denied(self):
        resp = self.client.post(
            f"/api/finance/invoices/{self.invoice.id}/send-email/",
            {"email": "test@test.sk"},
            format="json",
        )
        self.assertEqual(resp.status_code, 401)

    def test_regular_user_cannot_send_email(self):
        from django.core import mail
        from django.test import override_settings

        self.client.force_authenticate(user=self.regular)
        with override_settings(
            EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
        ):
            resp = self.client.post(
                f"/api/finance/invoices/{self.invoice.id}/send-email/",
                {"email": "recipient@test.sk"},
                format="json",
            )

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(mail.outbox), 0)


class OverdueReminderTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Overdue Lab")
        self.admin = User.objects.create_user(
            username="overdue_admin",
            password="pw",
            email="overdue_a@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.regular = User.objects.create_user(
            username="overdue_regular",
            password="pw",
            email="overdue_regular@test.sk",
            role="user",
            lab=self.lab,
        )
        self.clinic_with_email = Clinic.objects.create(
            lab=self.lab,
            name="Email Clinic",
            contact_info={"email": "clinic@test.sk"},
        )
        self.clinic_no_email = Clinic.objects.create(
            lab=self.lab,
            name="No Email Clinic",
        )
        from datetime import date, timedelta

        yesterday = date.today() - timedelta(days=1)
        self.overdue_inv = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic_with_email,
            number="OD-0001",
            status="issued",
            total_amount="300.00",
            vat_rate="20.00",
            due_date=yesterday,
        )
        self.overdue_no_email = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic_no_email,
            number="OD-0002",
            status="issued",
            total_amount="100.00",
            vat_rate="20.00",
            due_date=yesterday,
        )
        self.paid_inv = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic_with_email,
            number="OD-0003",
            status="paid",
            total_amount="50.00",
            vat_rate="20.00",
            due_date=yesterday,
        )

    def test_sends_reminders_for_overdue_issued_invoices(self):
        from django.core import mail
        from django.test import override_settings

        self.client.force_authenticate(user=self.admin)
        with override_settings(
            EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
        ):
            resp = self.client.post("/api/finance/invoices/send-overdue-reminders/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("OD-0001", resp.data["sent"])
        self.assertEqual(resp.data["sent_count"], 1)
        self.assertEqual(len(resp.data["failed"]), 1)
        self.assertEqual(resp.data["failed"][0]["invoice"], "OD-0002")
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("OD-0001", mail.outbox[0].subject)

    def test_send_overdue_reminders_writes_audit_log(self):
        from django.test import override_settings

        self.client.force_authenticate(user=self.admin)
        with override_settings(
            EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
        ):
            resp = self.client.post("/api/finance/invoices/send-overdue-reminders/")

        self.assertEqual(resp.status_code, 200)
        log = AuditLog.objects.filter(action="invoice.reminder_sent").latest(
            "created_at"
        )
        self.assertEqual(log.entity_id, str(self.overdue_inv.id))
        self.assertEqual(log.actor, self.admin)
        self.assertEqual(log.lab, self.lab)
        self.assertEqual(log.metadata["sent_to"], "clinic@test.sk")
        self.assertEqual(log.metadata["days_overdue"], 1)

    def test_paid_invoices_not_included(self):
        from django.test import override_settings

        self.client.force_authenticate(user=self.admin)
        with override_settings(
            EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
        ):
            resp = self.client.post("/api/finance/invoices/send-overdue-reminders/")
        sent_numbers = resp.data["sent"] + [f["invoice"] for f in resp.data["failed"]]
        self.assertNotIn("OD-0003", sent_numbers)

    def test_unauthenticated_denied(self):
        resp = self.client.post("/api/finance/invoices/send-overdue-reminders/")
        self.assertEqual(resp.status_code, 401)

    def test_regular_user_cannot_send_overdue_reminders(self):
        from django.core import mail
        from django.test import override_settings

        self.client.force_authenticate(user=self.regular)
        with override_settings(
            EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend"
        ):
            resp = self.client.post("/api/finance/invoices/send-overdue-reminders/")

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(len(mail.outbox), 0)


class InvoiceListFilterTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Filter Invoice Lab")
        self.admin = User.objects.create_user(
            username="inv_filter_admin",
            password="pw",
            email="invf@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.clinic_a = Clinic.objects.create(lab=self.lab, name="Clinic A")
        self.clinic_b = Clinic.objects.create(lab=self.lab, name="Clinic B")
        from datetime import date, timedelta

        today = date.today()
        self.inv_issued = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic_a,
            number="F-0001",
            status="issued",
            total_amount="100.00",
            vat_rate="20.00",
            due_date=today + timedelta(days=10),
        )
        self.inv_paid = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic_b,
            number="F-0002",
            status="paid",
            total_amount="200.00",
            vat_rate="20.00",
            due_date=today - timedelta(days=5),
        )
        self.inv_proforma = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic_a,
            number="F-0003",
            status="issued",
            document_type="proforma",
            total_amount="50.00",
            vat_rate="20.00",
            due_date=today,
        )

    def test_status_filter(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/invoices/?status=paid")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["number"], "F-0002")

    def test_document_type_filter(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/invoices/?document_type=proforma")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["number"], "F-0003")

    def test_clinic_id_filter(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/finance/invoices/?clinic_id={self.clinic_b.id}")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["number"], "F-0002")

    def test_date_range_filter(self):
        from datetime import date

        today = date.today()
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/finance/invoices/?date_from={today.isoformat()}")
        self.assertEqual(resp.status_code, 200)
        numbers = [inv["number"] for inv in resp.data]
        self.assertIn("F-0001", numbers)
        self.assertIn("F-0003", numbers)
        self.assertNotIn("F-0002", numbers)

    def test_invalid_clinic_id_ignored(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/finance/invoices/?clinic_id=notanumber")
        self.assertEqual(resp.status_code, 200)
