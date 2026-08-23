"""Stripe billing service layer.

All Stripe knowledge lives here; views only translate HTTP to service calls.

Two invariants this module exists to protect:

* **The client never picks a price.** Plans map to ``STRIPE_PRICE_*`` settings
  server-side, so a crafted request cannot buy enterprise for a euro.
* **The client never learns a Stripe id.** Callers receive a redirect URL and
  nothing else; ``stripe_customer_id`` stays server-side.

The module is inert when ``STRIPE_SECRET_KEY`` is empty: :func:`stripe_enabled`
returns ``False``, no network call is ever attempted, and the HTTP layer
answers 503. Dev environments and CI therefore need no Stripe account.
"""

import logging
from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.core.services import write_audit_log

from .models import StripeEvent, Subscription

logger = logging.getLogger(__name__)

try:  # pragma: no cover - import shape depends on the deployed image
    import stripe
except ImportError:  # pragma: no cover
    stripe = None


class StripeNotConfigured(RuntimeError):
    """Raised when a Stripe call is attempted without configuration."""


class StripeServiceError(RuntimeError):
    """Wraps a Stripe-side failure with a message safe to show the user."""


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

#: Plans that are actually billed. ``free`` has no Stripe price by design.
PAID_PLANS = ("pro", "enterprise")


def stripe_enabled():
    """True when the module has both the library and a secret key."""
    return bool(stripe is not None and getattr(settings, "STRIPE_SECRET_KEY", ""))


def webhook_enabled():
    return bool(stripe is not None and getattr(settings, "STRIPE_WEBHOOK_SECRET", ""))


def price_id_for_plan(plan):
    """Server-side plan → price id. Never trust a price from the client."""
    mapping = {
        "pro": getattr(settings, "STRIPE_PRICE_PRO", ""),
        "enterprise": getattr(settings, "STRIPE_PRICE_ENTERPRISE", ""),
    }
    return mapping.get(plan, "")


def plan_for_price_id(price_id):
    """Reverse lookup used when Stripe tells us what the customer bought."""
    if not price_id:
        return None
    for plan in PAID_PLANS:
        if price_id_for_plan(plan) == price_id:
            return plan
    return None


def _client():
    if not stripe_enabled():
        raise StripeNotConfigured("Stripe nie je nakonfigurovaný.")
    stripe.api_key = settings.STRIPE_SECRET_KEY
    return stripe


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def get_or_create_subscription(lab):
    subscription, _ = Subscription.objects.get_or_create(lab=lab)
    return subscription


def _unix_to_date(value):
    if not value:
        return None
    return datetime.fromtimestamp(int(value), tz=dt_timezone.utc).date()


def _as_dict(obj):
    """Normalise a Stripe resource to a plain dict.

    ``StripeObject`` is deliberately *not* a mapping in stripe-python 8+ —
    ``dict(obj)`` raises — so the whole payload is flattened once, up front,
    and every handler below works on ordinary dicts.
    """
    if obj is None:
        return {}
    if isinstance(obj, dict):
        return obj
    for method in ("to_dict_recursive", "to_dict"):
        converter = getattr(obj, method, None)
        if callable(converter):
            return converter()
    return dict(obj)


def _first_item(stripe_subscription):
    items = _as_dict(_as_dict(stripe_subscription).get("items")).get("data") or []
    return _as_dict(items[0]) if items else {}


def _monthly_amount(price):
    """Normalise a Stripe price to a monthly figure in major units."""
    price = _as_dict(price)
    amount = price.get("unit_amount")
    if amount is None:
        return None
    value = Decimal(amount) / Decimal(100)
    recurring = _as_dict(price.get("recurring"))
    interval = recurring.get("interval")
    count = recurring.get("interval_count") or 1
    if interval == "year":
        value = value / (Decimal(12) * Decimal(count))
    elif interval == "week":
        value = value * Decimal("4.345") / Decimal(count)
    elif interval == "day":
        value = value * Decimal("30.4") / Decimal(count)
    elif interval == "month" and count and int(count) != 1:
        value = value / Decimal(count)
    return value.quantize(Decimal("0.01"))


# ---------------------------------------------------------------------------
# Customer / Checkout / Portal
# ---------------------------------------------------------------------------


def ensure_customer(lab):
    """Idempotently create the Stripe Customer for ``lab`` and store its id."""
    subscription = get_or_create_subscription(lab)
    if subscription.stripe_customer_id:
        return subscription.stripe_customer_id

    client = _client()
    try:
        customer = client.Customer.create(
            name=lab.name,
            email=subscription.billing_email or getattr(lab, "email", "") or None,
            metadata={"lab_id": str(lab.id)},
        )
    except Exception as exc:  # pragma: no cover - network failure path
        logger.exception("Stripe customer creation failed for lab %s", lab.id)
        raise StripeServiceError("Nepodarilo sa vytvoriť zákazníka v Stripe.") from exc

    customer_id = _as_dict(customer).get("id") or getattr(customer, "id", "")
    Subscription.objects.filter(pk=subscription.pk).update(stripe_customer_id=customer_id)
    subscription.stripe_customer_id = customer_id
    return customer_id


def create_checkout_session(lab, plan):
    """Return the Stripe Checkout URL for ``plan``.

    ``plan`` is validated against the server-side price map, so an unknown or
    unconfigured plan fails before any network call.
    """
    if plan not in PAID_PLANS:
        raise StripeServiceError("Neplatný plán predplatného.")
    price_id = price_id_for_plan(plan)
    if not price_id:
        raise StripeNotConfigured(f"Cena pre plán „{plan}“ nie je nakonfigurovaná.")

    client = _client()
    customer_id = ensure_customer(lab)
    try:
        session = client.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=settings.STRIPE_CHECKOUT_SUCCESS_URL,
            cancel_url=settings.STRIPE_CHECKOUT_CANCEL_URL,
            client_reference_id=str(lab.id),
            metadata={"lab_id": str(lab.id), "plan": plan},
        )
    except Exception as exc:  # pragma: no cover - network failure path
        logger.exception("Stripe checkout session failed for lab %s", lab.id)
        raise StripeServiceError("Nepodarilo sa vytvoriť platobnú reláciu.") from exc

    url = _as_dict(session).get("url") or getattr(session, "url", "")
    if not url:
        raise StripeServiceError("Stripe nevrátil adresu platobnej relácie.")
    return url


def create_portal_session(lab):
    """Return the Stripe Billing Portal URL (plan change, card, invoices)."""
    client = _client()
    subscription = get_or_create_subscription(lab)
    customer_id = subscription.stripe_customer_id
    if not customer_id:
        raise StripeServiceError("Laboratórium zatiaľ nemá platobný účet. Najskôr dokončite objednávku.")

    try:
        session = client.billing_portal.Session.create(
            customer=customer_id,
            return_url=settings.STRIPE_PORTAL_RETURN_URL,
        )
    except Exception as exc:  # pragma: no cover - network failure path
        logger.exception("Stripe portal session failed for lab %s", lab.id)
        raise StripeServiceError("Nepodarilo sa otvoriť zákaznícky portál.") from exc

    url = _as_dict(session).get("url") or getattr(session, "url", "")
    if not url:
        raise StripeServiceError("Stripe nevrátil adresu zákazníckeho portálu.")
    return url


def sync_from_stripe(subscription):
    """Pull the authoritative state for ``subscription`` straight from Stripe."""
    if not subscription.stripe_subscription_id:
        return subscription
    client = _client()
    try:
        remote = client.Subscription.retrieve(subscription.stripe_subscription_id, expand=["items.data.price"])
    except Exception as exc:  # pragma: no cover - network failure path
        logger.exception("Stripe subscription sync failed for lab %s", subscription.lab_id)
        raise StripeServiceError("Nepodarilo sa načítať stav predplatného zo Stripe.") from exc

    apply_subscription_object(subscription, _as_dict(remote), event_created=None)
    return subscription


# ---------------------------------------------------------------------------
# Status mapping
# ---------------------------------------------------------------------------

#: Stripe subscription.status → our Subscription.status.
_STRIPE_STATUS_MAP = {
    "active": Subscription.STATUS_ACTIVE,
    "trialing": Subscription.STATUS_TRIALING,
    "past_due": Subscription.STATUS_PAST_DUE,
    "unpaid": Subscription.STATUS_PAST_DUE,
    "incomplete": Subscription.STATUS_INACTIVE,
    "incomplete_expired": Subscription.STATUS_INACTIVE,
    "paused": Subscription.STATUS_INACTIVE,
    "canceled": Subscription.STATUS_CANCELLED,
}


def apply_subscription_object(subscription, remote, event_created=None):
    """Write a Stripe subscription payload onto our row.

    ``event_created`` is the webhook event timestamp; when it is older than the
    state already recorded the payload is ignored, because Stripe delivers
    events out of order and a stale ``updated`` must not undo a newer one.
    """
    if event_created is not None and not _event_is_newer(subscription, event_created):
        return False

    remote = _as_dict(remote)
    item = _first_item(remote)
    price = _as_dict(item.get("price"))
    plan = plan_for_price_id(price.get("id"))

    fields = {
        "stripe_subscription_id": remote.get("id") or subscription.stripe_subscription_id,
        "status": _STRIPE_STATUS_MAP.get(remote.get("status"), Subscription.STATUS_INACTIVE),
    }
    if plan:
        fields["plan"] = plan
    if remote.get("current_period_start"):
        fields["current_period_start"] = _unix_to_date(remote["current_period_start"])
    if remote.get("current_period_end"):
        fields["current_period_end"] = _unix_to_date(remote["current_period_end"])
    if remote.get("trial_end"):
        fields["trial_ends_at"] = _unix_to_date(remote["trial_end"])
    quantity = item.get("quantity")
    if quantity:
        # Flat plans bill one unit; ``seats`` stays a head-count limit, so it is
        # only taken from Stripe when the price genuinely carries a quantity.
        fields["seats"] = int(quantity) if int(quantity) > 1 else subscription.seats

    monthly = _monthly_amount(price)
    if monthly is not None:
        # MRR is what the webhook is for — nobody types this in by hand.
        fields["mrr"] = monthly if fields["status"] in ("active", "trialing", "past_due") else Decimal("0.00")

    if fields["status"] == Subscription.STATUS_PAST_DUE:
        fields["past_due_since"] = subscription.past_due_since or timezone.now()
    else:
        fields["past_due_since"] = None

    if fields["status"] == Subscription.STATUS_CANCELLED:
        fields["cancelled_at"] = subscription.cancelled_at or timezone.now()
    elif remote.get("canceled_at"):
        fields["cancelled_at"] = datetime.fromtimestamp(int(remote["canceled_at"]), tz=dt_timezone.utc)
    else:
        fields["cancelled_at"] = None

    if event_created is not None:
        fields["stripe_state_updated_at"] = int(event_created)

    for key, value in fields.items():
        setattr(subscription, key, value)
    subscription.save(update_fields=[*fields.keys(), "updated_at"])
    return True


def _event_is_newer(subscription, event_created):
    known = subscription.stripe_state_updated_at
    return known is None or int(event_created) >= int(known)


# ---------------------------------------------------------------------------
# Webhook processing
# ---------------------------------------------------------------------------


def construct_event(payload, signature_header):
    """Verify the Stripe signature and return the parsed event.

    Nothing downstream runs on an unverified payload — otherwise anyone could
    grant themselves an enterprise plan with a single curl call.
    """
    if stripe is None:
        raise StripeNotConfigured("Stripe knižnica nie je nainštalovaná.")
    secret = getattr(settings, "STRIPE_WEBHOOK_SECRET", "")
    if not secret:
        raise StripeNotConfigured("STRIPE_WEBHOOK_SECRET nie je nastavený.")
    return stripe.Webhook.construct_event(payload, signature_header, secret)


def _subscription_for_customer(customer_id):
    if not customer_id:
        return None
    return Subscription.objects.filter(stripe_customer_id=customer_id).first()


def _subscription_for_event_object(obj):
    """Locate our row from a Stripe payload, by customer, subscription or metadata."""
    obj = _as_dict(obj)
    found = _subscription_for_customer(obj.get("customer"))
    if found:
        return found

    sub_id = obj.get("subscription") or (obj.get("id") if obj.get("object") == "subscription" else None)
    if sub_id:
        found = Subscription.objects.filter(stripe_subscription_id=sub_id).first()
        if found:
            return found

    metadata = _as_dict(obj.get("metadata"))
    lab_id = metadata.get("lab_id") or obj.get("client_reference_id")
    if lab_id:
        try:
            return Subscription.objects.filter(lab_id=int(lab_id)).first()
        except (TypeError, ValueError):
            return None
    return None


def _handle_checkout_completed(subscription, obj, event_created):
    obj = _as_dict(obj)
    sub_id = obj.get("subscription")
    if not sub_id:
        return "checkout bez predplatného"
    if not _event_is_newer(subscription, event_created):
        return "zastaraná udalosť ignorovaná"

    customer_id = obj.get("customer")
    updates = {"stripe_subscription_id": sub_id, "status": Subscription.STATUS_ACTIVE}
    if customer_id:
        updates["stripe_customer_id"] = customer_id
    plan = _as_dict(obj.get("metadata")).get("plan")
    if plan in PAID_PLANS:
        updates["plan"] = plan
    updates["past_due_since"] = None
    updates["cancelled_at"] = None
    updates["stripe_state_updated_at"] = int(event_created)
    for key, value in updates.items():
        setattr(subscription, key, value)
    subscription.save(update_fields=[*updates.keys(), "updated_at"])
    return "predplatné naviazané a aktivované"


def _handle_subscription_upsert(subscription, obj, event_created):
    applied = apply_subscription_object(subscription, obj, event_created=event_created)
    return "stav predplatného aktualizovaný" if applied else "zastaraná udalosť ignorovaná"


def _handle_subscription_deleted(subscription, obj, event_created):
    if not _event_is_newer(subscription, event_created):
        return "zastaraná udalosť ignorovaná"
    subscription.status = Subscription.STATUS_CANCELLED
    subscription.cancelled_at = subscription.cancelled_at or timezone.now()
    subscription.mrr = Decimal("0.00")
    subscription.past_due_since = None
    subscription.stripe_state_updated_at = int(event_created)
    subscription.save(
        update_fields=[
            "status",
            "cancelled_at",
            "mrr",
            "past_due_since",
            "stripe_state_updated_at",
            "updated_at",
        ]
    )
    return "predplatné zrušené"


def _handle_invoice_paid(subscription, obj, event_created):
    if not _event_is_newer(subscription, event_created):
        return "zastaraná udalosť ignorovaná"
    obj = _as_dict(obj)
    subscription.status = Subscription.STATUS_ACTIVE
    subscription.past_due_since = None
    lines = _as_dict(obj.get("lines")).get("data") or []
    period = _as_dict(_as_dict(lines[0]).get("period")) if lines else {}
    if period.get("start"):
        subscription.current_period_start = _unix_to_date(period["start"])
    if period.get("end"):
        subscription.current_period_end = _unix_to_date(period["end"])
    subscription.stripe_state_updated_at = int(event_created)
    subscription.save(
        update_fields=[
            "status",
            "past_due_since",
            "current_period_start",
            "current_period_end",
            "stripe_state_updated_at",
            "updated_at",
        ]
    )
    return "platba prijatá, obdobie predĺžené"


def _handle_invoice_payment_failed(subscription, obj, event_created):
    if not _event_is_newer(subscription, event_created):
        return "zastaraná udalosť ignorovaná"
    subscription.status = Subscription.STATUS_PAST_DUE
    subscription.past_due_since = subscription.past_due_since or timezone.now()
    subscription.stripe_state_updated_at = int(event_created)
    subscription.save(update_fields=["status", "past_due_since", "stripe_state_updated_at", "updated_at"])
    return "platba zlyhala, začína sa odkladná lehota"


_HANDLERS = {
    "checkout.session.completed": _handle_checkout_completed,
    "customer.subscription.created": _handle_subscription_upsert,
    "customer.subscription.updated": _handle_subscription_upsert,
    "customer.subscription.deleted": _handle_subscription_deleted,
    "invoice.paid": _handle_invoice_paid,
    "invoice.payment_succeeded": _handle_invoice_paid,
    "invoice.payment_failed": _handle_invoice_payment_failed,
}


@transaction.atomic
def process_event(event):
    """Apply a *verified* Stripe event exactly once.

    Returns ``(handled, note)``. Never raises for an unknown event type: the
    caller always answers 200, because a 4xx/5xx makes Stripe retry forever.
    """
    event = _as_dict(event)
    event_id = event.get("id") or ""
    event_type = event.get("type") or ""
    event_created = int(event.get("created") or 0)

    if not event_id:
        return False, "udalosť bez identifikátora"

    # Idempotency gate. The unique constraint is the real guard — two
    # concurrent deliveries of the same event race here, and the loser gets an
    # IntegrityError inside this atomic block rather than a double apply.
    ledger, created = StripeEvent.objects.get_or_create(
        event_id=event_id,
        defaults={"event_type": event_type, "created": event_created},
    )
    if not created:
        return False, "duplicitná udalosť ignorovaná"

    handler = _HANDLERS.get(event_type)
    if handler is None:
        ledger.note = "nespracovávaný typ udalosti"
        ledger.save(update_fields=["note"])
        return False, ledger.note

    obj = _as_dict(_as_dict(event.get("data")).get("object"))
    subscription = _subscription_for_event_object(obj)
    if subscription is None:
        ledger.note = "predplatné pre udalosť sa nenašlo"
        ledger.save(update_fields=["note"])
        return False, ledger.note

    note = handler(subscription, obj, event_created)
    ledger.lab_id = subscription.lab_id
    ledger.handled = True
    ledger.note = note
    ledger.save(update_fields=["lab", "handled", "note"])

    write_audit_log(
        actor=None,
        lab=subscription.lab,
        action=f"stripe:{event_type}",
        entity_type="Subscription",
        entity_id=subscription.pk,
        description=note,
        metadata={
            "event_id": event_id,
            "event_type": event_type,
            "status": subscription.status,
            "plan": subscription.plan,
        },
    )
    return True, note


def enforce_grace_period(now=None):
    """Flip ``past_due`` labs past their grace window into read-only.

    Returns the number of subscriptions locked. Idempotent — safe to run daily.
    """
    now = now or timezone.now()
    days = getattr(settings, "SUBSCRIPTION_GRACE_DAYS", 14)
    locked = 0
    candidates = Subscription.objects.filter(
        status=Subscription.STATUS_PAST_DUE,
        past_due_since__isnull=False,
    )
    for subscription in candidates:
        deadline = subscription.past_due_since + timedelta(days=days)
        if deadline <= now:
            subscription.status = Subscription.STATUS_READ_ONLY
            subscription.save(update_fields=["status", "updated_at"])
            write_audit_log(
                actor=None,
                lab=subscription.lab,
                action="subscription:read_only",
                entity_type="Subscription",
                entity_id=subscription.pk,
                description=(f"Odkladná lehota {days} dní uplynula, laboratórium prepnuté do režimu iba na čítanie."),
                metadata={"past_due_since": subscription.past_due_since.isoformat()},
            )
            locked += 1
    return locked
