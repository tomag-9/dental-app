from django.contrib.auth.models import AbstractUser
from django.db import models


class Lab(models.Model):
    name = models.CharField(max_length=255, unique=True, null=False)
    address = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    country = models.CharField(max_length=100, default="Slovakia")
    tax_id = models.CharField(max_length=50, blank=True, null=True)  # IČO
    vat_id = models.CharField(max_length=50, blank=True, null=True)  # IČ DPH
    bank_account = models.CharField(max_length=50, blank=True, null=True)  # IBAN
    bank_bic = models.CharField(max_length=20, blank=True, null=True)  # BIC/SWIFT
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    logo_url = models.CharField(max_length=500, blank=True, null=True)
    contact_info = models.JSONField(blank=True, null=True)
    invoice_prefix = models.CharField(max_length=20, default="INV")
    invoice_due_days = models.PositiveIntegerField(default=14)
    vat_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    payment_method = models.CharField(max_length=50, default="bank_transfer")
    invoice_default_note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class User(AbstractUser):
    ROLE_CHOICES = (
        ("superadmin", "Super Admin"),
        ("admin", "Lab Admin"),
        ("user", "User"),
        ("technician", "Technician"),  # Added technician role if needed for auth
    )

    email = models.EmailField(unique=True, null=True)  # Making email unique
    nickname = models.CharField(max_length=150, unique=True, null=True, blank=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="user")
    lab = models.ForeignKey(
        Lab, on_delete=models.SET_NULL, null=True, blank=True, related_name="users"
    )

    # Required for custom user model
    REQUIRED_FIELDS = ["email"]

    def __str__(self):
        return self.username


class Notification(models.Model):
    TYPE_CHOICES = (
        ("job", "Job"),
        ("invoice", "Invoice"),
        ("deadline", "Deadline"),
        ("stock", "Stock"),
        ("team", "Team"),
        ("system", "System"),
    )

    lab = models.ForeignKey(
        Lab,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="notifications",
    )
    recipient = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="notifications",
    )
    type = models.CharField(max_length=30, choices=TYPE_CHOICES, default="system")
    title = models.CharField(max_length=255)
    message = models.TextField(blank=True, null=True)
    url = models.CharField(max_length=255, blank=True, null=True)
    read_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    @property
    def is_read(self):
        return self.read_at is not None

    def __str__(self):
        return f"{self.recipient_id}: {self.title}"


class AuditLog(models.Model):
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    lab = models.ForeignKey(
        Lab,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="audit_logs",
    )
    action = models.CharField(max_length=100)
    entity_type = models.CharField(max_length=100, blank=True, default="")
    entity_id = models.CharField(max_length=100, blank=True, default="")
    description = models.TextField(blank=True, default="")
    metadata = models.JSONField(blank=True, null=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.action} by {self.actor_id or 'system'}"
