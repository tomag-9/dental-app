from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.finance.models import Subscription


class SubscriptionApiTests(APITestCase):
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
        self.user_b = User.objects.create_user(
            username="user_b",
            email="user_b@example.com",
            password="password123",
            role="user",
            lab=self.lab_b,
        )
        self.no_lab_user = User.objects.create_user(
            username="nolab",
            email="nolab@example.com",
            password="password123",
            role="user",
        )

        self.sub_a = Subscription.objects.create(
            lab=self.lab_a,
            plan="free",
            status="active",
            seats=5,
        )
        self.sub_b = Subscription.objects.create(
            lab=self.lab_b,
            plan="pro",
            status="active",
            seats=10,
        )

    def test_my_returns_current_users_lab_subscription(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/finance/subscriptions/my/")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["id"], self.sub_a.id)
        self.assertEqual(response.data["lab"], self.lab_a.id)

    def test_my_returns_404_when_user_has_no_lab(self):
        self.client.force_authenticate(user=self.no_lab_user)
        response = self.client.get("/api/finance/subscriptions/my/")

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        self.assertEqual(response.data["detail"], "No lab associated with user")

    def test_non_superadmin_cannot_list_subscriptions(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get("/api/finance/subscriptions/")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_can_list_and_retrieve_subscriptions(self):
        self.client.force_authenticate(user=self.superadmin)

        list_response = self.client.get("/api/finance/subscriptions/")
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(list_response.data), 2)

        retrieve_response = self.client.get(f"/api/finance/subscriptions/{self.sub_b.id}/")
        self.assertEqual(retrieve_response.status_code, status.HTTP_200_OK)
        self.assertEqual(retrieve_response.data["id"], self.sub_b.id)

    def test_non_superadmin_cannot_update_subscription(self):
        self.client.force_authenticate(user=self.user_b)
        response = self.client.patch(
            f"/api/finance/subscriptions/{self.sub_b.id}/",
            {"plan": "enterprise"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class SubscriptionExtendedFieldsTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Sub Extended Lab")
        self.superadmin = User.objects.create_user(
            username="sub_sa",
            password="pw",
            email="sub_sa@test.sk",
            role="superadmin",
            is_superuser=True,
        )
        self.sub = Subscription.objects.create(
            lab=self.lab,
            plan="pro",
            status="active",
            mrr="99.00",
            billing_email="billing@lab.sk",
        )

    def test_subscription_serializer_includes_new_fields(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get(f"/api/finance/subscriptions/{self.sub.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("mrr", resp.data)
        self.assertIn("billing_email", resp.data)
        self.assertIn("trial_ends_at", resp.data)
        self.assertIn("cancelled_at", resp.data)
        self.assertEqual(resp.data["billing_email"], "billing@lab.sk")

    def test_subscription_mrr_can_be_set(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.patch(
            f"/api/finance/subscriptions/{self.sub.id}/",
            {"mrr": "149.00"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        self.sub.refresh_from_db()
        self.assertEqual(str(self.sub.mrr), "149.00")
