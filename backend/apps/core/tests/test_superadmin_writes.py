"""Tests for issue #111 — superadmin tenant management, impersonation, broadcasts.

TDD: written before the corresponding views/model fields exist, so most of
these fail with 404/400/AttributeError against the pre-#111 codebase.
"""

from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from apps.core.models import AuditLog, Lab, Notification, User


class LabIsActiveModelTests(APITestCase):
    def test_lab_is_active_defaults_true(self):
        lab = Lab.objects.create(name="Default Active Lab")
        self.assertTrue(lab.is_active)


class LabSuspendResumeTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Suspend Lab")
        self.superadmin = User.objects.create_user(
            username="susp_sa",
            password="pw",
            email="susp_sa@test.sk",
            role="superadmin",
            is_superuser=True,
        )
        self.admin = User.objects.create_user(
            username="susp_admin",
            password="pw",
            email="susp_admin@test.sk",
            role="admin",
            lab=self.lab,
        )

    def test_superadmin_can_suspend_lab(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post(f"/api/core/labs/{self.lab.id}/suspend/")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.lab.refresh_from_db()
        self.assertFalse(self.lab.is_active)

    def test_suspend_writes_audit_log(self):
        self.client.force_authenticate(user=self.superadmin)
        self.client.post(f"/api/core/labs/{self.lab.id}/suspend/", {"reason": "unpaid"}, format="json")
        log = AuditLog.objects.filter(action="lab.suspended").latest("created_at")
        self.assertEqual(log.lab, self.lab)
        self.assertEqual(log.actor, self.superadmin)

    def test_superadmin_can_activate_suspended_lab(self):
        self.lab.is_active = False
        self.lab.save(update_fields=["is_active"])
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post(f"/api/core/labs/{self.lab.id}/activate/")
        self.assertEqual(resp.status_code, 200, resp.data)
        self.lab.refresh_from_db()
        self.assertTrue(self.lab.is_active)

    def test_regular_admin_cannot_suspend_lab(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(f"/api/core/labs/{self.lab.id}/suspend/")
        self.assertEqual(resp.status_code, 403)

    def test_regular_admin_cannot_activate_lab(self):
        self.lab.is_active = False
        self.lab.save(update_fields=["is_active"])
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(f"/api/core/labs/{self.lab.id}/activate/")
        self.assertEqual(resp.status_code, 403)


class InactiveLabLoginTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Inactive Login Lab", is_active=False)
        self.user = User.objects.create_user(
            username="inactive_lab_user",
            password="pw123456",
            email="inactive_lab@test.sk",
            role="user",
            lab=self.lab,
        )

    def test_inactive_lab_user_cannot_login_via_token(self):
        resp = self.client.post(
            "/api/token/",
            {"username": self.user.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inactive_lab_user_cannot_login_via_session_login(self):
        resp = self.client.post(
            "/api/core/auth/login/",
            {"username": self.user.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_inactive_lab_blocks_existing_token_from_tenant_scope(self):
        # Even with a still-valid token, a suspended lab must not read/write.
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/core/notifications/")
        self.assertEqual(resp.status_code, 403)


class LabDeleteConfirmationTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Delete Me Lab")
        self.superadmin = User.objects.create_user(
            username="del_sa",
            password="pw",
            email="del_sa@test.sk",
            role="superadmin",
            is_superuser=True,
        )
        self.admin = User.objects.create_user(
            username="del_admin",
            password="pw",
            email="del_admin@test.sk",
            role="admin",
            lab=self.lab,
        )

    def test_delete_without_confirm_name_fails(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.delete(f"/api/labs/{self.lab.id}/")
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(Lab.objects.filter(id=self.lab.id).exists())

    def test_delete_with_wrong_confirm_name_fails(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.delete(
            f"/api/labs/{self.lab.id}/",
            {"confirm_name": "Wrong Name"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertTrue(Lab.objects.filter(id=self.lab.id).exists())

    def test_delete_with_correct_confirm_name_writes_audit_before_delete(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.delete(
            f"/api/labs/{self.lab.id}/",
            {"confirm_name": self.lab.name},
            format="json",
        )
        self.assertEqual(resp.status_code, 204)
        self.assertFalse(Lab.objects.filter(id=self.lab.id).exists())
        log = AuditLog.objects.filter(action="lab.deleted").latest("created_at")
        self.assertEqual(log.entity_id, str(self.lab.id))
        self.assertEqual(log.actor, self.superadmin)

    def test_regular_admin_cannot_delete_lab(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(
            f"/api/labs/{self.lab.id}/",
            {"confirm_name": self.lab.name},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)
        self.assertTrue(Lab.objects.filter(id=self.lab.id).exists())


class ImpersonationReasonAuditNotificationTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Impersonation Reason Lab")
        self.superadmin = User.objects.create_user(
            username="imp2_sa",
            password="pw",
            email="imp2_sa@test.sk",
            role="superadmin",
            is_superuser=True,
        )
        self.lab_admin = User.objects.create_user(
            username="imp2_admin",
            password="pw",
            email="imp2_admin@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.target = User.objects.create_user(
            username="imp2_target",
            password="pw",
            email="imp2_target@test.sk",
            role="user",
            lab=self.lab,
        )

    def test_impersonate_without_reason_fails(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post(f"/api/core/users/superadmin/{self.target.id}/impersonate/")
        self.assertEqual(resp.status_code, 400)

    def test_impersonate_with_reason_writes_audit_with_reason(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post(
            f"/api/core/users/superadmin/{self.target.id}/impersonate/",
            {"reason": "Customer reported a bug, reproducing it"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        log = AuditLog.objects.filter(action="user.impersonated").latest("created_at")
        self.assertEqual(log.metadata["reason"], "Customer reported a bug, reproducing it")
        self.assertEqual(log.actor, self.superadmin)
        self.assertEqual(log.lab, self.lab)

    def test_impersonate_creates_notification_for_lab_admin(self):
        self.client.force_authenticate(user=self.superadmin)
        before = Notification.objects.filter(recipient=self.lab_admin).count()
        self.client.post(
            f"/api/core/users/superadmin/{self.target.id}/impersonate/",
            {"reason": "Support ticket #42"},
            format="json",
        )
        after = Notification.objects.filter(recipient=self.lab_admin).count()
        self.assertEqual(after, before + 1)

    def test_impersonation_access_token_has_short_expiry_and_marker_claims(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post(
            f"/api/core/users/superadmin/{self.target.id}/impersonate/",
            {"reason": "Support ticket #42"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        access = AccessToken(resp.data["access_token"])
        self.assertTrue(access["impersonation"])
        self.assertEqual(access["impersonated_by"], self.superadmin.id)
        lifetime = access["exp"] - access["iat"]
        # Deliberately short-lived: well under the normal access token lifetime.
        self.assertLessEqual(lifetime, 30 * 60)

    def test_regular_admin_cannot_impersonate(self):
        self.client.force_authenticate(user=self.lab_admin)
        resp = self.client.post(
            f"/api/core/users/superadmin/{self.target.id}/impersonate/",
            {"reason": "trying anyway"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)


class NotificationBroadcastTests(APITestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Broadcast Lab A")
        self.lab_b = Lab.objects.create(name="Broadcast Lab B")
        self.superadmin = User.objects.create_user(
            username="bc_sa",
            password="pw",
            email="bc_sa@test.sk",
            role="superadmin",
            is_superuser=True,
        )
        self.user_a = User.objects.create_user(
            username="bc_user_a",
            password="pw",
            email="bc_user_a@test.sk",
            role="admin",
            lab=self.lab_a,
        )
        self.user_b = User.objects.create_user(
            username="bc_user_b",
            password="pw",
            email="bc_user_b@test.sk",
            role="user",
            lab=self.lab_b,
        )

    def test_superadmin_can_broadcast_notification_to_all_tenants(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post(
            "/api/core/notifications/broadcast/",
            {"title": "Planned maintenance", "message": "Downtime tonight 22:00-23:00"},
            format="json",
        )
        self.assertEqual(resp.status_code, 201, resp.data)
        self.assertTrue(Notification.objects.filter(recipient=self.user_a, title="Planned maintenance").exists())
        self.assertTrue(Notification.objects.filter(recipient=self.user_b, title="Planned maintenance").exists())

    def test_broadcast_requires_title(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post(
            "/api/core/notifications/broadcast/",
            {"message": "no title"},
            format="json",
        )
        self.assertEqual(resp.status_code, 400)

    def test_regular_admin_cannot_broadcast(self):
        self.client.force_authenticate(user=self.user_a)
        resp = self.client.post(
            "/api/core/notifications/broadcast/",
            {"title": "Hack attempt"},
            format="json",
        )
        self.assertEqual(resp.status_code, 403)
