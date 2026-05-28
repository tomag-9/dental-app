import pyotp

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import (
    AuditLog,
    Lab,
    LabApiKey,
    Notification,
    TeamInvitation,
    User,
    UserSession,
)
from apps.core.test_helpers import RoleMatrixTestMixin
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import Invoice, PriceList, Subscription
from apps.inventory.models import WarehouseItem
from apps.jobs.models import CalendarEvent, Job, Technician, Vacation


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

    def test_password_change_requires_current_password(self):
        self.client.force_authenticate(user=self.user_a)

        response = self.client.post(
            "/api/core/users/me/password/",
            {
                "current_password": "wrong-password",
                "new_password": "new_password_456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.user_a.refresh_from_db()
        self.assertTrue(self.user_a.check_password("password123"))

    def test_password_change_updates_password_and_audits(self):
        self.client.force_authenticate(user=self.user_a)

        response = self.client.post(
            "/api/core/users/me/password/",
            {
                "current_password": "password123",
                "new_password": "new_password_456",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user_a.refresh_from_db()
        self.assertTrue(self.user_a.check_password("new_password_456"))
        self.assertTrue(
            AuditLog.objects.filter(
                action="user.password_changed",
                entity_type="user",
                entity_id=str(self.user_a.id),
            ).exists()
        )

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

    def test_admin_create_user_writes_audit_log_with_metadata(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.post(
            "/api/core/users/",
            {
                "username": "audit_created_user",
                "email": "audit_created_user@example.com",
                "password": "password123",
                "role": "technician",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(username="audit_created_user")
        log = AuditLog.objects.filter(action="user.created").latest("created_at")
        self.assertEqual(log.entity_id, str(created.id))
        self.assertEqual(log.actor, self.admin_a)
        self.assertEqual(log.lab, self.lab_a)
        self.assertEqual(log.metadata["role"], "technician")
        self.assertEqual(log.metadata["lab_id"], self.lab_a.id)

    def test_superadmin_create_user_writes_audit_log_for_requested_lab(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.post(
            "/api/core/users/",
            {
                "username": "audit_super_created",
                "email": "audit_super_created@example.com",
                "password": "password123",
                "role": "admin",
                "lab": self.lab_b.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        created = User.objects.get(username="audit_super_created")
        log = AuditLog.objects.filter(action="user.created").latest("created_at")
        self.assertEqual(log.entity_id, str(created.id))
        self.assertEqual(log.actor, self.superadmin)
        self.assertEqual(log.lab, self.lab_b)
        self.assertEqual(log.metadata["role"], "admin")
        self.assertEqual(log.metadata["lab_id"], self.lab_b.id)

    def test_admin_update_user_writes_audit_log_with_changed_fields(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.patch(
            f"/api/core/users/{self.user_a.id}/",
            {"first_name": "Audit", "last_name": "Updated"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = AuditLog.objects.filter(action="user.updated").latest("created_at")
        self.assertEqual(log.entity_id, str(self.user_a.id))
        self.assertEqual(log.actor, self.admin_a)
        self.assertEqual(log.lab, self.lab_a)
        self.assertEqual(log.metadata["fields"], ["first_name", "last_name"])
        self.assertEqual(log.metadata["role"], "user")
        self.assertEqual(log.metadata["lab_id"], self.lab_a.id)

    def test_superadmin_sensitive_user_update_writes_audit_log(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.patch(
            f"/api/core/users/{self.user_a.id}/",
            {"lab": self.lab_b.id, "role": "admin", "is_active": False},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = AuditLog.objects.filter(action="user.updated").latest("created_at")
        self.assertEqual(log.entity_id, str(self.user_a.id))
        self.assertEqual(log.actor, self.superadmin)
        self.assertEqual(log.lab, self.lab_b)
        self.assertEqual(log.metadata["fields"], ["is_active", "lab_id", "role"])
        self.assertEqual(log.metadata["role"], "admin")
        self.assertEqual(log.metadata["lab_id"], self.lab_b.id)

    def test_admin_delete_user_writes_audit_log(self):
        target = User.objects.create_user(
            username="delete_audit_user",
            email="delete_audit_user@example.com",
            password="password123",
            role="user",
            lab=self.lab_a,
        )
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.delete(f"/api/core/users/{target.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(User.objects.filter(id=target.id).exists())
        log = AuditLog.objects.filter(action="user.deleted").latest("created_at")
        self.assertEqual(log.entity_id, str(target.id))
        self.assertEqual(log.actor, self.admin_a)
        self.assertEqual(log.lab, self.lab_a)
        self.assertEqual(log.metadata["role"], "user")
        self.assertEqual(log.metadata["lab_id"], self.lab_a.id)

    def test_superadmin_delete_cross_lab_user_writes_audit_log(self):
        target = User.objects.create_user(
            username="delete_cross_lab_audit_user",
            email="delete_cross_lab_audit_user@example.com",
            password="password123",
            role="user",
            lab=self.lab_b,
        )
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.delete(f"/api/core/users/{target.id}/")

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        log = AuditLog.objects.filter(action="user.deleted").latest("created_at")
        self.assertEqual(log.entity_id, str(target.id))
        self.assertEqual(log.actor, self.superadmin)
        self.assertEqual(log.lab, self.lab_b)
        self.assertEqual(log.metadata["role"], "user")
        self.assertEqual(log.metadata["lab_id"], self.lab_b.id)

    def test_toggle_active_audit_log_records_actor_lab_and_state(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.put(
            f"/api/core/users/superadmin/{self.user_a.id}/toggle-active/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = AuditLog.objects.filter(action="user.toggle_active").latest("created_at")
        self.assertEqual(log.entity_id, str(self.user_a.id))
        self.assertEqual(log.actor, self.superadmin)
        self.assertEqual(log.lab, self.lab_a)
        self.assertEqual(log.metadata["is_active"], False)

    def test_impersonation_audit_log_records_actor_lab_and_target(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.post(
            f"/api/core/users/superadmin/{self.user_a.id}/impersonate/"
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = AuditLog.objects.filter(action="user.impersonated").latest("created_at")
        self.assertEqual(log.entity_id, str(self.user_a.id))
        self.assertEqual(log.actor, self.superadmin)
        self.assertEqual(log.lab, self.lab_a)
        self.assertEqual(log.metadata["impersonated_by"], self.superadmin.id)

    def test_admin_can_only_update_users_in_same_lab(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.patch(
            f"/api/core/users/{self.admin_b.id}/",
            {"nickname": "cross_lab_edit"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_admin_cannot_escalate_user_to_superadmin_via_user_aliases(self):
        self.client.force_authenticate(user=self.admin_a)
        for base_url in ("/api/core/users", "/api/users"):
            response = self.client.patch(
                f"{base_url}/{self.user_a.id}/",
                {"role": "superadmin"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.user_a.refresh_from_db()
        self.assertEqual(self.user_a.role, "user")

    def test_admin_cannot_move_user_to_another_lab_via_user_aliases(self):
        self.client.force_authenticate(user=self.admin_a)
        for base_url in ("/api/core/users", "/api/users"):
            response = self.client.patch(
                f"{base_url}/{self.user_a.id}/",
                {"lab": self.lab_b.id},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.user_a.refresh_from_db()
        self.assertEqual(self.user_a.lab_id, self.lab_a.id)

    def test_admin_cannot_change_is_active_via_user_aliases(self):
        self.client.force_authenticate(user=self.admin_a)
        for base_url in ("/api/core/users", "/api/users"):
            response = self.client.patch(
                f"{base_url}/{self.user_a.id}/",
                {"is_active": "false"},
                format="json",
            )
            self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.user_a.refresh_from_db()
        self.assertTrue(self.user_a.is_active)

    def test_admin_cannot_edit_superadmin_or_change_own_role(self):
        self.client.force_authenticate(user=self.admin_a)
        superadmin_response = self.client.patch(
            f"/api/core/users/{self.superadmin.id}/",
            {"nickname": "not_allowed"},
            format="json",
        )
        self.assertEqual(superadmin_response.status_code, status.HTTP_403_FORBIDDEN)

        self_role_response = self.client.patch(
            f"/api/core/users/{self.admin_a.id}/",
            {"role": "user"},
            format="json",
        )
        self.assertEqual(self_role_response.status_code, status.HTTP_403_FORBIDDEN)
        self.admin_a.refresh_from_db()
        self.assertEqual(self.admin_a.role, "admin")

    def test_superadmin_can_update_sensitive_user_fields(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.patch(
            f"/api/core/users/{self.user_a.id}/",
            {"lab": self.lab_b.id, "role": "admin", "is_active": False},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user_a.refresh_from_db()
        self.assertEqual(self.user_a.lab_id, self.lab_b.id)
        self.assertEqual(self.user_a.role, "admin")
        self.assertFalse(self.user_a.is_active)

    def test_admin_can_create_team_invitation_for_own_lab(self):
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.post(
            "/api/core/team-invitations/",
            {
                "email": "new.member@example.com",
                "role": "technician",
                "lab": self.lab_b.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        invitation = TeamInvitation.objects.get(email="new.member@example.com")
        self.assertEqual(invitation.lab_id, self.lab_a.id)
        self.assertEqual(invitation.role, "technician")
        self.assertEqual(invitation.invited_by_id, self.admin_a.id)
        self.assertEqual(response.data["status"], "pending")
        self.assertTrue(response.data["token"])
        self.assertTrue(
            AuditLog.objects.filter(
                action="team_invitation.created",
                entity_id=str(invitation.id),
            ).exists()
        )

    def test_duplicate_pending_team_invitation_rejected(self):
        TeamInvitation.objects.create(
            lab=self.lab_a,
            email="duplicate@example.com",
            role="user",
            token="duplicate-token",
            invited_by=self.admin_a,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.post(
            "/api/core/team-invitations/",
            {"email": "duplicate@example.com", "role": "user"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_regular_user_cannot_create_team_invitation(self):
        self.client.force_authenticate(user=self.user_a)

        response = self.client.post(
            "/api/core/team-invitations/",
            {"email": "blocked@example.com", "role": "user"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_team_invitation_accept_creates_user(self):
        invitation = TeamInvitation.objects.create(
            lab=self.lab_a,
            email="accepted@example.com",
            role="user",
            token="accept-token",
            invited_by=self.admin_a,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )

        response = self.client.post(
            f"/api/core/team-invitations/{invitation.id}/accept/",
            {
                "token": "accept-token",
                "username": "accepted_user",
                "password": "password123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user = User.objects.get(email="accepted@example.com")
        self.assertEqual(user.lab_id, self.lab_a.id)
        self.assertEqual(user.role, "user")
        invitation.refresh_from_db()
        self.assertEqual(invitation.status, "accepted")
        self.assertEqual(invitation.accepted_by_id, user.id)

    def test_team_invitation_list_is_scoped_to_lab(self):
        own = TeamInvitation.objects.create(
            lab=self.lab_a,
            email="own@example.com",
            role="user",
            token="own-token",
            invited_by=self.admin_a,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        TeamInvitation.objects.create(
            lab=self.lab_b,
            email="other@example.com",
            role="user",
            token="other-token",
            invited_by=self.admin_b,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.get("/api/core/team-invitations/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in response.data], [own.id])

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

    def test_system_health_is_superadmin_only(self):
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.get("/api/system-health/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_system_health_returns_platform_metrics(self):
        TeamInvitation.objects.create(
            lab=self.lab_a,
            email="health@example.com",
            role="user",
            token="health-token",
            invited_by=self.admin_a,
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )
        Notification.objects.create(
            lab=self.lab_a,
            recipient=self.admin_a,
            title="Unread",
        )
        self.client.force_authenticate(user=self.superadmin)

        response = self.client.get("/api/core/system-health/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "ok")
        self.assertIn("generated_at", response.data)
        self.assertEqual(response.data["checks"][0]["service"], "database")
        self.assertEqual(response.data["checks"][0]["status"], "ok")
        self.assertGreaterEqual(response.data["metrics"]["labs"], 2)
        self.assertGreaterEqual(response.data["metrics"]["users"], 4)
        self.assertEqual(response.data["metrics"]["pending_invitations"], 1)
        self.assertEqual(response.data["metrics"]["unread_notifications"], 1)


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


class LabSlugTests(APITestCase):
    def test_slug_auto_generated_on_create(self):
        from apps.core.models import Lab

        lab = Lab.objects.create(name="Moje Laboratórium")
        self.assertNotEqual(lab.slug, "")
        self.assertIn("moje", lab.slug)

    def test_slug_is_unique_across_labs(self):
        from apps.core.models import Lab

        lab1 = Lab.objects.create(name="Duplicate Name Lab")
        lab2 = Lab.objects.create(name="Duplicate Name Lab 2")
        self.assertNotEqual(lab1.slug, lab2.slug)

    def test_slug_not_overwritten_on_save(self):
        from apps.core.models import Lab

        lab = Lab.objects.create(name="Stable Lab")
        original_slug = lab.slug
        lab.address = "New Address"
        lab.save()
        lab.refresh_from_db()
        self.assertEqual(lab.slug, original_slug)

    def test_slug_exposed_in_lab_api(self):
        from apps.core.models import Lab, User

        lab = Lab.objects.create(name="API Slug Lab")
        user = User.objects.create_user(
            username="sluguser",
            password="pw",
            role="superadmin",
            is_superuser=True,
        )
        self.client.force_authenticate(user=user)
        resp = self.client.get(f"/api/labs/{lab.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("slug", resp.data)
        self.assertNotEqual(resp.data["slug"], "")


class SessionEndpointsTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Session Lab")
        self.user = User.objects.create_user(
            username="sess_user",
            password="pw123",
            email="sess@test.sk",
            role="user",
            lab=self.lab,
        )

    def _make_session(self, revoked=False):
        return UserSession.objects.create(
            user=self.user,
            jti="test-jti-12345",
            ip_address="127.0.0.1",
            device_info="TestBrowser/1.0",
            expires_at=timezone.now() + timezone.timedelta(days=1),
            revoked=revoked,
        )

    def test_list_sessions_returns_active_only(self):
        self._make_session(revoked=False)
        UserSession.objects.create(
            user=self.user,
            jti="revoked-jti",
            expires_at=timezone.now() + timezone.timedelta(days=1),
            revoked=True,
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/core/sessions/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["jti"], "test-jti-12345")

    def test_revoke_session(self):
        session = self._make_session()
        self.client.force_authenticate(user=self.user)
        resp = self.client.delete(f"/api/core/sessions/{session.id}/")
        self.assertEqual(resp.status_code, 204)
        session.refresh_from_db()
        self.assertTrue(session.revoked)

    def test_revoke_all_sessions(self):
        UserSession.objects.create(
            user=self.user,
            jti="j1",
            expires_at=timezone.now() + timezone.timedelta(days=1),
        )
        UserSession.objects.create(
            user=self.user,
            jti="j2",
            expires_at=timezone.now() + timezone.timedelta(days=1),
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.delete("/api/core/sessions/revoke-all/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["revoked"], 2)

    def test_cannot_revoke_other_users_session(self):
        other_user = User.objects.create_user(
            username="other_sess",
            password="pw",
            email="other_sess@test.sk",
            lab=self.lab,
            role="user",
        )
        session = UserSession.objects.create(
            user=other_user,
            jti="other-jti",
            expires_at=timezone.now() + timezone.timedelta(days=1),
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.delete(f"/api/core/sessions/{session.id}/")
        self.assertEqual(resp.status_code, 404)


class AuthLoginFlowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.lab = Lab.objects.create(name="Auth Flow Lab")
        self.user = User.objects.create_user(
            username="auth_user",
            password="pw123456",
            email="auth@test.sk",
            role="user",
            lab=self.lab,
        )
        self.inactive = User.objects.create_user(
            username="inactive_auth",
            password="pw123456",
            email="inactive_auth@test.sk",
            role="user",
            lab=self.lab,
            is_active=False,
        )

    def test_token_login_rejects_invalid_credentials(self):
        resp = self.client.post(
            "/api/token/",
            {"username": self.user.username, "password": "wrong"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_login_rejects_malformed_payload(self):
        resp = self.client.post("/api/token/", {"username": self.user.username})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_token_login_rejects_inactive_user(self):
        resp = self.client.post(
            "/api/token/",
            {"username": self.inactive.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_login_creates_user_session(self):
        resp = self.client.post(
            "/api/token/",
            {"username": self.user.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        jti = RefreshToken(resp.data["refresh"])["jti"]
        self.assertTrue(
            UserSession.objects.filter(user=self.user, jti=jti, revoked=False).exists()
        )

    def test_session_login_creates_user_session(self):
        resp = self.client.post(
            "/api/core/auth/login/",
            {"username": self.user.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        jti = RefreshToken(resp.data["refresh"])["jti"]
        self.assertTrue(
            UserSession.objects.filter(user=self.user, jti=jti, revoked=False).exists()
        )

    def test_2fa_enabled_user_requires_totp_code_at_login(self):
        self.user.totp_secret = pyotp.random_base32()
        self.user.totp_enabled = True
        self.user.save(update_fields=["totp_secret", "totp_enabled"])

        resp = self.client.post(
            "/api/token/",
            {"username": self.user.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_2fa_enabled_user_rejects_invalid_totp_code(self):
        self.user.totp_secret = pyotp.random_base32()
        self.user.totp_enabled = True
        self.user.save(update_fields=["totp_secret", "totp_enabled"])

        resp = self.client.post(
            "/api/token/",
            {
                "username": self.user.username,
                "password": "pw123456",
                "totp_code": "000000",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_2fa_enabled_user_can_login_with_valid_totp_code(self):
        self.user.totp_secret = pyotp.random_base32()
        self.user.totp_enabled = True
        self.user.save(update_fields=["totp_secret", "totp_enabled"])
        code = pyotp.TOTP(self.user.totp_secret).now()

        resp = self.client.post(
            "/api/token/",
            {
                "username": self.user.username,
                "password": "pw123456",
                "totp_code": code,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_revoked_session_refresh_token_is_rejected(self):
        login = self.client.post(
            "/api/token/",
            {"username": self.user.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.user)
        revoke = self.client.delete("/api/core/sessions/revoke-all/")
        self.assertEqual(revoke.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)
        refresh = self.client.post(
            "/api/token/refresh/",
            {"refresh": login.data["refresh"]},
            format="json",
        )
        self.assertEqual(refresh.status_code, status.HTTP_401_UNAUTHORIZED)


class AuthThrottleTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.lab = Lab.objects.create(name="Throttle Lab")
        self.admin = User.objects.create_user(
            username="throttle_admin",
            password="pw123456",
            email="throttle_admin@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.user = User.objects.create_user(
            username="throttle_user",
            password="pw123456",
            email="throttle_user@test.sk",
            role="user",
            lab=self.lab,
        )

    def _assert_throttled_after_allowed_responses(self, statuses, allowed_status):
        self.assertIn(status.HTTP_429_TOO_MANY_REQUESTS, statuses)
        first_throttled = statuses.index(status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertGreater(first_throttled, 0)
        self.assertEqual(statuses[:first_throttled], [allowed_status] * first_throttled)

    def test_login_endpoint_is_throttled(self):
        payload = {"username": self.user.username, "password": "wrong"}
        statuses = [
            self.client.post("/api/token/", payload).status_code for _ in range(11)
        ]
        self._assert_throttled_after_allowed_responses(
            statuses, status.HTTP_401_UNAUTHORIZED
        )

    def test_signup_endpoint_is_throttled(self):
        statuses = []
        for idx in range(11):
            statuses.append(
                self.client.post(
                    "/api/core/users/signup/",
                    {
                        "lab_name": f"Throttle Signup {idx}",
                        "email": f"signup{idx}@test.sk",
                        "password": "pw123456",
                    },
                    format="json",
                ).status_code
            )
        self._assert_throttled_after_allowed_responses(
            statuses, status.HTTP_201_CREATED
        )

    def test_invitation_accept_endpoint_is_throttled(self):
        invitation = TeamInvitation.objects.create(
            lab=self.lab,
            email="invited-throttle@test.sk",
            role="user",
            token="correct-token",
            expires_at=timezone.now() + timezone.timedelta(days=1),
            invited_by=self.admin,
        )
        url = f"/api/core/team-invitations/{invitation.id}/accept/"
        payload = {"token": "wrong-token", "password": "pw123456"}

        statuses = [self.client.post(url, payload).status_code for _ in range(11)]
        self._assert_throttled_after_allowed_responses(
            statuses, status.HTTP_403_FORBIDDEN
        )

    def test_two_factor_verify_endpoint_is_throttled(self):
        self.client.force_authenticate(user=self.user)
        setup = self.client.post("/api/core/2fa/?action=setup")
        self.assertEqual(setup.status_code, status.HTTP_200_OK)
        payload = {"code": "000000"}

        statuses = [
            self.client.post("/api/core/2fa/?action=verify", payload).status_code
            for _ in range(11)
        ]
        self._assert_throttled_after_allowed_responses(
            statuses, status.HTTP_400_BAD_REQUEST
        )

    def test_api_key_create_endpoint_is_throttled(self):
        self.client.force_authenticate(user=self.admin)
        statuses = []
        for idx in range(11):
            statuses.append(
                self.client.post(
                    "/api/core/api-keys/",
                    {"name": f"Throttle Key {idx}"},
                    format="json",
                ).status_code
            )
        self._assert_throttled_after_allowed_responses(
            statuses, status.HTTP_201_CREATED
        )


class SuperadminMetricsTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Metrics Lab")
        self.superadmin = User.objects.create_user(
            username="metrics_sa",
            password="pw",
            email="metrics_sa@test.sk",
            role="superadmin",
            is_superuser=True,
        )
        self.regular = User.objects.create_user(
            username="metrics_user",
            password="pw",
            email="metrics_u@test.sk",
            role="user",
            lab=self.lab,
        )

    def test_superadmin_can_access_metrics(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get("/api/core/superadmin-metrics/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("total_labs", resp.data)
        self.assertIn("total_users", resp.data)
        self.assertIn("mrr", resp.data)
        self.assertIn("recent_activity", resp.data)
        self.assertGreaterEqual(resp.data["total_labs"], 1)

    def test_regular_user_cannot_access_metrics(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.get("/api/core/superadmin-metrics/")
        self.assertEqual(resp.status_code, 403)


class AvatarUrlTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Avatar Lab")
        self.user = User.objects.create_user(
            username="avatar_user",
            password="pw",
            email="avatar@test.sk",
            role="user",
            lab=self.lab,
        )

    def test_update_avatar_url(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.patch(
            "/api/core/users/me/avatar/",
            {"avatar_url": "https://example.com/avatar.jpg"},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["avatar_url"], "https://example.com/avatar.jpg")
        self.user.refresh_from_db()
        self.assertEqual(self.user.avatar_url, "https://example.com/avatar.jpg")

    def test_clear_avatar_url(self):
        self.user.avatar_url = "https://example.com/old.jpg"
        self.user.save()
        self.client.force_authenticate(user=self.user)
        resp = self.client.patch("/api/core/users/me/avatar/", {"avatar_url": ""})
        self.assertEqual(resp.status_code, 200)
        self.assertIsNone(resp.data["avatar_url"])

    def test_avatar_url_exposed_in_me_endpoint(self):
        self.user.avatar_url = "https://example.com/pic.png"
        self.user.save()
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/core/users/me/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["avatar_url"], "https://example.com/pic.png")


class LabApiKeyTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="ApiKey Lab")
        self.admin = User.objects.create_user(
            username="apikey_admin",
            password="pw",
            email="apikey_admin@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.user = User.objects.create_user(
            username="apikey_user",
            password="pw",
            email="apikey_user@test.sk",
            role="user",
            lab=self.lab,
        )

    def test_admin_can_create_api_key(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            "/api/core/api-keys/", {"name": "My Integration"}, format="json"
        )
        self.assertEqual(resp.status_code, 201)
        self.assertIn("key", resp.data)
        self.assertIn("prefix", resp.data)
        key_val = resp.data["key"]
        self.assertTrue(len(key_val) > 16)

    def test_create_api_key_writes_audit_log(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            "/api/core/api-keys/", {"name": "Audit Integration"}, format="json"
        )

        self.assertEqual(resp.status_code, 201)
        log = AuditLog.objects.filter(action="api_key.created").latest("created_at")
        self.assertEqual(log.entity_id, str(resp.data["id"]))
        self.assertEqual(log.actor, self.admin)
        self.assertEqual(log.lab, self.lab)
        self.assertEqual(log.metadata["name"], "Audit Integration")
        self.assertEqual(log.metadata["prefix"], resp.data["prefix"])

    def test_regular_user_cannot_create_api_key(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            "/api/core/api-keys/", {"name": "Bad Key"}, format="json"
        )
        self.assertEqual(resp.status_code, 403)

    def test_admin_can_list_api_keys(self):
        LabApiKey.objects.create(
            lab=self.lab,
            name="Existing Key",
            prefix="ab12cd34",
            hashed_key="abc123",
            created_by=self.admin,
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/core/api-keys/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertNotIn("hashed_key", resp.data[0])

    def test_revoke_api_key(self):
        key = LabApiKey.objects.create(
            lab=self.lab,
            name="Revoke Me",
            prefix="xx12",
            hashed_key="hash",
            created_by=self.admin,
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(f"/api/core/api-keys/{key.id}/")
        self.assertEqual(resp.status_code, 204)
        key.refresh_from_db()
        self.assertFalse(key.is_active)

    def test_revoke_api_key_writes_audit_log(self):
        key = LabApiKey.objects.create(
            lab=self.lab,
            name="Audit Revoke",
            prefix="rv12",
            hashed_key="hash",
            created_by=self.admin,
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(f"/api/core/api-keys/{key.id}/")

        self.assertEqual(resp.status_code, 204)
        log = AuditLog.objects.filter(action="api_key.revoked").latest("created_at")
        self.assertEqual(log.entity_id, str(key.id))
        self.assertEqual(log.actor, self.admin)
        self.assertEqual(log.lab, self.lab)
        self.assertEqual(log.metadata["name"], "Audit Revoke")
        self.assertEqual(log.metadata["prefix"], "rv12")

    def test_name_required(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/core/api-keys/", {"name": ""}, format="json")
        self.assertIn(resp.status_code, [400])


class ImpersonationTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Impersonation Lab")
        self.superadmin = User.objects.create_user(
            username="imp_sa",
            password="pw",
            email="imp_sa@test.sk",
            role="superadmin",
            is_superuser=True,
        )
        self.target = User.objects.create_user(
            username="imp_target",
            password="pw",
            email="imp_target@test.sk",
            role="user",
            lab=self.lab,
        )

    def test_superadmin_can_impersonate(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post(
            f"/api/core/users/superadmin/{self.target.id}/impersonate/"
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access_token", resp.data)
        self.assertIn("refresh_token", resp.data)
        self.assertEqual(resp.data["user"]["id"], self.target.id)

    def test_impersonation_writes_audit_log(self):
        self.client.force_authenticate(user=self.superadmin)
        before = AuditLog.objects.filter(action="user.impersonated").count()
        self.client.post(f"/api/core/users/superadmin/{self.target.id}/impersonate/")
        self.assertEqual(
            AuditLog.objects.filter(action="user.impersonated").count(), before + 1
        )

    def test_regular_user_cannot_impersonate(self):
        regular = User.objects.create_user(
            username="imp_regular",
            password="pw",
            email="imp_regular@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.client.force_authenticate(user=regular)
        resp = self.client.post(
            f"/api/core/users/superadmin/{self.target.id}/impersonate/"
        )
        self.assertEqual(resp.status_code, 403)

    def test_impersonate_nonexistent_user_returns_404(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post("/api/core/users/superadmin/99999/impersonate/")
        self.assertEqual(resp.status_code, 404)


class SystemHealthRuntimeTests(APITestCase):
    def setUp(self):
        self.superadmin = User.objects.create_user(
            username="health_sa",
            password="pw",
            email="health_sa@test.sk",
            role="superadmin",
            is_superuser=True,
        )

    def test_health_includes_runtime_info(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get("/api/core/system-health/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("runtime", resp.data)
        runtime = resp.data["runtime"]
        self.assertIn("django_version", runtime)
        self.assertIn("python_version", runtime)
        self.assertIn("pending_migrations", runtime)

    def test_health_includes_migration_check(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get("/api/core/system-health/")
        checks = {c["service"]: c for c in resp.data["checks"]}
        self.assertIn("migrations", checks)
        self.assertIn(checks["migrations"]["status"], ["ok", "warning"])


class DashboardChartDataTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Chart Lab")
        self.user = User.objects.create_user(
            username="chart_user",
            password="pw",
            email="chart@test.sk",
            role="admin",
            lab=self.lab,
        )

    def test_chart_data_returns_required_keys(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/core/dashboard/chart-data/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("daily_revenue", resp.data)
        self.assertIn("daily_jobs", resp.data)
        self.assertIn("status_distribution", resp.data)
        self.assertIn("days", resp.data)

    def test_chart_data_daily_revenue_has_correct_length(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/core/dashboard/chart-data/?days=14")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["daily_revenue"]), 14)
        self.assertEqual(len(resp.data["daily_jobs"]), 14)

    def test_chart_data_days_clamped_to_90(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/core/dashboard/chart-data/?days=999")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["days"], 90)

    def test_unauthenticated_denied(self):
        resp = self.client.get("/api/core/dashboard/chart-data/")
        self.assertEqual(resp.status_code, 401)


class TwoFactorTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="2FA Lab")
        self.user = User.objects.create_user(
            username="tfa_user",
            password="pw",
            email="tfa@test.sk",
            role="user",
            lab=self.lab,
        )

    def test_get_2fa_status_unenrolled(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/core/2fa/")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["totp_enabled"])

    def test_setup_returns_secret_and_uri(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/core/2fa/?action=setup")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("secret", resp.data)
        self.assertIn("provisioning_uri", resp.data)
        self.assertIn("otpauth://", resp.data["provisioning_uri"])

    def test_verify_with_valid_code_enables_2fa(self):
        import pyotp

        self.client.force_authenticate(user=self.user)
        self.client.post("/api/core/2fa/?action=setup")
        self.user.refresh_from_db()
        totp = pyotp.TOTP(self.user.totp_secret)
        code = totp.now()
        resp = self.client.post("/api/core/2fa/?action=verify", {"code": code})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["totp_enabled"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.totp_enabled)

    def test_verify_with_invalid_code_returns_400(self):
        self.client.force_authenticate(user=self.user)
        self.client.post("/api/core/2fa/?action=setup")
        resp = self.client.post("/api/core/2fa/?action=verify", {"code": "000000"})
        self.assertEqual(resp.status_code, 400)

    def test_disable_with_valid_code_deactivates_2fa(self):
        import pyotp

        self.client.force_authenticate(user=self.user)
        self.client.post("/api/core/2fa/?action=setup")
        self.user.refresh_from_db()
        totp = pyotp.TOTP(self.user.totp_secret)
        self.client.post("/api/core/2fa/?action=verify", {"code": totp.now()})
        resp = self.client.post("/api/core/2fa/?action=disable", {"code": totp.now()})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["totp_enabled"])

    def test_setup_blocked_when_2fa_already_active(self):
        import pyotp

        self.client.force_authenticate(user=self.user)
        self.client.post("/api/core/2fa/?action=setup")
        self.user.refresh_from_db()
        totp = pyotp.TOTP(self.user.totp_secret)
        self.client.post("/api/core/2fa/?action=verify", {"code": totp.now()})
        resp = self.client.post("/api/core/2fa/?action=setup")
        self.assertEqual(resp.status_code, 400)

    def test_disable_with_missing_secret_returns_400_not_500(self):
        self.client.force_authenticate(user=self.user)
        self.user.totp_enabled = True
        self.user.totp_secret = None
        self.user.save(update_fields=["totp_enabled", "totp_secret"])
        resp = self.client.post("/api/core/2fa/?action=disable", {"code": "123456"})
        self.assertEqual(resp.status_code, 400)

    def test_unauthenticated_denied(self):
        resp = self.client.get("/api/core/2fa/")
        self.assertEqual(resp.status_code, 401)


class PermissionsMatrixTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Matrix Lab")
        self.admin = User.objects.create_user(
            username="matrix_admin",
            password="pw",
            email="matrix@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.user = User.objects.create_user(
            username="matrix_user",
            password="pw",
            email="muser@test.sk",
            role="user",
            lab=self.lab,
        )

    def test_matrix_returns_all_roles(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/core/permissions/matrix/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("matrix", resp.data)
        self.assertIn("superadmin", resp.data["matrix"])
        self.assertIn("admin", resp.data["matrix"])
        self.assertIn("user", resp.data["matrix"])
        self.assertIn("technician", resp.data["matrix"])

    def test_current_role_and_permissions_returned(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/core/permissions/matrix/")
        self.assertEqual(resp.data["current_role"], "admin")
        self.assertIn("lab:write", resp.data["current_permissions"])

    def test_user_role_has_limited_permissions(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/core/permissions/matrix/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["current_role"], "user")
        self.assertNotIn("user:delete", resp.data["current_permissions"])

    def test_unauthenticated_denied(self):
        resp = self.client.get("/api/core/permissions/matrix/")
        self.assertEqual(resp.status_code, 401)


class NotificationFilterTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Notif Lab")
        self.user = User.objects.create_user(
            username="notif_user",
            password="pw",
            email="notif@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.n_job = Notification.objects.create(
            lab=self.lab,
            recipient=self.user,
            type="job",
            title="New job",
            message="",
        )
        self.n_invoice = Notification.objects.create(
            lab=self.lab,
            recipient=self.user,
            type="invoice",
            title="Invoice issued",
            message="",
        )
        from django.utils import timezone as tz

        self.n_read = Notification.objects.create(
            lab=self.lab,
            recipient=self.user,
            type="system",
            title="Read notif",
            message="",
            read_at=tz.now(),
        )

    def test_type_filter_returns_only_matching(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/notifications/?type=job")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["id"], self.n_job.id)

    def test_unread_filter_excludes_read_notifications(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/notifications/?unread=1")
        self.assertEqual(resp.status_code, 200)
        ids = [n["id"] for n in resp.data]
        self.assertIn(self.n_job.id, ids)
        self.assertIn(self.n_invoice.id, ids)
        self.assertNotIn(self.n_read.id, ids)

    def test_combined_type_and_unread_filter(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/notifications/?type=invoice&unread=true")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["id"], self.n_invoice.id)


class DashboardTodayScheduleVacationTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Schedule Lab")
        self.user = User.objects.create_user(
            username="sched_user",
            password="pw",
            email="sched@test.sk",
            role="admin",
            lab=self.lab,
        )
        from apps.jobs.models import Vacation
        from django.utils import timezone as tz

        today = tz.now()
        self.vacation = Vacation.objects.create(
            lab=self.lab,
            start=today.replace(hour=0, minute=0, second=0),
            end=today.replace(hour=23, minute=59, second=59),
            description="Testovacia dovolenka",
        )

    def test_today_schedule_includes_vacation(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/dashboard/stats/")
        self.assertEqual(resp.status_code, 200)
        schedule = resp.data.get("today_schedule", [])
        types = [item["type"] for item in schedule]
        self.assertIn("vacation", types)
        vacation_items = [item for item in schedule if item["type"] == "vacation"]
        self.assertEqual(vacation_items[0]["title"], "Testovacia dovolenka")


class LabSettingsValidationTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Validation Lab")
        self.admin = User.objects.create_user(
            username="val_admin",
            password="pw",
            email="val@test.sk",
            role="admin",
            lab=self.lab,
        )

    def test_vat_rate_above_100_rejected(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(
            f"/api/labs/{self.lab.id}/",
            {"vat_rate": "150.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("vat_rate", resp.data)

    def test_vat_rate_valid_accepted(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(
            f"/api/labs/{self.lab.id}/",
            {"vat_rate": "20.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

    def test_invoice_due_days_zero_rejected(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(
            f"/api/labs/{self.lab.id}/",
            {"invoice_due_days": 0},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("invoice_due_days", resp.data)

    def test_invoice_prefix_with_special_chars_rejected(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(
            f"/api/labs/{self.lab.id}/",
            {"invoice_prefix": "INV/2026!"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("invoice_prefix", resp.data)

    def test_invoice_prefix_alphanumeric_with_dash_accepted(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(
            f"/api/labs/{self.lab.id}/",
            {"invoice_prefix": "LAB-2"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)

    def test_lab_settings_update_writes_audit_log(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(
            f"/api/labs/{self.lab.id}/",
            {"invoice_prefix": "LAB-2", "vat_rate": "20.00"},
            format="json",
        )

        self.assertEqual(resp.status_code, 200)
        log = AuditLog.objects.filter(action="lab.updated").latest("created_at")
        self.assertEqual(log.entity_id, str(self.lab.id))
        self.assertEqual(log.actor, self.admin)
        self.assertEqual(log.lab, self.lab)
        self.assertEqual(log.metadata["fields"], ["invoice_prefix", "vat_rate"])


class LabRolePermissionTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Perm Lab")
        self.other_lab = Lab.objects.create(name="Other Perm Lab")
        self.admin = User.objects.create_user(
            username="perm_admin",
            password="pw",
            email="perm@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.user = User.objects.create_user(
            username="perm_user",
            password="pw",
            email="perm_user@test.sk",
            role="user",
            lab=self.lab,
        )
        self.technician = User.objects.create_user(
            username="perm_technician",
            password="pw",
            email="perm_technician@test.sk",
            role="technician",
            lab=self.lab,
        )
        self.other_admin = User.objects.create_user(
            username="perm_other_admin",
            password="pw",
            email="perm_other@test.sk",
            role="admin",
            lab=self.other_lab,
        )
        self.superadmin = User.objects.create_user(
            username="perm_superadmin",
            password="pw",
            email="perm_super@test.sk",
            role="superadmin",
            is_superuser=True,
        )

    def test_list_permissions_empty(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/core/labs/{self.lab.id}/permissions/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_create_permission_override(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            f"/api/core/labs/{self.lab.id}/permissions/",
            {"role": "user", "action": "crm.export", "allowed": False},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["role"], "user")
        self.assertEqual(resp.data["action"], "crm.export")
        self.assertFalse(resp.data["allowed"])

    def test_create_permission_override_writes_audit_log(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            f"/api/core/labs/{self.lab.id}/permissions/",
            {"role": "user", "action": "crm.export", "allowed": False},
            format="json",
        )

        self.assertEqual(resp.status_code, 201)
        log = AuditLog.objects.filter(action="permission_override.saved").latest(
            "created_at"
        )
        self.assertEqual(log.entity_id, str(resp.data["id"]))
        self.assertEqual(log.actor, self.admin)
        self.assertEqual(log.lab, self.lab)
        self.assertEqual(log.metadata["role"], "user")
        self.assertEqual(log.metadata["action"], "crm.export")
        self.assertFalse(log.metadata["allowed"])

    def test_create_requires_role_and_action(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            f"/api/core/labs/{self.lab.id}/permissions/",
            {"role": "user"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_delete_permission_override(self):
        from apps.core.models import LabRolePermission

        override = LabRolePermission.objects.create(
            lab=self.lab,
            role="user",
            action="crm.export",
            allowed=False,
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(
            f"/api/core/labs/{self.lab.id}/permissions/{override.id}/"
        )
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(LabRolePermission.objects.filter(id=override.id).exists())

    def test_delete_permission_override_writes_audit_log(self):
        from apps.core.models import LabRolePermission

        override = LabRolePermission.objects.create(
            lab=self.lab,
            role="user",
            action="crm.export",
            allowed=False,
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(
            f"/api/core/labs/{self.lab.id}/permissions/{override.id}/"
        )

        self.assertEqual(resp.status_code, 204)
        log = AuditLog.objects.filter(action="permission_override.deleted").latest(
            "created_at"
        )
        self.assertEqual(log.entity_id, str(override.id))
        self.assertEqual(log.actor, self.admin)
        self.assertEqual(log.lab, self.lab)
        self.assertEqual(log.metadata["role"], "user")
        self.assertEqual(log.metadata["action"], "crm.export")
        self.assertFalse(log.metadata["allowed"])

    def test_admin_cannot_manage_other_lab_permissions(self):
        self.client.force_authenticate(user=self.other_admin)
        resp = self.client.get(f"/api/core/labs/{self.lab.id}/permissions/")
        self.assertEqual(resp.status_code, 403)

    def test_regular_user_and_technician_cannot_manage_permissions(self):
        for user in (self.user, self.technician):
            self.client.force_authenticate(user=user)
            resp = self.client.get(f"/api/core/labs/{self.lab.id}/permissions/")
            self.assertEqual(resp.status_code, 403)

    def test_superadmin_can_manage_any_lab_permissions(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post(
            f"/api/core/labs/{self.lab.id}/permissions/",
            {"role": "technician", "action": "jobs.write", "allowed": True},
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["role"], "technician")

    def test_permission_override_is_metadata_only_for_runtime_permissions(self):
        from apps.core.models import LabRolePermission

        LabRolePermission.objects.create(
            lab=self.lab,
            role="admin",
            action="create_invoice",
            allowed=False,
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/core/permissions/")
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["actions"]["create_invoice"])

    def test_unauthenticated_denied(self):
        resp = self.client.get(f"/api/core/labs/{self.lab.id}/permissions/")
        self.assertEqual(resp.status_code, 401)


class SchemaDocsPolicyTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Schema Docs Lab")
        self.admin = User.objects.create_user(
            username="schema_admin",
            password="pw",
            email="schema_admin@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.user = User.objects.create_user(
            username="schema_user",
            password="pw",
            email="schema_user@test.sk",
            role="user",
            lab=self.lab,
        )
        self.superadmin = User.objects.create_user(
            username="schema_superadmin",
            password="pw",
            email="schema_super@test.sk",
            role="superadmin",
            is_superuser=True,
        )

    def test_schema_and_docs_require_authentication(self):
        for url in ("/api/schema/", "/api/docs/"):
            resp = self.client.get(url)
            self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_schema_and_docs_are_admin_only(self):
        self.client.force_authenticate(user=self.user)
        for url in ("/api/schema/", "/api/docs/"):
            resp = self.client.get(url)
            self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_schema_and_docs_allow_admin_and_superadmin(self):
        for user in (self.admin, self.superadmin):
            self.client.force_authenticate(user=user)
            for url in ("/api/schema/", "/api/docs/"):
                resp = self.client.get(url)
                self.assertEqual(resp.status_code, status.HTTP_200_OK)
