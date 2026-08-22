"""Enforcement tests for per-lab LabRolePermission overrides (issue #112).

The most important tests here are the *regression* ones: with an empty
``LabRolePermission`` table the effective permissions must be byte-for-byte
what the previous hard-coded role logic produced.
"""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.access import (
    LAB_PERMISSION_ACTIONS,
    UI_PERMISSION_ACTIONS,
    has_lab_permission,
    is_admin_or_superadmin,
    lab_permission_overrides,
)
from apps.core.models import Lab, LabRolePermission, User
from apps.core.test_helpers import RoleMatrixTestMixin
from apps.crm.models import Clinic, Patient
from apps.jobs.models import Job

# The exact values the old hard-coded `actions` dict in
# `_role_permission_payload` produced, per role. Do not "fix" this table --
# it is the frozen legacy contract this refactor must not change.
LEGACY_ACTION_DEFAULTS = {
    "superadmin": {
        "create_job": True,
        "create_patient": True,
        "create_invoice": True,
        "manage_inventory": True,
        "manage_team": True,
        "manage_platform": True,
    },
    "admin": {
        "create_job": True,
        "create_patient": True,
        "create_invoice": True,
        "manage_inventory": True,
        "manage_team": True,
        "manage_platform": False,
    },
    "user": {
        "create_job": False,
        "create_patient": False,
        "create_invoice": False,
        "manage_inventory": False,
        "manage_team": False,
        "manage_platform": False,
    },
    "technician": {
        "create_job": False,
        "create_patient": False,
        "create_invoice": False,
        "manage_inventory": False,
        "manage_team": False,
        "manage_platform": False,
    },
}


class PermissionDefaultsRegressionTests(RoleMatrixTestMixin, APITestCase):
    """No overrides in the DB -> behaviour identical to the pre-#112 code."""

    def setUp(self):
        self.setup_role_matrix(prefix="perm_default")

    def test_no_overrides_exist(self):
        self.assertFalse(LabRolePermission.objects.exists())

    def test_permissions_payload_matches_legacy_defaults(self):
        for role, expected in LEGACY_ACTION_DEFAULTS.items():
            with self.subTest(role=role):
                self.client.force_authenticate(user=self.role_users[role])
                resp = self.client.get("/api/core/permissions/")
                self.assertEqual(resp.status_code, status.HTTP_200_OK)
                self.assertEqual(dict(resp.data["actions"]), expected)
                self.client.force_authenticate(user=None)

    def test_has_lab_permission_matches_legacy_role_logic(self):
        for role, expected in LEGACY_ACTION_DEFAULTS.items():
            user = self.role_users[role]
            for action, allowed in expected.items():
                with self.subTest(role=role, action=action):
                    self.assertEqual(has_lab_permission(user, action), allowed)

    def test_ui_actions_still_track_admin_role_by_default(self):
        """The five lab-scoped UI actions equal the old `admin` boolean."""
        for role, user in self.role_users.items():
            for action in UI_PERMISSION_ACTIONS:
                if action == "manage_platform":
                    continue
                with self.subTest(role=role, action=action):
                    self.assertEqual(has_lab_permission(user, action), is_admin_or_superadmin(user))

    def test_no_lab_user_gets_role_defaults(self):
        self.assertEqual(lab_permission_overrides(self.no_lab_user), {})
        self.assertFalse(has_lab_permission(self.no_lab_user, "create_job"))

    def test_anonymous_has_no_permissions(self):
        from django.contrib.auth.models import AnonymousUser

        for action in LAB_PERMISSION_ACTIONS:
            self.assertFalse(has_lab_permission(AnonymousUser(), action))
        self.assertFalse(has_lab_permission(None, "create_job"))


class LabPermissionOverrideEnforcementTests(RoleMatrixTestMixin, APITestCase):
    def setUp(self):
        self.setup_role_matrix(prefix="perm_override")
        self.clinic_a = Clinic.objects.create(lab=self.lab_a, name="Override Clinic A")
        self.clinic_b = Clinic.objects.create(lab=self.lab_b, name="Override Clinic B")
        self.patient_a = Patient.objects.create(
            lab=self.lab_a,
            first_name="Override",
            last_name="Patient",
            birth_number="800101/1234",
        )
        self.patient_b = Patient.objects.create(
            lab=self.lab_b,
            first_name="Override",
            last_name="PatientB",
            birth_number="800101/5678",
        )

    def _deny(self, lab, role, action):
        return LabRolePermission.objects.create(lab=lab, role=role, action=action, allowed=False)

    def _allow(self, lab, role, action):
        return LabRolePermission.objects.create(lab=lab, role=role, action=action, allowed=True)

    def _completed_job(self, lab, clinic):
        return Job.objects.create(
            lab=lab,
            patient=self.patient_a if lab == self.lab_a else self.patient_b,
            clinic=clinic,
            status="completed",
            description="override job",
            price="100.00",
        )

    def _job_payload(self, lab, clinic):
        return {
            "lab": lab.id,
            "patient": (self.patient_a if lab == self.lab_a else self.patient_b).id,
            "clinic": clinic.id,
            "description": "override created job",
            "price": "100.00",
        }

    # --- deny overrides are actually enforced ------------------------------

    def test_deny_override_blocks_invoice_create_with_403(self):
        job = self._completed_job(self.lab_a, self.clinic_a)
        self._deny(self.lab_a, "admin", "create_invoice")

        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.post(
            "/api/finance/invoices/",
            {"clinic_id": self.clinic_a.id, "job_ids": [job.id]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_deny_override_blocks_job_create_with_403(self):
        self._deny(self.lab_a, "admin", "create_job")

        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.post("/api/jobs/jobs/", self._job_payload(self.lab_a, self.clinic_a), format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_deny_override_blocks_warehouse_write_with_403(self):
        self._deny(self.lab_a, "admin", "manage_inventory")

        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.post(
            "/api/inventory/warehouse/",
            {"lab": self.lab_a.id, "name": "Blocked item", "sku": "BLOCK-1", "quantity": 1},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_deny_override_blocks_crm_patient_write_with_403(self):
        self._deny(self.lab_a, "admin", "patient:write")

        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.post(
            "/api/crm/patients/",
            {"lab": self.lab_a.id, "first_name": "Blocked", "last_name": "Patient"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_deny_override_blocks_crm_export(self):
        self._deny(self.lab_a, "admin", "patient:write")

        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.get("/api/crm/patients/export/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_deny_override_blocks_lab_settings_write(self):
        self._deny(self.lab_a, "admin", "lab:write")

        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.patch(f"/api/core/labs/{self.lab_a.id}/", {"name": "Renamed"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_deny_override_is_scoped_to_one_action(self):
        self._deny(self.lab_a, "admin", "create_invoice")

        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.post("/api/jobs/jobs/", self._job_payload(self.lab_a, self.clinic_a), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    # --- tenant isolation ---------------------------------------------------

    def test_override_does_not_leak_into_another_lab(self):
        self._deny(self.lab_a, "admin", "create_job")

        self.client.force_authenticate(user=self.admin_b)
        resp = self.client.post(
            "/api/jobs/jobs/",
            self._job_payload(self.lab_b, self.clinic_b),
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_override_does_not_leak_into_another_labs_payload(self):
        self._deny(self.lab_a, "admin", "create_invoice")

        self.client.force_authenticate(user=self.admin_b)
        resp = self.client.get("/api/core/permissions/")
        self.assertTrue(resp.data["actions"]["create_invoice"])

        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.get("/api/core/permissions/")
        self.assertFalse(resp.data["actions"]["create_invoice"])

    def test_override_for_other_role_does_not_affect_admin(self):
        self._deny(self.lab_a, "user", "create_job")

        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.post("/api/jobs/jobs/", self._job_payload(self.lab_a, self.clinic_a), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    # --- superadmin bypass --------------------------------------------------

    def test_superadmin_bypasses_denying_override(self):
        job = self._completed_job(self.lab_a, self.clinic_a)
        for role in ("admin", "user", "technician"):
            self._deny(self.lab_a, role, "create_invoice")

        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post(
            "/api/finance/invoices/",
            {"clinic_id": self.clinic_a.id, "job_ids": [job.id]},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_superadmin_payload_unaffected_by_overrides(self):
        self._deny(self.lab_a, "admin", "manage_platform")

        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get("/api/core/permissions/")
        self.assertTrue(resp.data["actions"]["manage_platform"])

    # --- grant overrides ----------------------------------------------------

    def test_grant_override_can_widen_within_lab(self):
        self._allow(self.lab_a, "user", "create_job")

        self.client.force_authenticate(user=self.user_a)
        resp = self.client.post("/api/jobs/jobs/", self._job_payload(self.lab_a, self.clinic_a), format="json")
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_grant_override_cannot_hand_out_platform_access(self):
        self._allow(self.lab_a, "admin", "manage_platform")
        self._allow(self.lab_a, "admin", "system_health:read")
        self._allow(self.lab_a, "user", "user:impersonate")

        self.assertFalse(has_lab_permission(self.admin_a, "manage_platform"))
        self.assertFalse(has_lab_permission(self.admin_a, "system_health:read"))
        self.assertFalse(has_lab_permission(self.user_a, "user:impersonate"))

        self.client.force_authenticate(user=self.admin_a)
        self.assertFalse(self.client.get("/api/core/permissions/").data["actions"]["manage_platform"])
        self.assertEqual(
            self.client.get("/api/finance/subscriptions/").status_code,
            status.HTTP_403_FORBIDDEN,
        )
        self.assertEqual(
            self.client.get("/api/core/system-health/").status_code,
            status.HTTP_403_FORBIDDEN,
        )

    def test_grant_override_does_not_reach_across_labs(self):
        self._allow(self.lab_a, "user", "create_job")

        self.client.force_authenticate(user=self.role_users["user"])
        self.assertTrue(has_lab_permission(self.user_a, "create_job"))

        user_b = User.objects.create_user(
            username="perm_override_user_b",
            email="perm_override_user_b@example.com",
            password=self.password,
            role="user",
            lab=self.lab_b,
        )
        self.assertFalse(has_lab_permission(user_b, "create_job"))

    # --- read endpoints reflect overrides -----------------------------------

    def test_permissions_payload_reflects_override(self):
        self._deny(self.lab_a, "admin", "create_invoice")

        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.get("/api/core/permissions/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["actions"]["create_invoice"])
        self.assertTrue(resp.data["actions"]["create_job"])

    def test_permissions_matrix_current_permissions_reflect_override(self):
        self._deny(self.lab_a, "admin", "invoice:write")

        self.client.force_authenticate(user=self.admin_a)
        resp = self.client.get("/api/core/permissions/matrix/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertNotIn("invoice:write", resp.data["current_permissions"])
        # The matrix itself keeps documenting the defaults.
        self.assertIn("invoice:write", resp.data["matrix"]["admin"]["actions"])


class LabPermissionOverrideCacheTests(TestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Cache Lab")
        self.other_lab = Lab.objects.create(name="Cache Lab Other")
        self.admin = User.objects.create_user(
            username="cache_admin",
            email="cache_admin@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )
        LabRolePermission.objects.create(lab=self.lab, role="admin", action="create_invoice", allowed=False)

    def test_overrides_are_loaded_once_per_user_instance(self):
        user = User.objects.get(pk=self.admin.pk)
        with self.assertNumQueries(1):
            self.assertFalse(has_lab_permission(user, "create_invoice"))
            self.assertTrue(has_lab_permission(user, "create_job"))
            self.assertTrue(has_lab_permission(user, "manage_team"))

    def test_cache_is_not_reused_across_labs(self):
        user = User.objects.get(pk=self.admin.pk)
        self.assertFalse(has_lab_permission(user, "create_invoice"))

        # Same in-memory instance moved to a different lab must re-read.
        user.lab = self.other_lab
        self.assertTrue(has_lab_permission(user, "create_invoice"))


class OverrideActionValidationTests(APITestCase):
    """Neznáma akcia sa nesmie dať uložiť ako override.

    Bez tejto validácie by preklep v názve akcie vytvoril riadok, ktorý
    `has_lab_permission` vyhodnotí mimo registra: neznáma akcia obíde kontrolu
    platformových akcií a override s `allowed=True` ju udelí.
    """

    def setUp(self):
        self.lab = Lab.objects.create(name="Override validation lab")
        self.admin = User.objects.create_user(
            username="override_validation_admin",
            password="pwd12345",
            role="admin",
            lab=self.lab,
        )
        self.client.force_authenticate(user=self.admin)
        self.url = f"/api/core/labs/{self.lab.id}/permissions/"

    def test_unknown_action_is_rejected(self):
        resp = self.client.post(
            self.url,
            {"role": "user", "action": "patient:writ", "allowed": True},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(LabRolePermission.objects.filter(lab=self.lab).count(), 0)

    def test_known_action_is_accepted(self):
        resp = self.client.post(
            self.url,
            {"role": "user", "action": "patient:write", "allowed": False},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
