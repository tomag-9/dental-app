from django.db import models

from apps.core.models import Lab
from apps.crm.models import Clinic
from apps.jobs.models import Job

PROCEDURE_CATEGORY_CHOICES = (
    ("crown", "Crown"),
    ("bridge", "Bridge"),
    ("denture", "Denture"),
    ("implant", "Implant"),
    ("orthodontic", "Orthodontic"),
    ("repair", "Repair"),
    ("other", "Other"),
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
        ("draft", "Draft"),
        ("issued", "Issued"),
        ("paid", "Paid"),
        ("cancelled", "Cancelled"),
    )

    DOCUMENT_TYPE_CHOICES = (
        ("invoice", "Invoice"),
        ("proforma", "Proforma"),
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
    STATUS_CHOICES = (
        ("active", "Active"),
        ("past_due", "Past Due"),
        ("cancelled", "Cancelled"),
        ("inactive", "Inactive"),
    )
    PLAN_CHOICES = (
        ("free", "Free"),
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
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
