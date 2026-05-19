from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.finance.models import Subscription


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
