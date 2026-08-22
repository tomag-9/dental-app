from django.db import models
from django.db.models import Q

from apps.core.models import Lab


class Insurer(models.Model):
    """Celoštátny číselník zdravotných poisťovní — zámerne nie je tenant-scoped."""

    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=50, blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["code"]

    def __str__(self):
        return f"{self.code} — {self.name}"


class Clinic(models.Model):
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="clinics")
    name = models.CharField(max_length=255, null=False)
    ico = models.CharField(max_length=50, blank=True, null=True)
    dic = models.CharField(max_length=50, blank=True, null=True)
    pzs_code = models.CharField(max_length=50, blank=True, default="")  # kód poskytovateľa zdravotnej starostlivosti
    address = models.CharField(max_length=255, blank=True, null=True)
    bank_details = models.CharField(max_length=255, blank=True, null=True)
    contact_info = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["lab", "ico"],
                condition=Q(ico__isnull=False) & ~Q(ico=""),
                name="unique_clinic_ico_per_lab",
            )
        ]


class Doctor(models.Model):
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="doctors")
    clinic = models.ForeignKey(Clinic, on_delete=models.SET_NULL, null=True, blank=True, related_name="doctors")
    first_name = models.CharField(max_length=100, null=False)
    last_name = models.CharField(max_length=100, null=False)
    title_before = models.CharField(max_length=50, blank=True, null=True)
    title_after = models.CharField(max_length=50, blank=True, null=True)
    doctor_code = models.CharField(max_length=50, blank=True, default="")  # napr. B06160016
    registration_number = models.CharField(max_length=50, blank=True, default="")  # reg. č. v SKZL
    contact_info = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Patient(models.Model):
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="patients")
    first_name = models.CharField(max_length=100, null=False)
    last_name = models.CharField(max_length=100, null=False)
    birth_number = models.CharField(max_length=50, null=False)
    insurer = models.ForeignKey(
        "crm.Insurer",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="patients",
    )
    address = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(max_length=50, blank=True, null=True)
    email = models.EmailField(blank=True, null=True)
    tooth_procedures = models.JSONField(blank=True, null=True)  # Cumulative tooth map
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.birth_number})"

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["lab", "birth_number"],
                name="unique_patient_birth_number_per_lab",
            )
        ]
