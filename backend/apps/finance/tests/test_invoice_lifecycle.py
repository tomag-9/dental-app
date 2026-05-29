import threading

from django.db import connection
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient, APITestCase

from apps.core.models import AuditLog, Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import Invoice, InvoiceSequence
from apps.jobs.models import Job, Technician


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
        self.regular_a = User.objects.create_user(
            username="invoice_regular_a",
            email="invoice_regular_a@example.com",
            password="password123",
            role="user",
            lab=self.lab_a,
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

    def test_status_transition_writes_audit_log(self):
        invoice = Invoice.objects.create(
            lab=self.lab_a,
            clinic=self.clinic_a,
            number="AUD-STATUS-1",
            status="issued",
            total_amount="120.00",
            vat_rate="20.00",
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.put(
            f"/api/finance/invoices/{invoice.id}/status/",
            {"status": "paid"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = AuditLog.objects.filter(action="invoice.status_changed").latest(
            "created_at"
        )
        self.assertEqual(log.entity_id, str(invoice.id))
        self.assertEqual(log.actor, self.admin_a)
        self.assertEqual(log.lab, self.lab_a)
        self.assertEqual(log.metadata["from_status"], "issued")
        self.assertEqual(log.metadata["to_status"], "paid")

    def test_delete_invoice_writes_audit_log(self):
        invoice = Invoice.objects.create(
            lab=self.lab_a,
            clinic=self.clinic_a,
            number="AUD-DELETE-1",
            status="issued",
            total_amount="120.00",
            vat_rate="20.00",
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.delete(f"/api/finance/invoices/{invoice.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        log = AuditLog.objects.filter(action="invoice.deleted").latest("created_at")
        self.assertEqual(log.entity_id, str(invoice.id))
        self.assertEqual(log.actor, self.admin_a)
        self.assertEqual(log.lab, self.lab_a)
        self.assertEqual(log.metadata["number"], "AUD-DELETE-1")
        self.assertEqual(log.metadata["status"], "issued")

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

    def test_regular_user_cannot_create_invoice(self):
        self.client.force_authenticate(user=self.regular_a)
        response = self.client.post(
            "/api/finance/invoices/",
            {"clinic_id": self.clinic_a.id, "job_ids": [self.job_a1.id]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(Invoice.objects.filter(items__job=self.job_a1).exists())

    def test_regular_user_cannot_update_invoice_status(self):
        invoice = Invoice.objects.create(
            lab=self.lab_a,
            clinic=self.clinic_a,
            number="REG-STATUS-1",
            status="issued",
            total_amount="120.00",
            vat_rate="20.00",
        )

        self.client.force_authenticate(user=self.regular_a)
        response = self.client.put(
            f"/api/finance/invoices/{invoice.id}/status/",
            {"status": "paid"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        invoice.refresh_from_db()
        self.assertEqual(invoice.status, "issued")

    def test_regular_user_cannot_delete_invoice(self):
        invoice = Invoice.objects.create(
            lab=self.lab_a,
            clinic=self.clinic_a,
            number="REG-DELETE-1",
            status="issued",
            total_amount="120.00",
            vat_rate="20.00",
        )

        self.client.force_authenticate(user=self.regular_a)
        response = self.client.delete(f"/api/finance/invoices/{invoice.id}/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Invoice.objects.filter(id=invoice.id).exists())


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


class ConcurrentInvoiceSequenceTests(TransactionTestCase):
    reset_sequences = True

    def setUp(self):
        self.lab = Lab.objects.create(name="Concurrent Seq Lab", invoice_prefix="CON")
        self.clinic = Clinic.objects.create(lab=self.lab, name="Clinic")
        self.patient = Patient.objects.create(
            lab=self.lab, first_name="A", last_name="B"
        )
        self.job = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            status="completed",
            price="10.00",
        )
        self.admin = User.objects.create_user(
            username="concurrent_admin",
            email="concurrent_admin@example.com",
            password="pass",
            role="admin",
            lab=self.lab,
        )

    def test_parallel_invoice_creation_uses_unique_numbers(self):
        if connection.vendor != "postgresql":
            self.skipTest("select_for_update concurrency is enforced by PostgreSQL")

        barrier = threading.Barrier(5)
        responses = []
        lock = threading.Lock()

        def create_invoice():
            client = APIClient()
            client.force_authenticate(user=self.admin)
            barrier.wait()
            response = client.post(
                "/api/finance/invoices/",
                {"clinic_id": self.clinic.id, "job_ids": [self.job.id]},
                format="json",
            )
            with lock:
                responses.append(response)

        threads = [threading.Thread(target=create_invoice) for _ in range(5)]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        self.assertEqual([response.status_code for response in responses], [201] * 5)
        numbers = [response.data["number"] for response in responses]
        self.assertEqual(len(numbers), len(set(numbers)))
        self.assertEqual(InvoiceSequence.objects.get(lab=self.lab).last_number, 5)


class ProformaInvoiceTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Proforma Lab", invoice_prefix="PRF")
        self.user = User.objects.create_user(
            username="proforma_user", password="pw", role="admin", lab=self.lab
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Proforma Clinic")
        self.doctor = Doctor.objects.create(
            lab=self.lab, clinic=self.clinic, first_name="D", last_name="R"
        )
        self.patient = Patient.objects.create(
            lab=self.lab, first_name="P", last_name="Q", birth_number="900101/1234"
        )
        self.tech = Technician.objects.create(
            lab=self.lab, first_name="T", last_name="T"
        )

    def _create_job(self):
        return Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            doctor=self.doctor,
            patient=self.patient,
            technician=self.tech,
            status="completed",
            description="Crown",
        )

    def test_invoice_defaults_to_invoice_type(self):
        job = self._create_job()
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
        self.assertEqual(resp.data["document_type"], "invoice")

    def test_create_proforma_invoice(self):
        job = self._create_job()
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/finance/invoices/",
            {
                "clinic_id": self.clinic.id,
                "job_ids": [job.id],
                "document_type": "proforma",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["document_type"], "proforma")

    def test_document_type_in_list_response(self):
        Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="PRF-2026-0001",
            status="draft",
            document_type="proforma",
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/finance/invoices/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(any(i["document_type"] == "proforma" for i in resp.data))

    def test_invalid_document_type_rejected(self):
        job = self._create_job()
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/finance/invoices/",
            {
                "clinic_id": self.clinic.id,
                "job_ids": [job.id],
                "document_type": "receipt",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 400)


class InvoiceSkFormatTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="SK Format Lab")
        self.admin = User.objects.create_user(
            username="skfmt_admin",
            password="pw",
            email="skfmt@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Klinika SK")
        from django.utils import timezone

        self.invoice = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="LAB-2026-0001",
            status="issued",
            total_amount="1234.56",
            vat_rate="20.00",
            due_date=timezone.localdate(),
            issued_at=timezone.now(),
        )

    def test_formatted_total_slovak_style(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/finance/invoices/{self.invoice.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("formatted_total", resp.data)
        self.assertIn("EUR", resp.data["formatted_total"])
        self.assertIn(",", resp.data["formatted_total"])

    def test_formatted_due_date_slovak_style(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/finance/invoices/{self.invoice.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("formatted_due_date", resp.data)
        # Slovak format DD.MM.YYYY
        self.assertRegex(resp.data["formatted_due_date"], r"^\d{2}\.\d{2}\.\d{4}$")

    def test_formatted_issued_at_slovak_style(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/finance/invoices/{self.invoice.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("formatted_issued_at", resp.data)
        self.assertRegex(resp.data["formatted_issued_at"], r"^\d{2}\.\d{2}\.\d{4}$")

    def test_formatted_fields_null_when_no_dates(self):
        invoice_no_dates = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="LAB-2026-0002",
            status="draft",
            total_amount="0.00",
            vat_rate="20.00",
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/finance/invoices/{invoice_no_dates.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.data["formatted_due_date"])
        self.assertIsNone(resp.data["formatted_issued_at"])
