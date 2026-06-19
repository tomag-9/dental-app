from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.test_helpers import RoleMatrixTestMixin
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import Invoice, PriceList
from apps.inventory.models import WarehouseItem
from apps.jobs.models import CalendarEvent, Job, Technician, Vacation


class CrossDomainWriteRoleMatrixTests(RoleMatrixTestMixin, APITestCase):
    def setUp(self):
        self.setup_role_matrix(prefix="write_matrix")
        self.clinic_a = Clinic.objects.create(lab=self.lab_a, name="Write Clinic A")
        self.doctor_a = Doctor.objects.create(
            lab=self.lab_a,
            clinic=self.clinic_a,
            first_name="Write",
            last_name="Doctor",
        )
        self.patient_a = Patient.objects.create(
            lab=self.lab_a,
            first_name="Write",
            last_name="Patient",
            birth_number="800101/1234",
        )
        self.technician_model_a = Technician.objects.create(
            lab=self.lab_a,
            first_name="Write",
            last_name="Technician",
        )
        PriceList.objects.create(
            lab=self.lab_a,
            code="WRITE-CROWN",
            description="Write matrix crown",
            price="100.00",
        )

    def _call_request(self, method, url, payload=None, request_format="json"):
        client_method = getattr(self.client, method.lower())
        if payload is None:
            return client_method(url)
        return client_method(url, payload, format=request_format)

    def assert_write_role_matrix(self, request_factory, success_status):
        request_args = request_factory("anonymous")
        if len(request_args) == 3:
            method, url, payload = request_args
            request_format = "json"
        else:
            method, url, payload, request_format = request_args
        anonymous = self._call_request(method, url, payload, request_format)
        self.assertEqual(anonymous.status_code, status.HTTP_401_UNAUTHORIZED)

        expectations = {
            "admin": success_status,
            "superadmin": success_status,
            "user": status.HTTP_403_FORBIDDEN,
            "technician": status.HTTP_403_FORBIDDEN,
            "no_lab": status.HTTP_403_FORBIDDEN,
        }
        for role, expected_status in expectations.items():
            with self.subTest(role=role):
                self.client.force_authenticate(user=self.role_users[role])
                request_args = request_factory(role)
                if len(request_args) == 3:
                    method, url, payload = request_args
                    request_format = "json"
                else:
                    method, url, payload, request_format = request_args
                response = self._call_request(method, url, payload, request_format)
                self.assertEqual(
                    response.status_code,
                    expected_status,
                    getattr(response, "data", response.content),
                )
                self.client.force_authenticate(user=None)

    def _job_payload(self, role, suffix):
        return {
            "lab": self.lab_a.id,
            "patient": self.patient_a.id,
            "clinic": self.clinic_a.id,
            "doctor": self.doctor_a.id,
            "technician": self.technician_model_a.id,
            "description": f"{suffix} job {role}",
            "price": "100.00",
        }

    def _new_job(self, role, suffix="matrix"):
        return Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.technician_model_a,
            status="new",
            description=f"{suffix} target {role}",
            price="100.00",
        )

    def _new_invoice(self, role, suffix="matrix", **kwargs):
        defaults = {
            "lab": self.lab_a,
            "clinic": self.clinic_a,
            "number": f"{suffix.upper()}-{role.upper()}-{Invoice.objects.count() + 1}",
            "status": "issued",
            "total_amount": "100.00",
            "vat_rate": "20.00",
        }
        defaults.update(kwargs)
        return Invoice.objects.create(**defaults)

    def _new_price_item(self, role, suffix="matrix"):
        return PriceList.objects.create(
            lab=self.lab_a,
            code=f"{suffix.upper()}-{role.upper()}-{PriceList.objects.count() + 1}",
            description=f"{suffix} item {role}",
            price="42.00",
        )

    def _new_warehouse_item(self, role, suffix="matrix"):
        return WarehouseItem.objects.create(
            lab=self.lab_a,
            name=f"{suffix} warehouse {role}",
            sku=f"{suffix.upper()}-{role.upper()}-{WarehouseItem.objects.count() + 1}",
            quantity=2,
        )

    def _csv_upload(self, role):
        return SimpleUploadedFile(
            f"matrix-{role}.csv",
            b"name,sku,quantity\nImported Item,IMP-001,3\n",
            content_type="text/csv",
        )

    def test_job_create_role_matrix(self):
        self.assert_write_role_matrix(
            lambda role: ("POST", "/api/jobs/jobs/", self._job_payload(role, "create")),
            status.HTTP_201_CREATED,
        )

    def test_job_update_role_matrix(self):
        def request_factory(role):
            job = self._new_job(role, "update")
            return (
                "PATCH",
                f"/api/jobs/jobs/{job.id}/",
                {"description": f"updated by {role}"},
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_200_OK)

    def test_job_bulk_update_role_matrix(self):
        def request_factory(role):
            job = self._new_job(role, "bulk")
            return (
                "POST",
                "/api/jobs/jobs/bulk-update/",
                {"job_ids": [job.id], "priority": "high"},
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_200_OK)

    def test_job_transition_status_role_matrix(self):
        def request_factory(role):
            job = self._new_job(role, "transition")
            return (
                "POST",
                f"/api/jobs/jobs/{job.id}/transition-status/",
                {"status": "in_progress"},
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_200_OK)

    def test_technician_create_role_matrix(self):
        self.assert_write_role_matrix(
            lambda role: (
                "POST",
                "/api/jobs/technicians/",
                {
                    "lab": self.lab_a.id,
                    "first_name": f"Matrix {role}",
                    "last_name": "Technician",
                },
            ),
            status.HTTP_201_CREATED,
        )

    def test_vacation_create_role_matrix(self):
        self.assert_write_role_matrix(
            lambda role: (
                "POST",
                "/api/jobs/vacations/",
                {
                    "lab": self.lab_a.id,
                    "start": timezone.now().isoformat(),
                    "end": (timezone.now() + timezone.timedelta(days=1)).isoformat(),
                    "description": f"Matrix vacation {role}",
                },
            ),
            status.HTTP_201_CREATED,
        )

    def test_calendar_event_create_role_matrix(self):
        self.assert_write_role_matrix(
            lambda role: (
                "POST",
                "/api/jobs/calendar-events/",
                {
                    "lab": self.lab_a.id,
                    "title": f"Matrix event {role}",
                    "event_type": "meeting",
                    "start": timezone.now().isoformat(),
                },
            ),
            status.HTTP_201_CREATED,
        )

    def test_invoice_create_role_matrix(self):
        def request_factory(role):
            job = self._new_job(role, "invoice")
            job.status = "completed"
            job.save(update_fields=["status"])
            return (
                "POST",
                "/api/finance/invoices/",
                {"clinic_id": self.clinic_a.id, "job_ids": [job.id]},
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_201_CREATED)

    def test_price_list_create_role_matrix(self):
        self.assert_write_role_matrix(
            lambda role: (
                "POST",
                "/api/finance/price-list/",
                {
                    "lab": self.lab_a.id,
                    "code": f"MATRIX-{role.upper()}",
                    "description": f"Matrix price {role}",
                    "price": "42.00",
                },
            ),
            status.HTTP_201_CREATED,
        )

    def test_warehouse_create_role_matrix(self):
        self.assert_write_role_matrix(
            lambda role: (
                "POST",
                "/api/inventory/warehouse/",
                {
                    "lab": self.lab_a.id,
                    "name": f"Matrix item {role}",
                    "sku": f"MATRIX-{role.upper()}",
                    "quantity": 2,
                },
            ),
            status.HTTP_201_CREATED,
        )

    def test_job_attachment_create_role_matrix(self):
        def request_factory(role):
            job = self._new_job(role, "attachment")
            return (
                "POST",
                f"/api/jobs/jobs/{job.id}/attachments/",
                {
                    "file_name": f"matrix-{role}.pdf",
                    "file_url": f"https://example.com/matrix-{role}.pdf",
                    "file_type": "application/pdf",
                },
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_201_CREATED)

    def test_invoice_status_role_matrix(self):
        def request_factory(role):
            invoice = self._new_invoice(role, "status")
            return (
                "PUT",
                f"/api/finance/invoices/{invoice.id}/status/",
                {"status": "paid"},
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_200_OK)

    def test_invoice_delete_role_matrix(self):
        def request_factory(role):
            invoice = self._new_invoice(role, "delete")
            return ("DELETE", f"/api/finance/invoices/{invoice.id}/", None)

        self.assert_write_role_matrix(request_factory, status.HTTP_204_NO_CONTENT)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_invoice_send_email_role_matrix(self):
        def request_factory(role):
            invoice = self._new_invoice(role, "email")
            return (
                "POST",
                f"/api/finance/invoices/{invoice.id}/send-email/",
                {"email": f"{role}@example.com"},
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_200_OK)

    @override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
    def test_invoice_overdue_reminders_role_matrix(self):
        def request_factory(role):
            self._new_invoice(
                role,
                "reminder",
                due_date=timezone.localdate() - timezone.timedelta(days=1),
            )
            return ("POST", "/api/finance/invoices/send-overdue-reminders/", {})

        self.assert_write_role_matrix(request_factory, status.HTTP_200_OK)

    def test_price_list_duplicate_role_matrix(self):
        def request_factory(role):
            item = self._new_price_item(role, "duplicate")
            return ("POST", f"/api/finance/price-list/{item.id}/duplicate/", None)

        self.assert_write_role_matrix(request_factory, status.HTTP_201_CREATED)

    def test_price_list_update_role_matrix(self):
        def request_factory(role):
            item = self._new_price_item(role, "update")
            return (
                "PATCH",
                f"/api/finance/price-list/{item.id}/",
                {"description": f"updated {role}"},
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_200_OK)

    def test_price_list_delete_role_matrix(self):
        def request_factory(role):
            item = self._new_price_item(role, "delete")
            return ("DELETE", f"/api/finance/price-list/{item.id}/", None)

        self.assert_write_role_matrix(request_factory, status.HTTP_204_NO_CONTENT)

    def test_warehouse_update_role_matrix(self):
        def request_factory(role):
            item = self._new_warehouse_item(role, "update")
            return (
                "PATCH",
                f"/api/inventory/warehouse/{item.id}/",
                {"quantity": 5},
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_200_OK)

    def test_warehouse_delete_role_matrix(self):
        def request_factory(role):
            item = self._new_warehouse_item(role, "delete")
            return ("DELETE", f"/api/inventory/warehouse/{item.id}/", None)

        self.assert_write_role_matrix(request_factory, status.HTTP_204_NO_CONTENT)

    def test_warehouse_import_csv_role_matrix(self):
        self.assert_write_role_matrix(
            lambda role: (
                "POST",
                "/api/inventory/warehouse/import-csv/",
                {"file": self._csv_upload(role), "lab": self.lab_a.id},
                "multipart",
            ),
            status.HTTP_201_CREATED,
        )

    def _new_vacation_item(self, role, suffix="matrix"):
        return Vacation.objects.create(
            lab=self.lab_a,
            start=timezone.now(),
            end=timezone.now() + timezone.timedelta(days=1),
            description=f"{suffix} vacation {role}",
        )

    def _new_calendar_event_item(self, role, suffix="matrix"):
        return CalendarEvent.objects.create(
            lab=self.lab_a,
            title=f"{suffix} event {role}",
            event_type="meeting",
            start=timezone.now(),
        )

    def _new_technician_item(self, role, suffix="matrix"):
        return Technician.objects.create(
            lab=self.lab_a,
            first_name=f"{suffix.capitalize()}",
            last_name=f"Tech {role}",
        )

    def test_vacation_update_role_matrix(self):
        def request_factory(role):
            vacation = self._new_vacation_item(role, "vac_update")
            return (
                "PATCH",
                f"/api/jobs/vacations/{vacation.id}/",
                {"description": f"updated {role}"},
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_200_OK)

    def test_vacation_delete_role_matrix(self):
        def request_factory(role):
            vacation = self._new_vacation_item(role, "vac_delete")
            return ("DELETE", f"/api/jobs/vacations/{vacation.id}/", None)

        self.assert_write_role_matrix(request_factory, status.HTTP_204_NO_CONTENT)

    def test_calendar_event_update_role_matrix(self):
        def request_factory(role):
            event = self._new_calendar_event_item(role, "cal_update")
            return (
                "PATCH",
                f"/api/jobs/calendar-events/{event.id}/",
                {"title": f"updated {role}"},
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_200_OK)

    def test_calendar_event_delete_role_matrix(self):
        def request_factory(role):
            event = self._new_calendar_event_item(role, "cal_delete")
            return ("DELETE", f"/api/jobs/calendar-events/{event.id}/", None)

        self.assert_write_role_matrix(request_factory, status.HTTP_204_NO_CONTENT)

    def test_technician_update_role_matrix(self):
        def request_factory(role):
            tech = self._new_technician_item(role, "tech_update")
            return (
                "PATCH",
                f"/api/jobs/technicians/{tech.id}/",
                {"first_name": f"updated {role}"},
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_200_OK)

    def test_technician_delete_role_matrix(self):
        def request_factory(role):
            tech = self._new_technician_item(role, "tech_delete")
            return ("DELETE", f"/api/jobs/technicians/{tech.id}/", None)

        self.assert_write_role_matrix(request_factory, status.HTTP_204_NO_CONTENT)

    def test_warehouse_import_partial_role_matrix(self):
        def request_factory(role):
            url = "/api/inventory/warehouse/import-partial/"
            if role == "superadmin":
                url = f"{url}?lab={self.lab_a.id}"
            return (
                "POST",
                url,
                [
                    {
                        "name": f"Matrix partial {role}",
                        "sku": f"PARTIAL-{role.upper()}-{WarehouseItem.objects.count()}",
                        "quantity": 1,
                    }
                ],
            )

        self.assert_write_role_matrix(request_factory, status.HTTP_201_CREATED)


class CrossLabReadIsolationTests(RoleMatrixTestMixin, APITestCase):
    """
    Verify tenant read isolation across all main list endpoints.

    Superadmin sees records from every lab; other authenticated roles see only
    their own lab's records.  No role (except superadmin) may observe data from
    a foreign lab.
    """

    def setUp(self):
        self.setup_role_matrix(prefix="read_iso")
        self.clinic_a = Clinic.objects.create(lab=self.lab_a, name="Read Iso Clinic A")
        self.clinic_b = Clinic.objects.create(lab=self.lab_b, name="Read Iso Clinic B")
        self.tech_model_a = Technician.objects.create(
            lab=self.lab_a, first_name="Iso", last_name="Tech A"
        )
        self.tech_model_b = Technician.objects.create(
            lab=self.lab_b, first_name="Iso", last_name="Tech B"
        )
        doctor_a = Doctor.objects.create(
            lab=self.lab_a,
            clinic=self.clinic_a,
            first_name="Iso",
            last_name="Doctor A",
        )
        patient_a = Patient.objects.create(
            lab=self.lab_a,
            first_name="Iso",
            last_name="Patient A",
            birth_number="8001015678",
        )
        self.job_a = Job.objects.create(
            lab=self.lab_a,
            patient=patient_a,
            clinic=self.clinic_a,
            doctor=doctor_a,
            technician=self.tech_model_a,
            status="new",
            description="Isolation job A",
            price="50.00",
        )
        doctor_b = Doctor.objects.create(
            lab=self.lab_b,
            clinic=self.clinic_b,
            first_name="Iso",
            last_name="Doctor B",
        )
        patient_b = Patient.objects.create(
            lab=self.lab_b,
            first_name="Iso",
            last_name="Patient B",
            birth_number="8001019999",
        )
        self.job_b = Job.objects.create(
            lab=self.lab_b,
            patient=patient_b,
            clinic=self.clinic_b,
            doctor=doctor_b,
            technician=self.tech_model_b,
            status="new",
            description="Isolation job B",
            price="75.00",
        )

    def _assert_cross_lab_isolation(self, url, own_id, foreign_id):
        """Assert lab scoping for a list endpoint with two known record IDs."""
        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        ids = self.response_ids(resp)
        self.assertIn(own_id, ids, f"admin_a should see their own record at {url}")
        self.assertNotIn(foreign_id, ids, f"admin_a must not see lab_b record at {url}")
        self.client.force_authenticate(user=None)

        for role_user in [self.user_a, self.technician_a]:
            self.client.force_authenticate(user=role_user)
            resp = self.client.get(url)
            self.assertEqual(resp.status_code, 200)
            ids = self.response_ids(resp)
            self.assertNotIn(
                foreign_id,
                ids,
                f"{role_user.role} must not see lab_b record at {url}",
            )
            self.client.force_authenticate(user=None)

        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        ids = self.response_ids(resp)
        self.assertIn(own_id, ids, f"superadmin should see lab_a record at {url}")
        self.assertIn(foreign_id, ids, f"superadmin should see lab_b record at {url}")
        self.client.force_authenticate(user=None)

    def test_jobs_list_cross_lab_isolation(self):
        self._assert_cross_lab_isolation(
            "/api/jobs/jobs/", self.job_a.id, self.job_b.id
        )

    def test_technicians_list_cross_lab_isolation(self):
        self._assert_cross_lab_isolation(
            "/api/jobs/technicians/",
            self.tech_model_a.id,
            self.tech_model_b.id,
        )

    def test_detail_cross_lab_isolation(self):
        """A user from lab A gets 404 when accessing a resource that belongs to lab B."""
        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.get(f"/api/jobs/jobs/{self.job_b.id}/")
        self.assertEqual(resp.status_code, 404)

        resp = self.client.get(f"/api/jobs/technicians/{self.tech_model_b.id}/")
        self.assertEqual(resp.status_code, 404)


class CrossDomainExportRoleMatrixTests(RoleMatrixTestMixin, APITestCase):
    """Role matrix tests for all export endpoints (GET, read-only or admin-only)."""

    def setUp(self):
        self.setup_role_matrix(prefix="export_matrix")
        self.clinic_a = Clinic.objects.create(lab=self.lab_a, name="Export Clinic A")
        Doctor.objects.create(
            lab=self.lab_a,
            clinic=self.clinic_a,
            first_name="Export",
            last_name="Doctor",
        )
        Patient.objects.create(
            lab=self.lab_a,
            first_name="Export",
            last_name="Patient",
            birth_number="9001011234",
        )
        WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Export Item",
            sku="EXPMAT-001",
            quantity=1,
        )

    def _admin_only_expectations(self):
        return {
            "anonymous": status.HTTP_401_UNAUTHORIZED,
            "no_lab": status.HTTP_403_FORBIDDEN,
            "user": status.HTTP_403_FORBIDDEN,
            "technician": status.HTTP_403_FORBIDDEN,
            "admin": status.HTTP_200_OK,
            "superadmin": status.HTTP_200_OK,
        }

    def _read_allowed_expectations(self):
        return {
            "anonymous": status.HTTP_401_UNAUTHORIZED,
            "no_lab": status.HTTP_200_OK,
            "user": status.HTTP_200_OK,
            "technician": status.HTTP_200_OK,
            "admin": status.HTTP_200_OK,
            "superadmin": status.HTTP_200_OK,
        }

    def test_clinic_export_role_matrix(self):
        self.assert_endpoint_matrix(
            "GET", "/api/crm/clinics/export/", self._read_allowed_expectations()
        )

    def test_doctor_export_role_matrix(self):
        self.assert_endpoint_matrix(
            "GET", "/api/crm/doctors/export/", self._admin_only_expectations()
        )

    def test_patient_export_role_matrix(self):
        self.assert_endpoint_matrix(
            "GET", "/api/crm/patients/export/", self._admin_only_expectations()
        )

    def test_jobs_export_role_matrix(self):
        self.assert_endpoint_matrix(
            "GET", "/api/jobs/jobs/export/", self._read_allowed_expectations()
        )

    def test_invoice_export_role_matrix(self):
        self.assert_endpoint_matrix(
            "GET", "/api/finance/invoices/export/", self._read_allowed_expectations()
        )

    def test_pricelist_export_role_matrix(self):
        self.assert_endpoint_matrix(
            "GET", "/api/finance/price-list/export/", self._read_allowed_expectations()
        )

    def test_inventory_export_role_matrix(self):
        self.assert_endpoint_matrix(
            "GET", "/api/inventory/warehouse/export/", self._read_allowed_expectations()
        )
