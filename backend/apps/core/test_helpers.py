from rest_framework import status

from apps.core.models import Lab, User


class RoleMatrixTestMixin:
    """Shared fixtures/assertions for endpoint role matrix tests."""

    password = "password123"

    def setup_role_matrix(self, prefix="matrix"):
        self.lab_a = Lab.objects.create(name=f"{prefix} Lab A")
        self.lab_b = Lab.objects.create(name=f"{prefix} Lab B")
        self.superadmin = User.objects.create_user(
            username=f"{prefix}_superadmin",
            email=f"{prefix}_superadmin@example.com",
            password=self.password,
            role="superadmin",
            is_superuser=True,
        )
        self.admin_a = User.objects.create_user(
            username=f"{prefix}_admin_a",
            email=f"{prefix}_admin_a@example.com",
            password=self.password,
            role="admin",
            lab=self.lab_a,
        )
        self.user_a = User.objects.create_user(
            username=f"{prefix}_user_a",
            email=f"{prefix}_user_a@example.com",
            password=self.password,
            role="user",
            lab=self.lab_a,
        )
        self.technician_a = User.objects.create_user(
            username=f"{prefix}_technician_a",
            email=f"{prefix}_technician_a@example.com",
            password=self.password,
            role="technician",
            lab=self.lab_a,
        )
        self.admin_b = User.objects.create_user(
            username=f"{prefix}_admin_b",
            email=f"{prefix}_admin_b@example.com",
            password=self.password,
            role="admin",
            lab=self.lab_b,
        )
        self.no_lab_user = User.objects.create_user(
            username=f"{prefix}_no_lab",
            email=f"{prefix}_no_lab@example.com",
            password=self.password,
            role="user",
        )
        self.role_users = {
            "superadmin": self.superadmin,
            "admin": self.admin_a,
            "user": self.user_a,
            "technician": self.technician_a,
            "no_lab": self.no_lab_user,
        }

    def response_ids(self, response):
        if isinstance(response.data, dict):
            payload = response.data.get("results", response.data)
        else:
            payload = response.data or []
        return {item["id"] for item in payload}

    def assert_endpoint_matrix(self, method, url, expectations, **request_kwargs):
        unauthenticated = getattr(self.client, method.lower())(url, **request_kwargs)
        self.assertEqual(
            unauthenticated.status_code,
            expectations.get("anonymous", status.HTTP_401_UNAUTHORIZED),
            f"{method} {url} anonymous",
        )
        for role, expected_status in expectations.items():
            if role == "anonymous":
                continue
            self.client.force_authenticate(user=self.role_users[role])
            response = getattr(self.client, method.lower())(url, **request_kwargs)
            self.assertEqual(
                response.status_code,
                expected_status,
                f"{method} {url} as {role}",
            )
            self.client.force_authenticate(user=None)
