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
