from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import AuditLog, Lab, User


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
        resp = self.client.post(f"/api/core/users/superadmin/{self.target.id}/impersonate/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("access_token", resp.data)
        self.assertIn("refresh_token", resp.data)
        self.assertEqual(resp.data["user"]["id"], self.target.id)

    def test_impersonation_writes_audit_log(self):
        self.client.force_authenticate(user=self.superadmin)
        before = AuditLog.objects.filter(action="user.impersonated").count()
        self.client.post(f"/api/core/users/superadmin/{self.target.id}/impersonate/")
        self.assertEqual(AuditLog.objects.filter(action="user.impersonated").count(), before + 1)

    def test_regular_user_cannot_impersonate(self):
        regular = User.objects.create_user(
            username="imp_regular",
            password="pw",
            email="imp_regular@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.client.force_authenticate(user=regular)
        resp = self.client.post(f"/api/core/users/superadmin/{self.target.id}/impersonate/")
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
