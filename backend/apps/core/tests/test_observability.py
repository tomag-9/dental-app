from unittest.mock import patch

from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import Lab, User


class HealthCheckTests(APITestCase):
    def test_health_check_returns_ok_when_database_available(self):
        resp = self.client.get("/api/health/")

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, {"status": "ok", "checks": {"database": "ok"}})

    @patch("apps.core.views.connection.cursor")
    def test_health_check_returns_503_when_database_unavailable(self, cursor):
        cursor.side_effect = RuntimeError("database unavailable")

        resp = self.client.get("/api/health/")

        self.assertEqual(resp.status_code, 503)
        self.assertEqual(
            resp.data,
            {"status": "unhealthy", "checks": {"database": "error"}},
        )


class RequestLoggingTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Logging Lab")
        self.user = User.objects.create_user(
            username="log_user",
            password="pw",
            email="log@test.sk",
            role="admin",
            lab=self.lab,
        )

    def test_request_log_includes_context_fields(self):
        access_token = RefreshToken.for_user(self.user).access_token

        with self.assertLogs("apps.core.request", level="INFO") as captured:
            resp = self.client.get(
                "/api/health/",
                HTTP_AUTHORIZATION=f"Bearer {access_token}",
                HTTP_X_REQUEST_ID="req-test-123",
            )

        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp["X-Request-ID"], "req-test-123")

        record = captured.records[0]
        self.assertEqual(record.request_id, "req-test-123")
        self.assertEqual(record.method, "GET")
        self.assertEqual(record.path, "/api/health/")
        self.assertEqual(record.status_code, 200)
        self.assertEqual(record.user_id, self.user.id)
        self.assertEqual(record.username, self.user.username)
        self.assertEqual(record.lab_id, self.lab.id)
        self.assertGreaterEqual(record.duration_ms, 0)
