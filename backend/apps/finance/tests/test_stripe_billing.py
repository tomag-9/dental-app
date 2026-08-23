"""Checkout / portal endpoints and the read-only subscription lock.

The Stripe SDK is replaced by a stub everywhere below — no test touches the
network.
"""

from datetime import timedelta
from unittest.mock import MagicMock, patch

from django.core.management import call_command
from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APIRequestFactory, APITestCase

from apps.core.access import SubscriptionWriteAllowed
from apps.core.models import Lab, User
from apps.crm.models import Patient
from apps.finance import stripe_service
from apps.finance.models import Subscription

STRIPE_ON = dict(
    STRIPE_SECRET_KEY="sk_test",
    STRIPE_PRICE_PRO="price_pro",
    STRIPE_PRICE_ENTERPRISE="price_enterprise",
)


def stripe_stub(
    customer_id="cus_stub", checkout_url="https://checkout.stripe.test/s/1", portal_url="https://portal.stripe.test/p/1"
):
    stub = MagicMock()
    stub.Customer.create.return_value = {"id": customer_id}
    stub.checkout.Session.create.return_value = {"url": checkout_url}
    stub.billing_portal.Session.create.return_value = {"url": portal_url}
    return stub


@override_settings(**STRIPE_ON)
class CheckoutAndPortalTests(APITestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Lab A")
        self.lab_b = Lab.objects.create(name="Lab B")
        self.sub_a = Subscription.objects.create(lab=self.lab_a, plan="free", status="active")
        self.sub_b = Subscription.objects.create(
            lab=self.lab_b, plan="pro", status="active", stripe_customer_id="cus_lab_b"
        )
        self.admin_a = User.objects.create_user(username="admin_a", password="pw", role="admin", lab=self.lab_a)
        self.member_a = User.objects.create_user(username="member_a", password="pw", role="user", lab=self.lab_a)

    def test_checkout_returns_only_a_url(self):
        self.client.force_authenticate(user=self.admin_a)
        stub = stripe_stub()

        with patch.object(stripe_service, "stripe", stub):
            response = self.client.post("/api/v1/finance/subscriptions/checkout/", {"plan": "pro"}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"url": "https://checkout.stripe.test/s/1"})
        # No Stripe identifier may reach the client.
        self.assertNotIn("stripe_customer_id", response.data)

    def test_checkout_price_comes_from_settings_not_from_the_client(self):
        self.client.force_authenticate(user=self.admin_a)
        stub = stripe_stub()

        with patch.object(stripe_service, "stripe", stub):
            self.client.post(
                "/api/v1/finance/subscriptions/checkout/",
                {"plan": "pro", "price": "price_one_cent", "amount": 1},
                format="json",
            )

        kwargs = stub.checkout.Session.create.call_args.kwargs
        self.assertEqual(kwargs["line_items"], [{"price": "price_pro", "quantity": 1}])

    def test_checkout_rejects_unknown_plan(self):
        self.client.force_authenticate(user=self.admin_a)
        stub = stripe_stub()

        with patch.object(stripe_service, "stripe", stub):
            response = self.client.post("/api/v1/finance/subscriptions/checkout/", {"plan": "free"}, format="json")

        self.assertEqual(response.status_code, 400)
        stub.checkout.Session.create.assert_not_called()

    def test_checkout_always_uses_the_callers_own_lab(self):
        """A lab admin cannot open a session against another tenant's customer."""
        self.client.force_authenticate(user=self.admin_a)
        stub = stripe_stub()

        with patch.object(stripe_service, "stripe", stub):
            self.client.post(
                "/api/v1/finance/subscriptions/checkout/",
                {"plan": "pro", "lab": self.lab_b.id, "lab_id": self.lab_b.id},
                format="json",
            )

        kwargs = stub.checkout.Session.create.call_args.kwargs
        self.assertEqual(kwargs["client_reference_id"], str(self.lab_a.id))
        self.assertNotEqual(kwargs["customer"], "cus_lab_b")
        self.sub_b.refresh_from_db()
        self.assertEqual(self.sub_b.stripe_customer_id, "cus_lab_b")

    def test_non_admin_cannot_start_checkout(self):
        self.client.force_authenticate(user=self.member_a)
        stub = stripe_stub()

        with patch.object(stripe_service, "stripe", stub):
            response = self.client.post("/api/v1/finance/subscriptions/checkout/", {"plan": "pro"}, format="json")

        self.assertEqual(response.status_code, 403)
        stub.checkout.Session.create.assert_not_called()

    def test_customer_creation_is_idempotent(self):
        self.client.force_authenticate(user=self.admin_a)
        stub = stripe_stub()

        with patch.object(stripe_service, "stripe", stub):
            self.client.post("/api/v1/finance/subscriptions/checkout/", {"plan": "pro"}, format="json")
            self.client.post("/api/v1/finance/subscriptions/checkout/", {"plan": "pro"}, format="json")

        self.assertEqual(stub.Customer.create.call_count, 1)
        self.sub_a.refresh_from_db()
        self.assertEqual(self.sub_a.stripe_customer_id, "cus_stub")

    def test_portal_returns_url_for_existing_customer(self):
        admin_b = User.objects.create_user(username="admin_b", password="pw", role="admin", lab=self.lab_b)
        self.client.force_authenticate(user=admin_b)
        stub = stripe_stub()

        with patch.object(stripe_service, "stripe", stub):
            response = self.client.post("/api/v1/finance/subscriptions/portal/", {}, format="json")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["url"], "https://portal.stripe.test/p/1")
        self.assertEqual(stub.billing_portal.Session.create.call_args.kwargs["customer"], "cus_lab_b")

    def test_portal_without_payment_account_is_a_clear_400(self):
        self.client.force_authenticate(user=self.admin_a)
        stub = stripe_stub()

        with patch.object(stripe_service, "stripe", stub):
            response = self.client.post("/api/v1/finance/subscriptions/portal/", {}, format="json")

        self.assertEqual(response.status_code, 400)

    def test_my_never_leaks_stripe_identifiers(self):
        self.sub_a.stripe_customer_id = "cus_secret"
        self.sub_a.stripe_subscription_id = "sub_secret"
        self.sub_a.save()
        self.client.force_authenticate(user=self.admin_a)

        response = self.client.get("/api/v1/finance/subscriptions/my/")

        self.assertEqual(response.status_code, 200)
        body = str(response.data)
        self.assertNotIn("cus_secret", body)
        self.assertNotIn("sub_secret", body)
        self.assertIn("billing", response.data)
        self.assertFalse(response.data["billing"]["read_only"])
        self.assertTrue(response.data["billing"]["has_payment_account"])


class StripeDisabledTests(APITestCase):
    """With no secret key the module is inert — CI and dev never need Stripe."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Offline Lab")
        Subscription.objects.create(lab=self.lab, status="active")
        self.admin = User.objects.create_user(username="offline_admin", password="pw", role="admin", lab=self.lab)

    @override_settings(STRIPE_SECRET_KEY="", STRIPE_PRICE_PRO="")
    def test_module_reports_itself_disabled(self):
        self.assertFalse(stripe_service.stripe_enabled())

    @override_settings(STRIPE_SECRET_KEY="", STRIPE_PRICE_PRO="")
    def test_checkout_answers_503_without_reaching_the_network(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post("/api/v1/finance/subscriptions/checkout/", {"plan": "pro"}, format="json")

        self.assertEqual(response.status_code, 503)


class SubscriptionReadOnlyLockTests(APITestCase):
    """Issue #104 — a lapsed lab reads and exports, but does not write."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Locked Lab")
        self.subscription = Subscription.objects.create(lab=self.lab, plan="pro", status="read_only")
        self.admin = User.objects.create_user(username="locked_admin", password="pw", role="admin", lab=self.lab)
        self.superadmin = User.objects.create_user(
            username="locked_super",
            password="pw",
            role="superadmin",
            is_superuser=True,
            lab=self.lab,
        )
        self.patient = Patient.objects.create(lab=self.lab, first_name="Jana", last_name="Nová")

    # -- writes ------------------------------------------------------------

    def test_write_is_refused_with_402_and_a_payment_link(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            "/api/v1/crm/patients/",
            {"first_name": "Nový", "last_name": "Pacient"},
            format="json",
        )

        self.assertEqual(response.status_code, 402)
        self.assertEqual(response.data["code"], "subscription_read_only")
        self.assertEqual(response.data["subscription_status"], "read_only")
        self.assertTrue(response.data["billing_url"])

    def test_update_and_delete_are_refused_too(self):
        self.client.force_authenticate(user=self.admin)

        patch_response = self.client.patch(
            f"/api/v1/crm/patients/{self.patient.id}/", {"phone": "+421900000000"}, format="json"
        )
        delete_response = self.client.delete(f"/api/v1/crm/patients/{self.patient.id}/")

        self.assertEqual(patch_response.status_code, 402)
        self.assertEqual(delete_response.status_code, 402)
        self.assertTrue(Patient.objects.filter(pk=self.patient.pk).exists())

    def test_cancelled_subscription_is_also_read_only(self):
        self.subscription.status = "cancelled"
        self.subscription.save()
        self.client.force_authenticate(user=self.admin)

        response = self.client.post("/api/v1/crm/patients/", {"first_name": "X", "last_name": "Y"}, format="json")

        self.assertEqual(response.status_code, 402)

    # -- reads and exports keep working ------------------------------------

    def test_reads_still_work(self):
        self.client.force_authenticate(user=self.admin)

        listing = self.client.get("/api/v1/crm/patients/")
        detail = self.client.get(f"/api/v1/crm/patients/{self.patient.id}/")

        self.assertEqual(listing.status_code, 200)
        self.assertEqual(detail.status_code, 200)

    def test_export_still_works(self):
        """GDPR art. 20: a lapsed lab must still be able to take its data out."""
        self.client.force_authenticate(user=self.admin)

        response = self.client.get("/api/v1/crm/patients/export/")

        self.assertEqual(response.status_code, 200)
        self.assertIn("Nová", response.content.decode("utf-8-sig"))

    def test_invoice_pdf_still_works(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get("/api/v1/finance/invoices/export/")

        self.assertEqual(response.status_code, 200)

    # -- exemptions --------------------------------------------------------

    def test_billing_endpoints_stay_reachable(self):
        """A locked lab must be able to pay its way out."""
        self.client.force_authenticate(user=self.admin)

        my = self.client.get("/api/v1/finance/subscriptions/my/")
        checkout = self.client.post("/api/v1/finance/subscriptions/checkout/", {"plan": "pro"}, format="json")

        self.assertEqual(my.status_code, 200)
        self.assertTrue(my.data["billing"]["read_only"])
        # 503 (Stripe unconfigured in tests) — the point is that it is not 402.
        self.assertNotEqual(checkout.status_code, 402)

    def test_logout_stays_reachable(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post("/api/v1/core/auth/logout/", {}, format="json")

        self.assertNotEqual(response.status_code, 402)

    def test_account_security_actions_stay_reachable(self):
        """Losing a subscription must not cost a user their security controls."""
        self.client.force_authenticate(user=self.admin)

        password = self.client.post(
            "/api/v1/core/users/me/password/",
            {"current_password": "pw", "new_password": "new-password-123"},
            format="json",
        )

        self.assertNotEqual(password.status_code, 402)

    def test_superadmin_is_never_blocked(self):
        self.client.force_authenticate(user=self.superadmin)

        response = self.client.post(
            "/api/v1/crm/patients/",
            {"first_name": "Super", "last_name": "Admin", "lab": self.lab.id},
            format="json",
        )

        self.assertEqual(response.status_code, 201)

    def test_lab_without_subscription_row_is_not_locked(self):
        other_lab = Lab.objects.create(name="No Billing Lab")
        admin = User.objects.create_user(username="nobilling_admin", password="pw", role="admin", lab=other_lab)
        self.client.force_authenticate(user=admin)

        response = self.client.post("/api/v1/crm/patients/", {"first_name": "A", "last_name": "B"}, format="json")

        self.assertEqual(response.status_code, 201)

    def test_healthy_statuses_do_not_block(self):
        self.client.force_authenticate(user=self.admin)
        for status_value in ("active", "trialing", "past_due", "inactive"):
            with self.subTest(status=status_value):
                Subscription.objects.filter(pk=self.subscription.pk).update(status=status_value)
                response = self.client.post(
                    "/api/v1/crm/patients/",
                    {"first_name": "S", "last_name": status_value},
                    format="json",
                )
                self.assertEqual(response.status_code, 201)

    def test_permission_class_allows_safe_methods_for_any_status(self):
        factory = APIRequestFactory()
        permission = SubscriptionWriteAllowed()
        for method in ("get", "head", "options"):
            with self.subTest(method=method):
                request = getattr(factory, method)("/api/v1/crm/patients/")
                request.user = self.admin
                self.assertTrue(permission.has_permission(request, None))


class SeatLimitTests(APITestCase):
    """``seats`` is a head-count limit, not a billing quantity (#102)."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Seat Lab")
        self.subscription = Subscription.objects.create(lab=self.lab, plan="pro", status="active", seats=2)
        self.admin = User.objects.create_user(username="seat_admin", password="pw", role="admin", lab=self.lab)

    def test_invitation_within_the_limit_is_accepted(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            "/api/v1/core/team-invitations/",
            {"email": "new@example.com", "role": "user"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)

    def test_invitation_over_the_limit_is_refused(self):
        User.objects.create_user(username="seat_member", password="pw", role="user", lab=self.lab)
        self.client.force_authenticate(user=self.admin)

        response = self.client.post(
            "/api/v1/core/team-invitations/",
            {"email": "third@example.com", "role": "user"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("2", str(response.data))

    def test_pending_invitations_count_against_the_limit(self):
        self.client.force_authenticate(user=self.admin)
        first = self.client.post(
            "/api/v1/core/team-invitations/",
            {"email": "one@example.com", "role": "user"},
            format="json",
        )
        second = self.client.post(
            "/api/v1/core/team-invitations/",
            {"email": "two@example.com", "role": "user"},
            format="json",
        )

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 400)

    def test_lab_without_subscription_is_not_seat_limited(self):
        other_lab = Lab.objects.create(name="Unlimited Lab")
        admin = User.objects.create_user(username="unlimited_admin", password="pw", role="admin", lab=other_lab)
        self.client.force_authenticate(user=admin)

        response = self.client.post(
            "/api/v1/core/team-invitations/",
            {"email": "anyone@example.com", "role": "user"},
            format="json",
        )

        self.assertEqual(response.status_code, 201)


class GracePeriodTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Grace Lab")
        self.subscription = Subscription.objects.create(
            lab=self.lab, plan="pro", status="past_due", past_due_since=timezone.now()
        )

    @override_settings(SUBSCRIPTION_GRACE_DAYS=14)
    def test_lab_inside_grace_keeps_writing(self):
        locked = stripe_service.enforce_grace_period()

        self.assertEqual(locked, 0)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "past_due")

    @override_settings(SUBSCRIPTION_GRACE_DAYS=14)
    def test_lab_past_grace_goes_read_only(self):
        self.subscription.past_due_since = timezone.now() - timedelta(days=15)
        self.subscription.save()

        locked = stripe_service.enforce_grace_period()

        self.assertEqual(locked, 1)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "read_only")
        self.assertTrue(self.subscription.is_read_only)

    @override_settings(SUBSCRIPTION_GRACE_DAYS=14)
    def test_command_is_idempotent(self):
        self.subscription.past_due_since = timezone.now() - timedelta(days=20)
        self.subscription.save()

        call_command("enforce_subscription_grace")
        call_command("enforce_subscription_grace")

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "read_only")
