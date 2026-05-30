from rest_framework.test import APITestCase

from apps.core.models import Lab, Notification, User
from apps.jobs.models import Vacation


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
