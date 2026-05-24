from django.contrib.auth.models import AbstractUser
from django.db import models
from django.utils.text import slugify


class Lab(models.Model):
    name = models.CharField(max_length=255, unique=True, null=False)
    slug = models.SlugField(max_length=255, unique=True, blank=True)
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
    enable_qr_payment = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name)
            slug = base
            n = 1
            while Lab.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f"{base}-{n}"
                n += 1
            self.slug = slug
        super().save(*args, **kwargs)

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
    notification_preferences = models.JSONField(default=dict, blank=True)
    avatar_url = models.URLField(max_length=500, blank=True, null=True)
    totp_secret = models.CharField(max_length=64, blank=True, null=True)
    totp_enabled = models.BooleanField(default=False)

    # Required for custom user model
    REQUIRED_FIELDS = ["email"]

    def __str__(self):
        return self.username


class TeamInvitation(models.Model):
    STATUS_CHOICES = (
        ("pending", "Pending"),
        ("accepted", "Accepted"),
        ("cancelled", "Cancelled"),
        ("expired", "Expired"),
    )

    lab = models.ForeignKey(
        Lab, on_delete=models.CASCADE, related_name="team_invitations"
    )
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=User.ROLE_CHOICES, default="user")
    token = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="pending")
    invited_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="sent_team_invitations",
    )
    accepted_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="accepted_team_invitations",
    )
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    @property
    def is_expired(self):
        from django.utils import timezone

        return self.status == "pending" and self.expires_at <= timezone.now()

    def __str__(self):
        return f"{self.email} -> {self.lab_id}"


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


class LabApiKey(models.Model):
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="api_keys")
    name = models.CharField(max_length=100)
    prefix = models.CharField(max_length=12)
    hashed_key = models.CharField(max_length=128)
    is_active = models.BooleanField(default=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        "User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_api_keys",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.lab_id}:{self.name}:{self.prefix}"


class UserSession(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="sessions")
    jti = models.CharField(max_length=255, unique=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    device_info = models.CharField(max_length=500, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    revoked = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at"]

    @property
    def is_active(self):
        from django.utils import timezone

        return not self.revoked and self.expires_at > timezone.now()

    def __str__(self):
        return f"session:{self.user_id}:{self.jti[:8]}"


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


class LabRolePermission(models.Model):
    """Per-lab override of allowed actions for a given role."""

    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("user", "User"),
        ("technician", "Technician"),
    )

    lab = models.ForeignKey(
        Lab,
        on_delete=models.CASCADE,
        related_name="role_permissions",
    )
    role = models.CharField(max_length=30, choices=ROLE_CHOICES)
    action = models.CharField(max_length=100)
    allowed = models.BooleanField(default=True)

    class Meta:
        unique_together = ("lab", "role", "action")
        ordering = ["role", "action"]

    def __str__(self):
        state = "allow" if self.allowed else "deny"
        return f"{self.lab_id}:{self.role}:{self.action}={state}"
