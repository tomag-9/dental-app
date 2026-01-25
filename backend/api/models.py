from django.db import models
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.utils import timezone


class Lab(models.Model):
    name = models.CharField(max_length=255, unique=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    country = models.CharField(max_length=100, default="Slovakia")
    tax_id = models.CharField(max_length=50, blank=True, null=True)
    vat_id = models.CharField(max_length=50, blank=True, null=True)
    bank_account = models.CharField(max_length=100, blank=True, null=True)
    bank_bic = models.CharField(max_length=20, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    website = models.URLField(blank=True, null=True)
    logo_url = models.CharField(max_length=255, blank=True, null=True)
    contact_info = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError("Email required")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.update({"is_staff": True, "is_superuser": True, "role": "superadmin"})
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    email = models.EmailField(unique=True)
    nickname = models.CharField(max_length=100, blank=True, null=True)
    role = models.CharField(max_length=20, default="user")
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    lab = models.ForeignKey(Lab, on_delete=models.SET_NULL, null=True, blank=True)

    objects = UserManager()
    USERNAME_FIELD = "email"


class Patient(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    birth_number = models.CharField(max_length=20, unique=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    tooth_procedures = models.JSONField(default=dict, blank=True, null=True)
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="patients")
    created_at = models.DateTimeField(default=timezone.now)

    def get_cumulative_tooth_map(self):
        jobs = self.jobs.filter(status="closed").order_by("created_at")
        res = {}
        for j in jobs:
            if j.tooth_procedures:
                res.update(j.tooth_procedures)
        return res


class Clinic(models.Model):
    name = models.CharField(max_length=255)
    ico = models.CharField(max_length=50, unique=True, blank=True, null=True)
    dic = models.CharField(max_length=50, blank=True, null=True)
    address = models.CharField(max_length=255, blank=True, null=True)
    bank_details = models.TextField(blank=True, null=True)
    contact_info = models.JSONField(default=dict, blank=True)
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="clinics")
    created_at = models.DateTimeField(default=timezone.now)


class Doctor(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    clinic = models.ForeignKey(Clinic, on_delete=models.SET_NULL, null=True, blank=True)
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE)
    created_at = models.DateTimeField(default=timezone.now)


class WarehouseItem(models.Model):
    name = models.CharField(max_length=255)
    sku = models.CharField(max_length=100, blank=True, null=True)
    quantity = models.FloatField(default=0)
    unit = models.CharField(max_length=20, default="pcs")
    min_threshold = models.FloatField(blank=True, null=True)
    cost_price = models.FloatField(blank=True, null=True)
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE)
    created_at = models.DateTimeField(default=timezone.now)


class Technician(models.Model):
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    lab = models.ForeignKey(Lab, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)


class PriceList(models.Model):
    code = models.CharField(max_length=50, unique=True)
    description = models.TextField()
    price = models.FloatField()
    lab = models.ForeignKey(Lab, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)


class Job(models.Model):
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="jobs")
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE)
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE)
    technician = models.ForeignKey(Technician, on_delete=models.CASCADE)
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="jobs")
    price = models.FloatField(blank=True, null=True)
    due_date = models.DateField(blank=True, null=True)
    status = models.CharField(max_length=50, default="in_progress")
    procedure_codes = models.JSONField(default=list, blank=True)
    procedure_quantities = models.JSONField(default=dict, blank=True)
    tooth_procedures = models.JSONField(default=dict, blank=True)
    description = models.TextField(blank=True, null=True)
    tooth_color = models.CharField(max_length=10, blank=True, null=True)
    start_date = models.DateField(blank=True, null=True)
    end_date = models.DateField(blank=True, null=True)
    try_in = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)


class Invoice(models.Model):
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="invoices")
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="invoices")
    number = models.CharField(max_length=100, unique=True)
    status = models.CharField(max_length=20, default="draft")
    total_amount = models.FloatField(default=0.0)
    created_at = models.DateTimeField(default=timezone.now)
    paid_at = models.DateTimeField(blank=True, null=True)


class InvoiceItem(models.Model):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="items")
    description = models.CharField(max_length=255)
    quantity = models.IntegerField(default=1)
    unit_price = models.FloatField(default=0.0)
    line_total = models.FloatField(default=0.0)


class Vacation(models.Model):
    start = models.DateTimeField()
    end = models.DateTimeField()
    description = models.TextField(blank=True, null=True)
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE)
    created_at = models.DateTimeField(default=timezone.now)


class Subscription(models.Model):
    lab = models.OneToOneField(Lab, on_delete=models.CASCADE)
    plan = models.CharField(max_length=20, default="free")
    status = models.CharField(max_length=20, default="inactive")
    seats = models.IntegerField(default=5)
    current_period_end = models.DateField(blank=True, null=True)
    created_at = models.DateTimeField(default=timezone.now)
