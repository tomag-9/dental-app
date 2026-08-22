"""Stripe webhook tests (issue #103).

Signatures are computed here exactly the way Stripe computes them, so
``stripe.Webhook.construct_event`` does real verification work — no network,
no mocked crypto.
"""

import hashlib
import hmac
import json
import time
from datetime import timedelta
from decimal import Decimal

from django.test import override_settings
from django.utils import timezone
from rest_framework.test import APITestCase

from apps.core.models import AuditLog, Lab
from apps.finance.models import StripeEvent, Subscription

WEBHOOK_SECRET = "whsec_test_secret"
WEBHOOK_URL = "/api/v1/finance/stripe/webhook/"


def sign(payload_bytes, secret=WEBHOOK_SECRET, timestamp=None):
    """Build a valid ``Stripe-Signature`` header for ``payload_bytes``."""
    timestamp = timestamp or int(time.time())
    signed = f"{timestamp}.".encode() + payload_bytes
    digest = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


def subscription_event(
    *,
    event_id,
    event_type="customer.subscription.updated",
    created,
    customer="cus_test",
    subscription_id="sub_test",
    status="active",
    price_id="price_pro",
    unit_amount=4900,
    period_start=None,
    period_end=None,
):
    return {
        "id": event_id,
        "object": "event",
        "type": event_type,
        "created": created,
        "data": {
            "object": {
                "id": subscription_id,
                "object": "subscription",
                "customer": customer,
                "status": status,
                "current_period_start": period_start or created,
                "current_period_end": period_end or (created + 30 * 86400),
                "items": {
                    "data": [
                        {
                            "quantity": 1,
                            "price": {
                                "id": price_id,
                                "unit_amount": unit_amount,
                                "recurring": {"interval": "month", "interval_count": 1},
                            },
                        }
                    ]
                },
            }
        },
    }


@override_settings(
    STRIPE_WEBHOOK_SECRET=WEBHOOK_SECRET,
    STRIPE_SECRET_KEY="sk_test",
    STRIPE_PRICE_PRO="price_pro",
    STRIPE_PRICE_ENTERPRISE="price_enterprise",
)
class StripeWebhookTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Webhook Lab")
        self.subscription = Subscription.objects.create(
            lab=self.lab,
            plan="free",
            status="inactive",
            stripe_customer_id="cus_test",
        )

    def post_event(self, event, secret=WEBHOOK_SECRET, timestamp=None, header=None):
        payload = json.dumps(event).encode()
        if header is None:
            header = sign(payload, secret=secret, timestamp=timestamp)
        return self.client.post(
            WEBHOOK_URL,
            data=payload,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE=header,
        )

    # -- signature ---------------------------------------------------------

    def test_signed_event_is_processed(self):
        now = int(time.time())
        response = self.post_event(subscription_event(event_id="evt_1", created=now))

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["handled"])
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "active")
        self.assertEqual(self.subscription.plan, "pro")
        self.assertEqual(self.subscription.stripe_subscription_id, "sub_test")
        # MRR must come from the webhook, not from a hand-typed value.
        self.assertEqual(self.subscription.mrr, Decimal("49.00"))

    def test_unsigned_event_is_rejected_and_changes_nothing(self):
        now = int(time.time())
        payload = json.dumps(subscription_event(event_id="evt_unsigned", created=now)).encode()

        response = self.client.post(
            WEBHOOK_URL, data=payload, content_type="application/json"
        )

        self.assertEqual(response.status_code, 400)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "inactive")
        self.assertFalse(StripeEvent.objects.exists())

    def test_event_signed_with_wrong_secret_is_rejected(self):
        now = int(time.time())
        response = self.post_event(
            subscription_event(event_id="evt_forged", created=now), secret="whsec_attacker"
        )

        self.assertEqual(response.status_code, 400)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "inactive")

    def test_tampered_payload_is_rejected(self):
        """A signature valid for a *different* body must not authorise this one."""
        now = int(time.time())
        good = json.dumps(subscription_event(event_id="evt_ok", created=now)).encode()
        header = sign(good)
        forged = json.dumps(
            subscription_event(event_id="evt_ok", created=now, price_id="price_enterprise")
        ).encode()

        response = self.client.post(
            WEBHOOK_URL,
            data=forged,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE=header,
        )

        self.assertEqual(response.status_code, 400)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.plan, "free")

    def test_webhook_needs_no_authentication_or_csrf_token(self):
        """No JWT, no cookie, no CSRF token — Stripe has none of them."""
        now = int(time.time())
        client = self.client_class(enforce_csrf_checks=True)
        payload = json.dumps(subscription_event(event_id="evt_csrf", created=now)).encode()

        response = client.post(
            WEBHOOK_URL,
            data=payload,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE=sign(payload),
        )

        self.assertEqual(response.status_code, 200)

    def test_webhook_opts_out_of_the_default_throttle(self):
        """ScopedRateThrottle is the project default; a 429 here loses events."""
        from apps.finance.views import StripeWebhookView

        self.assertEqual(StripeWebhookView.throttle_classes, [])
        self.assertEqual(StripeWebhookView.authentication_classes, [])

    def test_burst_of_deliveries_all_land(self):
        now = int(time.time())
        for index in range(8):
            response = self.post_event(
                subscription_event(event_id=f"evt_burst_{index}", created=now + index)
            )
            self.assertEqual(response.status_code, 200, response.data)

    # -- idempotency -------------------------------------------------------

    def test_duplicate_delivery_is_idempotent(self):
        now = int(time.time())
        event = subscription_event(event_id="evt_dup", created=now)

        first = self.post_event(event)
        second = self.post_event(event)

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertTrue(first.data["handled"])
        self.assertFalse(second.data["handled"])
        self.assertEqual(StripeEvent.objects.filter(event_id="evt_dup").count(), 1)
        # Exactly one audit entry: the redelivery applied nothing.
        self.assertEqual(AuditLog.objects.filter(action="stripe:customer.subscription.updated").count(), 1)

    def test_out_of_order_event_is_ignored(self):
        now = int(time.time())
        self.post_event(
            subscription_event(event_id="evt_new", created=now, status="active", price_id="price_pro")
        )
        # An older "cancelled" delivered late must not undo the newer state.
        response = self.post_event(
            subscription_event(
                event_id="evt_old",
                created=now - 3600,
                status="canceled",
                price_id="price_pro",
            )
        )

        self.assertEqual(response.status_code, 200)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "active")

    def test_unknown_event_type_answers_200(self):
        """4xx/5xx would start a Stripe retry cycle we cannot stop."""
        now = int(time.time())
        event = {
            "id": "evt_unknown",
            "type": "customer.discount.created",
            "created": now,
            "data": {"object": {"customer": "cus_test"}},
        }

        response = self.post_event(event)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["handled"])

    def test_event_for_unknown_customer_answers_200(self):
        now = int(time.time())
        response = self.post_event(
            subscription_event(event_id="evt_ghost", created=now, customer="cus_nobody")
        )

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["handled"])

    # -- lifecycle handlers ------------------------------------------------

    def test_checkout_completed_links_subscription(self):
        now = int(time.time())
        event = {
            "id": "evt_checkout",
            "type": "checkout.session.completed",
            "created": now,
            "data": {
                "object": {
                    "id": "cs_1",
                    "object": "checkout.session",
                    "customer": "cus_test",
                    "subscription": "sub_new",
                    "client_reference_id": str(self.lab.id),
                    "metadata": {"lab_id": str(self.lab.id), "plan": "enterprise"},
                }
            },
        }

        response = self.post_event(event)

        self.assertEqual(response.status_code, 200)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.stripe_subscription_id, "sub_new")
        self.assertEqual(self.subscription.status, "active")
        self.assertEqual(self.subscription.plan, "enterprise")

    def test_payment_failed_sets_past_due_and_starts_grace(self):
        now = int(time.time())
        event = {
            "id": "evt_failed",
            "type": "invoice.payment_failed",
            "created": now,
            "data": {"object": {"id": "in_1", "customer": "cus_test", "subscription": "sub_test"}},
        }

        self.post_event(event)

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "past_due")
        self.assertIsNotNone(self.subscription.past_due_since)
        self.assertIsNotNone(self.subscription.grace_ends_at())
        # Still writable — grace has not expired.
        self.assertFalse(self.subscription.is_read_only)

    def test_invoice_paid_clears_past_due_and_extends_period(self):
        self.subscription.status = "past_due"
        self.subscription.past_due_since = timezone.now() - timedelta(days=3)
        self.subscription.save()
        now = int(time.time())
        event = {
            "id": "evt_paid",
            "type": "invoice.paid",
            "created": now,
            "data": {
                "object": {
                    "id": "in_2",
                    "customer": "cus_test",
                    "subscription": "sub_test",
                    "lines": {"data": [{"period": {"start": now, "end": now + 30 * 86400}}]},
                }
            },
        }

        self.post_event(event)

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "active")
        self.assertIsNone(self.subscription.past_due_since)
        self.assertIsNotNone(self.subscription.current_period_end)

    def test_subscription_deleted_cancels_and_zeroes_mrr(self):
        self.subscription.status = "active"
        self.subscription.mrr = Decimal("49.00")
        self.subscription.stripe_subscription_id = "sub_test"
        self.subscription.save()
        now = int(time.time())
        event = subscription_event(
            event_id="evt_deleted",
            event_type="customer.subscription.deleted",
            created=now,
            status="canceled",
        )

        self.post_event(event)

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "cancelled")
        self.assertIsNotNone(self.subscription.cancelled_at)
        self.assertEqual(self.subscription.mrr, Decimal("0.00"))

    def test_trialing_status_is_supported(self):
        now = int(time.time())
        self.post_event(
            subscription_event(event_id="evt_trial", created=now, status="trialing")
        )

        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, "trialing")
        self.assertFalse(self.subscription.is_read_only)

    def test_every_event_is_audited(self):
        now = int(time.time())
        self.post_event(subscription_event(event_id="evt_audit", created=now))

        entry = AuditLog.objects.filter(action="stripe:customer.subscription.updated").first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.lab_id, self.lab.id)
        self.assertEqual(entry.metadata["event_id"], "evt_audit")


class StripeWebhookDisabledTests(APITestCase):
    """With no webhook secret nothing can be verified, so nothing is trusted."""

    @override_settings(STRIPE_WEBHOOK_SECRET="")
    def test_webhook_is_unavailable_without_secret(self):
        lab = Lab.objects.create(name="Unconfigured Lab")
        Subscription.objects.create(lab=lab, stripe_customer_id="cus_test")
        now = int(time.time())
        payload = json.dumps(subscription_event(event_id="evt_off", created=now)).encode()

        response = self.client.post(
            WEBHOOK_URL,
            data=payload,
            content_type="application/json",
            HTTP_STRIPE_SIGNATURE=sign(payload),
        )

        self.assertEqual(response.status_code, 503)
        self.assertFalse(StripeEvent.objects.exists())
