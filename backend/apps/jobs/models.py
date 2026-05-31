from django.conf import settings
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
        ("finished_factured", "Finished – Factured"),
        ("finished_unfactured", "Finished – Unfactured"),
        ("closed", "Closed"),
    )
    PRIORITY_CHOICES = (
        ("low", "Low"),
        ("normal", "Normal"),
        ("high", "High"),
        ("urgent", "Urgent"),
    )

    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="jobs")
    patient = models.ForeignKey(Patient, on_delete=models.CASCADE, related_name="jobs")
    clinic = models.ForeignKey(Clinic, on_delete=models.CASCADE, related_name="jobs")
    doctor = models.ForeignKey(
        Doctor,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="jobs",
    )
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
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default="normal")

    procedure_codes = models.JSONField(blank=True, null=True)  # List of codes
    procedure_quantities = models.JSONField(blank=True, null=True)  # Dict {code: qty}
    input_tooth_procedures = models.JSONField(blank=True, null=True)  # Job-specific tooth map data (input)
    output_tooth_procedures = models.JSONField(blank=True, null=True)  # Resulting work (output)

    description = models.TextField(blank=True, null=True)
    tooth_color = models.CharField(max_length=10, blank=True, null=True)  # A1-D4

    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    try_in_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Job {self.id} - {self.patient}"

    class Meta:
        indexes = [
            models.Index(
                fields=["lab", "status", "due_date"],
                name="jobs_job_lab_id_7cdf67_idx",
            ),
        ]


class JobItem(models.Model):
    PROCEDURE_CATEGORY_CHOICES = (
        ("crown", "Crown"),
        ("bridge", "Bridge"),
        ("denture", "Denture"),
        ("implant", "Implant"),
        ("orthodontic", "Orthodontic"),
        ("repair", "Repair"),
        ("other", "Other"),
    )
    TOOTH_STATE_CHOICES = (
        ("planned", "Planned"),
        ("missing", "Missing"),
        ("implant", "Implant"),
        ("temporary", "Temporary"),
    )
    TOOTH_SCOPE_CHOICES = (
        ("A", "All teeth"),
        ("U", "Upper jaw"),
        ("L", "Lower jaw"),
        ("Q1", "Quadrant 1"),
        ("Q2", "Quadrant 2"),
        ("Q3", "Quadrant 3"),
        ("Q4", "Quadrant 4"),
    )

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="items")
    price_list_code = models.CharField(max_length=50)
    description = models.CharField(max_length=255)
    tooth = models.CharField(max_length=20, blank=True, null=True)
    quantity = models.PositiveIntegerField(default=1)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total = models.DecimalField(max_digits=10, decimal_places=2)
    procedure_category = models.CharField(
        max_length=30,
        choices=PROCEDURE_CATEGORY_CHOICES,
        blank=True,
        null=True,
    )
    material = models.CharField(max_length=100, blank=True, null=True)
    color = models.CharField(max_length=30, blank=True, null=True)
    bridge_span = models.CharField(max_length=50, blank=True, null=True)
    tooth_scope = models.CharField(
        max_length=2,
        choices=TOOTH_SCOPE_CHOICES,
        blank=True,
        null=True,
    )
    tooth_state = models.CharField(
        max_length=30,
        choices=TOOTH_STATE_CHOICES,
        default="planned",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        self.total = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.job_id} - {self.price_list_code}"


class JobTimelineEvent(models.Model):
    EVENT_CHOICES = (
        ("created", "Created"),
        ("updated", "Updated"),
        ("status_changed", "Status changed"),
        ("assigned", "Assigned"),
        ("deleted", "Deleted"),
    )

    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="timeline")
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="job_timeline_events",
    )
    event = models.CharField(max_length=40, choices=EVENT_CHOICES)
    note = models.TextField(blank=True, null=True)
    from_status = models.CharField(max_length=20, blank=True, null=True)
    to_status = models.CharField(max_length=20, blank=True, null=True)
    changed_fields = models.JSONField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at", "-id"]

    def __str__(self):
        return f"{self.job_id} - {self.event}"


class Vacation(models.Model):
    lab = models.ForeignKey(Lab, on_delete=models.SET_NULL, null=True, blank=True, related_name="vacations")
    start = models.DateTimeField(null=False)
    end = models.DateTimeField(null=False)
    description = models.CharField(max_length=255, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Vacation {self.id}: {self.start} - {self.end}"


class JobAttachment(models.Model):
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name="attachments")
    file_name = models.CharField(max_length=255)
    file_url = models.URLField(max_length=500)
    file_type = models.CharField(max_length=100, blank=True, null=True)
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="job_attachments",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.job_id} - {self.file_name}"


class CalendarEvent(models.Model):
    EVENT_TYPE_CHOICES = (
        ("meeting", "Meeting"),
        ("pickup", "Pickup"),
        ("delivery", "Delivery"),
        ("deadline", "Deadline"),
        ("other", "Other"),
    )

    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="calendar_events")
    title = models.CharField(max_length=255)
    event_type = models.CharField(max_length=30, choices=EVENT_TYPE_CHOICES, default="other")
    start = models.DateTimeField(null=False)
    end = models.DateTimeField(null=True, blank=True)
    description = models.TextField(blank=True, null=True)
    location = models.CharField(max_length=255, blank=True, null=True)
    contact_person = models.CharField(max_length=100, blank=True, null=True)
    contact_phone = models.CharField(max_length=30, blank=True, null=True)
    related_job = models.ForeignKey(
        Job,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="calendar_events",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["start", "id"]
        indexes = [
            models.Index(
                fields=["lab", "start", "end"],
                name="jobs_calend_lab_id_39c7ad_idx",
            ),
        ]

    def __str__(self):
        return f"{self.event_type}: {self.title}"
