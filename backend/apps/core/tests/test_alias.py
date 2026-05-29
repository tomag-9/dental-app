from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import AuditLog, Notification, TeamInvitation
from apps.core.test_helpers import RoleMatrixTestMixin
from apps.crm.models import Clinic
from apps.finance.models import Invoice
from apps.inventory.models import WarehouseItem
from apps.jobs.models import CalendarEvent, Vacation


class AliasAuthenticationTests(RoleMatrixTestMixin, APITestCase):
    def setUp(self):
        self.setup_role_matrix(prefix="alias")
        self.clinic_a = Clinic.objects.create(lab=self.lab_a, name="Alias Clinic A")
        self.clinic_b = Clinic.objects.create(lab=self.lab_b, name="Alias Clinic B")
        self.invoice_a = Invoice.objects.create(
            lab=self.lab_a,
            clinic=self.clinic_a,
            number="ALIAS-A-001",
            total_amount="120.00",
        )
        self.invoice_b = Invoice.objects.create(
            lab=self.lab_b,
            clinic=self.clinic_b,
            number="ALIAS-B-001",
            total_amount="240.00",
        )
        self.item_a = WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Alias Item A",
            sku="ALIAS-A",
            quantity=10,
        )
        self.item_b = WarehouseItem.objects.create(
            lab=self.lab_b,
            name="Alias Item B",
            sku="ALIAS-B",
            quantity=20,
        )
        self.vacation_a = Vacation.objects.create(
            lab=self.lab_a,
            start=timezone.now(),
            end=timezone.now() + timezone.timedelta(days=1),
            description="Alias Vacation A",
        )
        self.vacation_b = Vacation.objects.create(
            lab=self.lab_b,
            start=timezone.now(),
            end=timezone.now() + timezone.timedelta(days=1),
            description="Alias Vacation B",
        )
        self.event_a = CalendarEvent.objects.create(
            lab=self.lab_a,
            title="Alias Event A",
            event_type="meeting",
            start=timezone.now(),
        )
        self.event_b = CalendarEvent.objects.create(
            lab=self.lab_b,
            title="Alias Event B",
            event_type="meeting",
            start=timezone.now(),
        )

    def test_root_and_app_alias_lists_require_authentication(self):
        aliases = [
            "/api/users/",
            "/api/core/users/",
            "/api/labs/",
            "/api/core/labs/",
            "/api/invoices/",
            "/api/finance/invoices/",
            "/api/warehouse/",
            "/api/inventory/warehouse/",
            "/api/vacations/",
            "/api/jobs/vacations/",
            "/api/calendar-events/",
            "/api/jobs/calendar-events/",
        ]

        for alias in aliases:
            with self.subTest(alias=alias):
                response = self.client.get(alias)
                self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_role_matrix_helper_covers_alias_list_auth_contract(self):
        self.assert_endpoint_matrix(
            "GET",
            "/api/warehouse/",
            {
                "anonymous": status.HTTP_401_UNAUTHORIZED,
                "admin": status.HTTP_200_OK,
                "user": status.HTTP_200_OK,
                "technician": status.HTTP_200_OK,
                "no_lab": status.HTTP_200_OK,
                "superadmin": status.HTTP_200_OK,
            },
        )

    def test_user_aliases_have_same_lab_scoping_and_serializer_contract(self):
        self.client.force_authenticate(user=self.admin_a)
        root = self.client.get("/api/users/")
        scoped = self.client.get("/api/core/users/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(self.response_ids(root), self.response_ids(scoped))
        self.assertIn(self.admin_a.id, self.response_ids(root))
        self.assertIn(self.user_a.id, self.response_ids(root))
        self.assertNotIn(self.admin_b.id, self.response_ids(root))
        self.assertEqual(set(root.data[0].keys()), set(scoped.data[0].keys()))

    def test_user_list_role_matrix_contract(self):
        self.assert_endpoint_matrix(
            "GET",
            "/api/core/users/",
            {
                "anonymous": status.HTTP_401_UNAUTHORIZED,
                "admin": status.HTTP_200_OK,
                "user": status.HTTP_403_FORBIDDEN,
                "technician": status.HTTP_403_FORBIDDEN,
                "no_lab": status.HTTP_403_FORBIDDEN,
                "superadmin": status.HTTP_200_OK,
            },
        )

    def test_user_detail_aliases_share_serializer_fields(self):
        self.client.force_authenticate(user=self.admin_a)
        root = self.client.get(f"/api/users/{self.user_a.id}/")
        scoped = self.client.get(f"/api/core/users/{self.user_a.id}/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(root.data["id"], scoped.data["id"])
        self.assertEqual(set(root.data.keys()), set(scoped.data.keys()))

    def test_user_detail_role_matrix_contract(self):
        self.assert_endpoint_matrix(
            "GET",
            f"/api/core/users/{self.user_a.id}/",
            {
                "anonymous": status.HTTP_401_UNAUTHORIZED,
                "admin": status.HTTP_200_OK,
                "user": status.HTTP_403_FORBIDDEN,
                "technician": status.HTTP_403_FORBIDDEN,
                "no_lab": status.HTTP_403_FORBIDDEN,
                "superadmin": status.HTTP_200_OK,
            },
        )

    def test_invoice_aliases_have_same_lab_scoping_and_serializer_contract(self):
        self.client.force_authenticate(user=self.admin_a)
        root = self.client.get("/api/invoices/")
        scoped = self.client.get("/api/finance/invoices/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(self.response_ids(root), self.response_ids(scoped))
        self.assertEqual(self.response_ids(root), {self.invoice_a.id})
        self.assertEqual(set(root.data[0].keys()), set(scoped.data[0].keys()))

    def test_invoice_detail_aliases_share_serializer_fields(self):
        self.client.force_authenticate(user=self.admin_a)
        root = self.client.get(f"/api/invoices/{self.invoice_a.id}/")
        scoped = self.client.get(f"/api/finance/invoices/{self.invoice_a.id}/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(root.data["id"], scoped.data["id"])
        self.assertEqual(set(root.data.keys()), set(scoped.data.keys()))

    def test_warehouse_aliases_have_same_lab_scoping_and_serializer_contract(self):
        self.client.force_authenticate(user=self.admin_a)
        root = self.client.get("/api/warehouse/")
        scoped = self.client.get("/api/inventory/warehouse/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(self.response_ids(root), self.response_ids(scoped))
        self.assertEqual(self.response_ids(root), {self.item_a.id})
        self.assertEqual(set(root.data[0].keys()), set(scoped.data[0].keys()))

    def test_warehouse_detail_aliases_share_serializer_fields(self):
        self.client.force_authenticate(user=self.admin_a)
        root = self.client.get(f"/api/warehouse/{self.item_a.id}/")
        scoped = self.client.get(f"/api/inventory/warehouse/{self.item_a.id}/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(root.data["id"], scoped.data["id"])
        self.assertEqual(set(root.data.keys()), set(scoped.data.keys()))

    def test_vacation_aliases_have_same_lab_scoping(self):
        self.client.force_authenticate(user=self.admin_a)
        root = self.client.get("/api/vacations/")
        scoped = self.client.get("/api/jobs/vacations/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(self.response_ids(root), self.response_ids(scoped))
        self.assertEqual(self.response_ids(root), {self.vacation_a.id})

    def test_calendar_event_aliases_have_same_lab_scoping(self):
        self.client.force_authenticate(user=self.admin_a)
        root = self.client.get("/api/calendar-events/")
        scoped = self.client.get("/api/jobs/calendar-events/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(self.response_ids(root), self.response_ids(scoped))
        self.assertEqual(self.response_ids(root), {self.event_a.id})

    def test_labs_aliases_have_same_lab_scoping_and_serializer_contract(self):
        self.client.force_authenticate(user=self.admin_a)
        root = self.client.get("/api/labs/")
        scoped = self.client.get("/api/core/labs/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(self.response_ids(root), self.response_ids(scoped))
        self.assertEqual(self.response_ids(root), {self.lab_a.id})
        self.assertNotIn(self.lab_b.id, self.response_ids(root))
        self.assertEqual(set(root.data[0].keys()), set(scoped.data[0].keys()))

    def test_labs_alias_superadmin_sees_all_labs(self):
        self.client.force_authenticate(user=self.superadmin)
        root = self.client.get("/api/labs/")
        scoped = self.client.get("/api/core/labs/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(self.response_ids(root), self.response_ids(scoped))
        self.assertIn(self.lab_a.id, self.response_ids(root))
        self.assertIn(self.lab_b.id, self.response_ids(root))

    def test_labs_alias_no_lab_user_gets_empty_list(self):
        self.client.force_authenticate(user=self.no_lab_user)
        for url in ["/api/labs/", "/api/core/labs/"]:
            with self.subTest(url=url):
                resp = self.client.get(url)
                self.assertEqual(resp.status_code, status.HTTP_200_OK)
                self.assertEqual(len(resp.data), 0)

    def test_audit_logs_aliases_superadmin_only(self):
        # Non-superadmin roles get 403 from both aliases.
        for role_user in [
            self.admin_a,
            self.user_a,
            self.technician_a,
            self.no_lab_user,
        ]:
            with self.subTest(user=role_user.username):
                self.client.force_authenticate(user=role_user)
                for url in ["/api/audit-logs/", "/api/core/audit-logs/"]:
                    resp = self.client.get(url)
                    self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN, url)

    def test_audit_logs_aliases_superadmin_sees_same_records(self):
        AuditLog.objects.create(
            action="test.event",
            entity_type="test",
            entity_id=1,
            lab=self.lab_a,
        )
        self.client.force_authenticate(user=self.superadmin)
        root = self.client.get("/api/audit-logs/")
        scoped = self.client.get("/api/core/audit-logs/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(self.response_ids(root), self.response_ids(scoped))

    def test_team_invitations_aliases_admin_sees_same_lab_scope(self):
        TeamInvitation.objects.create(
            lab=self.lab_a,
            email="invite_a@test.com",
            role="user",
            invited_by=self.admin_a,
            token="token-a-alias",
            status="pending",
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        TeamInvitation.objects.create(
            lab=self.lab_b,
            email="invite_b@test.com",
            role="user",
            invited_by=self.admin_b,
            token="token-b-alias",
            status="pending",
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        self.client.force_authenticate(user=self.admin_a)
        root = self.client.get("/api/team-invitations/")
        scoped = self.client.get("/api/core/team-invitations/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(self.response_ids(root), self.response_ids(scoped))
        # admin_a only sees their own lab's invitation.
        self.assertEqual(len(root.data), 1)
        self.assertEqual(root.data[0]["email"], "invite_a@test.com")

    def test_team_invitations_aliases_user_gets_empty_list(self):
        # Regular users and technicians cannot manage invitations, but the endpoint
        # returns an empty list (not 403) because get_queryset returns qs.none().
        for role_user in [self.user_a, self.technician_a]:
            with self.subTest(user=role_user.username):
                self.client.force_authenticate(user=role_user)
                for url in ["/api/team-invitations/", "/api/core/team-invitations/"]:
                    resp = self.client.get(url)
                    self.assertEqual(resp.status_code, status.HTTP_200_OK, url)
                    self.assertEqual(len(resp.data), 0, url)

    def test_notifications_aliases_recipient_scoped(self):
        Notification.objects.create(
            lab=self.lab_a,
            recipient=self.admin_a,
            type="info",
            title="Notif for admin_a",
            message="msg",
        )
        Notification.objects.create(
            lab=self.lab_a,
            recipient=self.user_a,
            type="info",
            title="Notif for user_a",
            message="msg",
        )
        self.client.force_authenticate(user=self.admin_a)
        root = self.client.get("/api/notifications/")
        scoped = self.client.get("/api/core/notifications/")

        self.assertEqual(root.status_code, status.HTTP_200_OK)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(self.response_ids(root), self.response_ids(scoped))
        # admin_a only sees their own notification.
        self.assertEqual(len(root.data), 1)
        self.assertEqual(root.data[0]["title"], "Notif for admin_a")
