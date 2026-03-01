from django.db import models

from apps.core.models import Lab
from apps.crm.models import Clinic, Doctor, Patient


class Technician(models.Model):
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="technicians")
    first_name = models.CharField(max_length=100, null=False)
    last_name = models.CharField(max_length=100, null=False)
    title_before = models.CharField(max_length=50, blank=True, null=True)
    title_after = models.CharField(max_length=50, blank=True, null=True)
    contact_info = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"


class Job(models.Model):
    STATUS_CHOICES = (
        ("new", "New"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("cancelled", "Cancelled"),
    )

    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="jobs")
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="jobs")
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="jobs")
    doctor = models.ForeignKey(Doctor, on_delete=models.CASCADE, related_name="jobs")
    technician = models.ForeignKey(
        Technician,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jobs",
    )

    price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default="new")

    procedure_codes = models.JSONField(blank=True, null=True)  # List of codes
    procedure_quantities = models.JSONField(blank=True, null=True)  # Dict {code: qty}
    input_tooth_procedures = models.JSONField(
        blank=True, null=True
    )  # Job-specific tooth map data (input)
    output_tooth_procedures = models.JSONField(
        blank=True, null=True
    )  # Resulting work (output)

    description = models.TextField(blank=True, null=True)
    tooth_color = models.CharField(max_length=10, blank=True, null=True)  # A1-D4

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    try_in_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Job {self.id} - {self.patient}"


class Vacation(models.Model):
    lab = models.ForeignKey(
        Lab, on_delete=models.SET_NULL, null=True, blank=True, related_name="vacations"
    )
    start = models.DateTimeField(null=False)
    end = models.DateTimeField(null=False)
    description = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Vacation {self.id}: {self.start} - {self.end}"
