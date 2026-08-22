from rest_framework.test import APITestCase

from apps.core.models import AuditLog, Lab, LabApiKey, User


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
        resp = self.client.post("/api/core/api-keys/", {"name": "My Integration"}, format="json")
        self.assertEqual(resp.status_code, 201)
        self.assertIn("key", resp.data)
        self.assertIn("prefix", resp.data)
        key_val = resp.data["key"]
        self.assertTrue(len(key_val) > 16)

    def test_create_api_key_writes_audit_log(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/core/api-keys/", {"name": "Audit Integration"}, format="json")

        self.assertEqual(resp.status_code, 201)
        log = AuditLog.objects.filter(action="api_key.created").latest("created_at")
        self.assertEqual(log.entity_id, str(resp.data["id"]))
        self.assertEqual(log.actor, self.admin)
        self.assertEqual(log.lab, self.lab)
        self.assertEqual(log.metadata["name"], "Audit Integration")
        self.assertEqual(log.metadata["prefix"], resp.data["prefix"])

    def test_regular_user_cannot_create_api_key(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/core/api-keys/", {"name": "Bad Key"}, format="json")
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
        log = AuditLog.objects.filter(action="permission_override.saved").latest("created_at")
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
        resp = self.client.delete(f"/api/core/labs/{self.lab.id}/permissions/{override.id}/")
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
        resp = self.client.delete(f"/api/core/labs/{self.lab.id}/permissions/{override.id}/")

        self.assertEqual(resp.status_code, 204)
        log = AuditLog.objects.filter(action="permission_override.deleted").latest("created_at")
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

    def test_permission_override_is_enforced_in_runtime_permissions(self):
        # Issue #112: overrides used to be metadata only. They are now the
        # single source of truth behind GET /api/permissions/ and the API
        # guards, so a deny override must be visible in the payload.
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
        self.assertFalse(resp.data["actions"]["create_invoice"])
        # Untouched actions keep their role default.
        self.assertTrue(resp.data["actions"]["create_job"])

    def test_unauthenticated_denied(self):
        resp = self.client.get(f"/api/core/labs/{self.lab.id}/permissions/")
        self.assertEqual(resp.status_code, 401)
