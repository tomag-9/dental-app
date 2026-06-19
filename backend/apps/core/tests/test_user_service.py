"""
Unit tests for apps.core.user_service — business logic only, no HTTP layer.
"""

from unittest.mock import MagicMock

from django.test import TestCase
from rest_framework.exceptions import PermissionDenied

from apps.core import user_service
from apps.core.models import AuditLog, Lab, User


class UserServiceCreateTests(TestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Service Test Lab")
        self.admin = User.objects.create_user(
            username="svc_admin",
            email="svc_admin@test.sk",
            password="pw",
            role="admin",
            lab=self.lab,
        )
        self.superadmin = User.objects.create_user(
            username="svc_superadmin",
            email="svc_superadmin@test.sk",
            password="pw",
            role="superadmin",
            is_superuser=True,
        )
        self.regular = User.objects.create_user(
            username="svc_regular",
            email="svc_regular@test.sk",
            password="pw",
            role="user",
            lab=self.lab,
        )

    def _mock_serializer(self, *, role="user", lab=None):
        """Build a minimal mock serializer that returns a new User on save()."""
        mock = MagicMock()
        mock.validated_data = {"role": role}
        new_user = User.objects.create_user(
            username=f"created_{role}_{User.objects.count()}",
            email=f"created_{User.objects.count()}@test.sk",
            password="pw",
            role=role,
            lab=lab or self.lab,
        )
        mock.save.return_value = new_user
        return mock

    def test_create_user_by_non_admin_raises_permission_denied(self):
        serializer = self._mock_serializer()
        with self.assertRaises(PermissionDenied):
            user_service.create_user(self.regular, serializer)
        serializer.save.assert_not_called()

    def test_create_user_by_admin_writes_audit_log(self):
        audit_count_before = AuditLog.objects.count()
        serializer = self._mock_serializer(role="user")
        user_service.create_user(self.admin, serializer)
        self.assertEqual(AuditLog.objects.count(), audit_count_before + 1)
        log = AuditLog.objects.latest("id")
        self.assertEqual(log.action, "user.created")
        self.assertEqual(log.actor, self.admin)

    def test_create_user_by_superadmin_saves_without_lab_override(self):
        serializer = self._mock_serializer(role="admin", lab=self.lab)
        user_service.create_user(self.superadmin, serializer)
        # superadmin path: serializer.save() called with no lab kwarg
        serializer.save.assert_called_once_with()

    def test_create_user_by_admin_saves_with_actor_lab(self):
        serializer = self._mock_serializer(role="user")
        user_service.create_user(self.admin, serializer)
        serializer.save.assert_called_once_with(lab=self.lab)

    def test_create_user_superadmin_role_blocked_for_non_superadmin(self):
        mock = MagicMock()
        mock.validated_data = {"role": "superadmin"}
        with self.assertRaises(PermissionDenied):
            user_service.create_user(self.admin, mock)
        mock.save.assert_not_called()


class UserServiceUpdateTests(TestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Update Test Lab")
        self.lab_b = Lab.objects.create(name="Other Lab")
        self.admin = User.objects.create_user(
            username="upd_admin",
            email="upd_admin@test.sk",
            password="pw",
            role="admin",
            lab=self.lab,
        )
        self.superadmin = User.objects.create_user(
            username="upd_superadmin",
            email="upd_superadmin@test.sk",
            password="pw",
            role="superadmin",
            is_superuser=True,
        )
        self.target = User.objects.create_user(
            username="upd_target",
            email="upd_target@test.sk",
            password="pw",
            role="user",
            lab=self.lab,
        )

    def _mock_serializer(self, target):
        mock = MagicMock()
        mock.instance = target
        # save() returns the same instance (simulating in-place update)
        mock.save.return_value = target
        return mock

    def test_update_user_blocks_non_superadmin_lab_change(self):
        serializer = self._mock_serializer(self.target)
        with self.assertRaises(PermissionDenied):
            user_service.update_user(
                self.admin,
                self.target,
                serializer,
                {"lab": self.lab_b.id},
            )
        serializer.save.assert_not_called()

    def test_update_user_writes_audit_log_with_changed_fields(self):
        # Change the target's first_name via serializer mock
        original_first = self.target.first_name

        def fake_save(**kwargs):
            self.target.first_name = "Changed"
            self.target.save(update_fields=["first_name"])
            return self.target

        serializer = self._mock_serializer(self.target)
        serializer.save.side_effect = fake_save

        audit_count_before = AuditLog.objects.count()
        user_service.update_user(
            self.admin, self.target, serializer, {"first_name": "Changed"}
        )

        self.assertEqual(AuditLog.objects.count(), audit_count_before + 1)
        log = AuditLog.objects.latest("id")
        self.assertEqual(log.action, "user.updated")
        self.assertEqual(log.actor, self.admin)
        self.assertIn("first_name", log.metadata.get("fields", []))

        # restore
        self.target.first_name = original_first
        self.target.save(update_fields=["first_name"])

    def test_update_user_by_non_admin_raises_permission_denied(self):
        regular = User.objects.create_user(
            username="upd_regular",
            email="upd_regular@test.sk",
            password="pw",
            role="user",
            lab=self.lab,
        )
        serializer = self._mock_serializer(self.target)
        with self.assertRaises(PermissionDenied):
            user_service.update_user(regular, self.target, serializer, {})
        serializer.save.assert_not_called()

    def test_update_user_superadmin_bypasses_lab_restriction(self):
        serializer = self._mock_serializer(self.target)
        # superadmin can move user to any lab — should not raise
        user_service.update_user(
            self.superadmin,
            self.target,
            serializer,
            {"lab": self.lab_b.id},
        )
        serializer.save.assert_called_once()


class UserServiceDeleteTests(TestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Delete Test Lab")
        self.admin = User.objects.create_user(
            username="del_admin",
            email="del_admin@test.sk",
            password="pw",
            role="admin",
            lab=self.lab,
        )
        self.regular = User.objects.create_user(
            username="del_regular",
            email="del_regular@test.sk",
            password="pw",
            role="user",
            lab=self.lab,
        )

    def test_delete_user_writes_audit_log(self):
        target = User.objects.create_user(
            username="del_target",
            email="del_target@test.sk",
            password="pw",
            role="user",
            lab=self.lab,
        )
        audit_count_before = AuditLog.objects.count()
        user_service.delete_user(self.admin, target)
        self.assertEqual(AuditLog.objects.count(), audit_count_before + 1)
        log = AuditLog.objects.latest("id")
        self.assertEqual(log.action, "user.deleted")
        self.assertEqual(log.actor, self.admin)

    def test_delete_user_actually_deletes(self):
        target = User.objects.create_user(
            username="del_gone",
            email="del_gone@test.sk",
            password="pw",
            role="user",
            lab=self.lab,
        )
        target_id = target.id
        user_service.delete_user(self.admin, target)
        self.assertFalse(User.objects.filter(id=target_id).exists())

    def test_delete_user_by_non_admin_raises_permission_denied(self):
        target = User.objects.create_user(
            username="del_block_target",
            email="del_block_target@test.sk",
            password="pw",
            role="user",
            lab=self.lab,
        )
        with self.assertRaises(PermissionDenied):
            user_service.delete_user(self.regular, target)
        self.assertTrue(User.objects.filter(id=target.id).exists())
