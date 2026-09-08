from datetime import timedelta

from django.db import models

from apps.core.models import Lab
from apps.crm.models import Clinic
from apps.jobs.models import Job

PROCEDURE_CATEGORY_CHOICES = (
    ("crown", "Korunka"),
    ("bridge", "Mostík"),
    ("denture", "Protéza"),
    ("implant", "Implantát"),
    ("orthodontic", "Ortodoncia"),
    ("repair", "Oprava"),
    ("other", "Iné"),
)


class PriceList(models.Model):
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="price_list_items")
    code = models.CharField(max_length=50, null=False)
    description = models.CharField(max_length=255, null=False)
    price = models.DecimalField(max_digits=10, decimal_places=2, null=False)
    category = models.CharField(
        max_length=30,
        choices=PROCEDURE_CATEGORY_CHOICES,
        blank=True,
        null=True,
    )
    valid_from = models.DateField(null=True, blank=True)
    valid_to = models.DateField(null=True, blank=True)
    # Prosthetic label defaults (#96): payer IPZP code and the default split of the
    # unit price between the health insurer and the patient co-payment.
    ipzp_code = models.CharField(max_length=20, blank=True, default="")
    default_insurance_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    default_patient_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.code} - {self.price}"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["lab", "code"],
                name="unique_pricelist_code_per_lab",
            )
        ]


class Invoice(models.Model):
    STATUS_CHOICES = (
        ("draft", "Koncept"),
        ("issued", "Vystavená"),
        ("paid", "Zaplatená"),
        ("cancelled", "Zrušená"),
    )

    DOCUMENT_TYPE_CHOICES = (
        ("invoice", "Faktúra"),
        ("proforma", "Proforma faktúra"),
    )

    DESCRIPTION_MODE_CHOICES = (
        ("structured", "Štruktúrovaný popis"),
        ("custom", "Voľný popis"),
    )

    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="invoices")
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="invoices")
    number = models.CharField(max_length=50, unique=True, null=False)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="draft")
    document_type = models.CharField(
        max_length=20,
        choices=DOCUMENT_TYPE_CHOICES,
        default="invoice",
    )
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    discount_percent = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.0)
    description_mode = models.CharField(
        max_length=20,
        choices=DESCRIPTION_MODE_CHOICES,
        default="structured",
    )
    custom_description = models.TextField(blank=True, default="")
    show_patient_list = models.BooleanField(default=True)
    breakdown_snapshot = models.JSONField(blank=True, default=list)

    created_at = models.DateTimeField(auto_now_add=True)
    issued_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return self.number

    class Meta:
        indexes = [
            models.Index(
                fields=["lab", "status", "due_date"],
                name="finance_inv_lab_sta_00fb4f_idx",
            ),
            models.Index(
                fields=["lab", "status", "paid_at"],
                name="finance_inv_lab_sta_b60bb7_idx",
            ),
        ]


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    job = models.ForeignKey(
        Job,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoice_items",
    )
    description = models.CharField(max_length=255, null=False)
    quantity = models.IntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)
    line_total = models.DecimalField(max_digits=10, decimal_places=2, default=0.0)

    def save(self, *args, **kwargs):
        self.line_total = self.quantity * self.unit_price
        super().save(*args, **kwargs)


class InvoiceSequence(models.Model):
    lab = models.OneToOneField(Lab, on_delete=models.CASCADE, related_name="invoice_sequence")
    last_number = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.lab_id}: {self.last_number}"


class Subscription(models.Model):
    #: Statuses in which the lab may still write. Everything outside this set is
    #: read-only (see ``apps.core.access.SubscriptionWriteAllowed``).
    STATUS_ACTIVE = "active"
    STATUS_TRIALING = "trialing"
    STATUS_PAST_DUE = "past_due"
    STATUS_CANCELLED = "cancelled"
    STATUS_INACTIVE = "inactive"
    STATUS_READ_ONLY = "read_only"

    STATUS_CHOICES = (
        (STATUS_ACTIVE, "Aktívne"),
        # ``trial_ends_at`` existed long before this status did; a subscription
        # inside its Stripe trial now carries a status that says so.
        (STATUS_TRIALING, "Skúšobná doba"),
        (STATUS_PAST_DUE, "Po splatnosti"),
        (STATUS_CANCELLED, "Zrušené"),
        (STATUS_INACTIVE, "Neaktívne"),
        # Terminal state of the grace period: data stays readable and
        # exportable, writes are refused with 402.
        (STATUS_READ_ONLY, "Iba na čítanie"),
    )
    PLAN_CHOICES = (
        ("free", "Bezplatný"),
        ("pro", "Pro"),
        ("enterprise", "Enterprise"),
    )

    lab = models.OneToOneField(Lab, on_delete=models.CASCADE, related_name="subscription")
    plan = models.CharField(max_length=20, choices=PLAN_CHOICES, default="free")
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="inactive")
    seats = models.IntegerField(default=5)
    mrr = models.DecimalField(max_digits=10, decimal_places=2, default=0, null=True, blank=True)
    billing_email = models.EmailField(blank=True, null=True)
    trial_ends_at = models.DateField(null=True, blank=True)
    cancelled_at = models.DateTimeField(null=True, blank=True)
    current_period_start = models.DateField(null=True, blank=True)
    current_period_end = models.DateField(null=True, blank=True)
    # Stripe linkage. Never serialised to API clients — the browser only ever
    # receives a redirect URL minted server-side.
    stripe_customer_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    stripe_subscription_id = models.CharField(max_length=64, blank=True, default="", db_index=True)
    #: When the subscription first went ``past_due``; drives the grace window.
    past_due_since = models.DateTimeField(null=True, blank=True)
    #: ``created`` of the newest Stripe event already applied to this row, so a
    #: late out-of-order delivery cannot roll the state backwards.
    stripe_state_updated_at = models.BigIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.lab_id}: {self.plan}/{self.status}"

    @property
    def is_read_only(self):
        """True when the lab has lost write access (payment lapsed)."""
        from apps.core.access import READ_ONLY_SUBSCRIPTION_STATUSES

        return self.status in READ_ONLY_SUBSCRIPTION_STATUSES

    def grace_ends_at(self):
        """End of the grace window for a ``past_due`` subscription, else None."""
        from django.conf import settings

        if self.status != self.STATUS_PAST_DUE or not self.past_due_since:
            return None
        days = getattr(settings, "SUBSCRIPTION_GRACE_DAYS", 14)
        return self.past_due_since + timedelta(days=days)


class StripeEvent(models.Model):
    """Ledger of Stripe webhook deliveries, used purely for idempotency.

    Stripe redelivers events (at-least-once) and does not guarantee ordering.
    The unique ``event_id`` turns a redelivery into a cheap 200, while
    ``created`` lets a handler drop a delivery that is older than the state
    already stored on the subscription.
    """

    event_id = models.CharField(max_length=255, unique=True)
    event_type = models.CharField(max_length=100)
    #: Stripe's own ``created`` timestamp (unix seconds).
    created = models.BigIntegerField(default=0)
    lab = models.ForeignKey(
        Lab,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="stripe_events",
    )
    handled = models.BooleanField(default=False)
    note = models.TextField(blank=True, default="")
    received_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-received_at", "-id"]

    def __str__(self):
        return f"{self.event_type} {self.event_id}"
