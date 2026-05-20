from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import AuditLog, Lab, Notification, User
from apps.crm.models import Clinic, Patient
from apps.finance.models import Invoice, Subscription
from apps.jobs.models import Job


class CoreUserFlowsApiTests(APITestCase):
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
        self.user_a = User.objects.create_user(
            username="user_a",
            email="user_a@example.com",
            password="password123",
            role="user",
            lab=self.lab_a,
        )
        self.admin_b = User.objects.create_user(
            username="admin_b",
            email="admin_b@example.com",
            password="password123",
            role="admin",
            lab=self.lab_b,
        )

    def test_signup_creates_lab_admin_subscription_and_returns_tokens(self):
        payload = {
            "lab_name": "New Lab",
            "lab_city": "Bratislava",
            "email": "owner@newlab.test",
            "nickname": "owner",
            "password": "password123",
        }

        response = self.client.post("/api/core/users/signup/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("token", response.data)
        self.assertIn("access_token", response.data["token"])
        self.assertIn("refresh_token", response.data["token"])

        lab = Lab.objects.get(name="New Lab")
        created_user = User.objects.get(email="owner@newlab.test")
        self.assertEqual(created_user.role, "admin")
        self.assertEqual(created_user.lab_id, lab.id)
        self.assertTrue(Subscription.objects.filter(lab=lab).exists())

    def test_me_get_and_put(self):
        self.client.force_authenticate(user=self.admin_a)

        get_response = self.client.get("/api/core/users/me/")
        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["username"], "admin_a")

        put_response = self.client.put(
            "/api/core/users/me/", {"nickname": "new_nick"}, format="json"
        )
        self.assertEqual(put_response.status_code, status.HTTP_200_OK)
        self.assertEqual(put_response.data["nickname"], "new_nick")

    def test_me_put_updates_notification_preferences(self):
        self.client.force_authenticate(user=self.user_a)
        payload = {
            "notification_preferences": {
                "email": True,
                "in_app": True,
                "deadline_days": 3,
                "types": {"jobs": True, "finance": False},
            }
        }

        response = self.client.put("/api/core/users/me/", payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data["notification_preferences"],
            payload["notification_preferences"],
        )
        self.user_a.refresh_from_db()
        self.assertEqual(
            self.user_a.notification_preferences,
            payload["notification_preferences"],
        )

    def test_me_put_hashes_password_and_keeps_sensitive_fields_unchanged(self):
        self.client.force_authenticate(user=self.user_a)

        response = self.client.put(
            "/api/core/users/me/",
            {
                "password": "new_password_456",
                "lab": self.lab_b.id,
                "is_active": False,
                "username": "hacker",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user_a.refresh_from_db()
        self.assertTrue(self.user_a.check_password("new_password_456"))
        self.assertEqual(self.user_a.lab_id, self.lab_a.id)
        self.assertTrue(self.user_a.is_active)
        self.assertEqual(self.user_a.username, "user_a")

    def test_me_put_rejects_duplicate_email(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.put(
            "/api/core/users/me/",
            {"email": "user_a@example.com"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_me_put_rejects_role_escalation_to_superadmin_for_non_superadmin(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.put(
            "/api/core/users/me/",
            {"role": "superadmin"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_users_all_and_toggle_active(self):
        self.client.force_authenticate(user=self.superadmin)

        list_response = self.client.get("/api/core/users/superadmin/all/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(list_response.data), 3)

        toggle_response = self.client.put(
            f"/api/core/users/superadmin/{self.user_a.id}/toggle-active/"
        )
        self.assertEqual(toggle_response.status_code, status.HTTP_200_OK)
        self.user_a.refresh_from_db()
        self.assertFalse(self.user_a.is_active)
        self.assertTrue(
            AuditLog.objects.filter(
                action="user.toggle_active",
                entity_type="user",
                entity_id=str(self.user_a.id),
            ).exists()
        )

    def test_superadmin_can_list_audit_logs(self):
        AuditLog.objects.create(
            actor=self.superadmin,
            lab=self.lab_a,
            action="lab.updated",
            entity_type="lab",
            entity_id=str(self.lab_a.id),
            description="Lab updated",
            metadata={"fields": ["city"]},
        )

        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get("/api/core/audit-logs/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]["action"], "lab.updated")
        self.assertEqual(response.data[0]["actor_username"], "superadmin")
        self.assertEqual(response.data[0]["lab_name"], "Lab A")
        self.assertEqual(response.data[0]["metadata"], {"fields": ["city"]})

    def test_regular_user_cannot_list_audit_logs(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/core/audit-logs/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_superadmin_cannot_access_superadmin_user_endpoints(self):
        self.client.force_authenticate(user=self.admin_a)

        list_response = self.client.get("/api/core/users/superadmin/all/")
        self.assertEqual(list_response.status_code, status.HTTP_403_FORBIDDEN)

        toggle_response = self.client.put(
            f"/api/core/users/superadmin/{self.user_a.id}/toggle-active/"
        )
        self.assertEqual(toggle_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_non_admin_cannot_access_generic_user_management_list(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.get("/api/core/users/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_can_only_update_users_in_same_lab(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.patch(
            f"/api/core/users/{self.admin_b.id}/",
            {"nickname": "cross_lab_edit"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_labs_all_includes_stats(self):
        Subscription.objects.create(
            lab=self.lab_a, plan="free", status="active", seats=5
        )

        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get("/api/core/labs/superadmin/all/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        by_name = {item["name"]: item for item in response.data}
        self.assertIn("Lab A", by_name)
        self.assertEqual(by_name["Lab A"]["subscription_status"], "active")

    def test_regular_user_cannot_update_lab_settings(self):
        self.client.force_authenticate(user=self.user_a)
        response = self.client.patch(
            f"/api/core/labs/{self.lab_a.id}/",
            {"name": "Changed by user"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.lab_a.refresh_from_db()
        self.assertEqual(self.lab_a.name, "Lab A")

    def test_admin_can_update_own_lab_settings(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.patch(
            f"/api/core/labs/{self.lab_a.id}/",
            {"city": "Bratislava"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.lab_a.refresh_from_db()
        self.assertEqual(self.lab_a.city, "Bratislava")

    def test_admin_can_update_own_lab_billing_defaults(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.patch(
            f"/api/core/labs/{self.lab_a.id}/",
            {
                "invoice_prefix": "MOL",
                "invoice_due_days": 21,
                "vat_rate": "20.00",
                "payment_method": "cash",
                "invoice_default_note": "Dakujeme za spolupracu.",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.lab_a.refresh_from_db()
        self.assertEqual(self.lab_a.invoice_prefix, "MOL")
        self.assertEqual(self.lab_a.invoice_due_days, 21)
        self.assertEqual(str(self.lab_a.vat_rate), "20.00")
        self.assertEqual(self.lab_a.payment_method, "cash")
        self.assertEqual(self.lab_a.invoice_default_note, "Dakujeme za spolupracu.")

    def test_admin_cannot_update_other_lab_settings(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.patch(
            f"/api/core/labs/{self.lab_b.id}/",
            {"city": "Kosice"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.lab_b.refresh_from_db()
        self.assertIsNone(self.lab_b.city)

    def test_global_search_returns_lab_scoped_results(self):
        clinic_a = Clinic.objects.create(lab=self.lab_a, name="Klinika A")
        patient_a = Patient.objects.create(
            lab=self.lab_a,
            first_name="Mária",
            last_name="Kováčová",
            birth_number="8512151234",
        )
        job_a = Job.objects.create(
            lab=self.lab_a,
            patient=patient_a,
            clinic=clinic_a,
            description="Zirkónový mostík",
        )
        Invoice.objects.create(
            lab=self.lab_a,
            clinic=clinic_a,
            number="INV-A-001",
            total_amount="120.00",
        )

        clinic_b = Clinic.objects.create(lab=self.lab_b, name="Klinika B")
        patient_b = Patient.objects.create(
            lab=self.lab_b,
            first_name="Mária",
            last_name="Cudzia",
            birth_number="9001011234",
        )
        Job.objects.create(
            lab=self.lab_b,
            patient=patient_b,
            clinic=clinic_b,
            description="Cudzia práca",
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/search/?q=Mária")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        result_ids = {item["id"] for item in response.data["results"]}
        self.assertIn(f"patient:{patient_a.id}", result_ids)
        self.assertIn(f"job:{job_a.id}", result_ids)
        self.assertNotIn(f"patient:{patient_b.id}", result_ids)

    def test_global_search_returns_invoices_and_static_actions(self):
        clinic = Clinic.objects.create(lab=self.lab_a, name="Klinika Bratislava")
        invoice = Invoice.objects.create(
            lab=self.lab_a,
            clinic=clinic,
            number="INV-2026-001",
            total_amount="240.00",
        )

        self.client.force_authenticate(user=self.admin_a)
        invoice_response = self.client.get("/api/core/search/?q=INV-2026")
        action_response = self.client.get("/api/search/?q=novú prácu")

        self.assertEqual(invoice_response.status_code, status.HTTP_200_OK)
        self.assertEqual(action_response.status_code, status.HTTP_200_OK)
        self.assertIn(
            f"invoice:{invoice.id}",
            {item["id"] for item in invoice_response.data["results"]},
        )
        self.assertIn(
            "action:new-job",
            {item["id"] for item in action_response.data["results"]},
        )

    def test_global_search_denies_user_without_lab(self):
        no_lab_user = User.objects.create_user(
            username="no_lab_search",
            email="no-lab-search@example.com",
            password="password123",
            role="user",
        )

        self.client.force_authenticate(user=no_lab_user)
        response = self.client.get("/api/search/?q=test")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_global_search_spans_labs(self):
        patient_b = Patient.objects.create(
            lab=self.lab_b,
            first_name="Peter",
            last_name="Horvath",
            birth_number="9001011234",
        )

        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get("/api/search/?q=Peter")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn(
            f"patient:{patient_b.id}",
            {item["id"] for item in response.data["results"]},
        )
        self.assertIn(
            "page:superadmin",
            {item["id"] for item in self.client.get("/api/search/").data["results"]},
        )

    def test_notifications_are_scoped_to_recipient(self):
        own = Notification.objects.create(
            lab=self.lab_a,
            recipient=self.admin_a,
            type="job",
            title="New job assigned",
            message="#12",
        )
        Notification.objects.create(
            lab=self.lab_a,
            recipient=self.user_a,
            type="system",
            title="Other user notification",
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/notifications/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [own.id])

    def test_notification_mark_read_and_unread_count(self):
        notification = Notification.objects.create(
            lab=self.lab_a,
            recipient=self.admin_a,
            type="invoice",
            title="Invoice paid",
        )

        self.client.force_authenticate(user=self.admin_a)
        count_response = self.client.get("/api/notifications/unread-count/")
        mark_response = self.client.post(
            f"/api/notifications/{notification.id}/mark-read/"
        )
        next_count_response = self.client.get("/api/notifications/unread-count/")

        self.assertEqual(count_response.status_code, status.HTTP_200_OK)
        self.assertEqual(count_response.data["unread_count"], 1)
        self.assertEqual(mark_response.status_code, status.HTTP_200_OK)
        self.assertTrue(mark_response.data["is_read"])
        self.assertEqual(next_count_response.data["unread_count"], 0)

    def test_notification_mark_all_read_updates_only_visible_notifications(self):
        own = Notification.objects.create(
            lab=self.lab_a,
            recipient=self.admin_a,
            title="Own",
        )
        other = Notification.objects.create(
            lab=self.lab_a,
            recipient=self.user_a,
            title="Other",
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post("/api/notifications/mark-all-read/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated"], 1)
        own.refresh_from_db()
        other.refresh_from_db()
        self.assertIsNotNone(own.read_at)
        self.assertIsNone(other.read_at)

    def test_permissions_endpoint_returns_admin_navigation_contract(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/permissions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["role"], "admin")
        navigation = {item["id"]: item for item in response.data["navigation"]}
        self.assertTrue(navigation["finance"]["allowed"])
        self.assertTrue(navigation["settings"]["allowed"])
        self.assertFalse(navigation["superadmin"]["allowed"])
        self.assertTrue(response.data["actions"]["create_invoice"])

    def test_permissions_endpoint_limits_technician_navigation(self):
        technician = User.objects.create_user(
            username="permissions_tech",
            email="permissions-tech@example.com",
            password="password123",
            role="technician",
            lab=self.lab_a,
        )

        self.client.force_authenticate(user=technician)
        response = self.client.get("/api/core/permissions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        navigation = {item["id"]: item for item in response.data["navigation"]}
        self.assertTrue(navigation["jobs"]["allowed"])
        self.assertFalse(navigation["finance"]["allowed"])
        self.assertFalse(response.data["actions"]["create_patient"])

    def test_permissions_endpoint_exposes_superadmin_platform_access(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get("/api/permissions/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        navigation = {item["id"]: item for item in response.data["navigation"]}
        self.assertTrue(response.data["is_superadmin"])
        self.assertTrue(navigation["superadmin"]["allowed"])
        self.assertTrue(response.data["actions"]["manage_platform"])
