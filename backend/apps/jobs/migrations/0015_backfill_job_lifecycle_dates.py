from django.db import migrations
from django.db.models import F


def copy_legacy_dates(apps, schema_editor):
    """Copy the deprecated start_date/end_date into assigned_at/completed_at."""
    Job = apps.get_model("jobs", "Job")
    Job.objects.filter(start_date__isnull=False, assigned_at__isnull=True).update(assigned_at=F("start_date"))
    Job.objects.filter(end_date__isnull=False, completed_at__isnull=True).update(completed_at=F("end_date"))


def clear_new_dates(apps, schema_editor):
    Job = apps.get_model("jobs", "Job")
    Job.objects.filter(assigned_at=F("start_date")).update(assigned_at=None)
    Job.objects.filter(completed_at=F("end_date")).update(completed_at=None)


class Migration(migrations.Migration):
    dependencies = [
        ("jobs", "0014_job_assigned_at_job_completed_at_job_diagnosis_code_and_more"),
    ]

    operations = [
        migrations.RunPython(copy_legacy_dates, clear_new_dates),
    ]
