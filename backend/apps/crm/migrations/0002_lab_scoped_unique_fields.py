from django.db import migrations, models
from django.db.models import Count, Q


def check_duplicate_lab_values(apps, schema_editor):
    checks = [
        ("Clinic", "ico", "clinic IČO"),
        ("Patient", "birth_number", "patient birth number"),
    ]
    for model_name, field_name, label in checks:
        model = apps.get_model("crm", model_name)
        duplicates = (
            model.objects.exclude(**{f"{field_name}__isnull": True})
            .exclude(**{field_name: ""})
            .values("lab_id", field_name)
            .annotate(count=Count("id"))
            .filter(count__gt=1)
        )
        if duplicates.exists():
            sample = duplicates.first()
            raise RuntimeError(
                f"Cannot add per-lab {label} constraint; duplicate value "
                f"{sample[field_name]!r} exists for lab_id={sample['lab_id']}."
            )


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="clinic",
            name="ico",
            field=models.CharField(blank=True, max_length=50, null=True),
        ),
        migrations.AlterField(
            model_name="patient",
            name="birth_number",
            field=models.CharField(max_length=50),
        ),
        migrations.RunPython(check_duplicate_lab_values, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="clinic",
            constraint=models.UniqueConstraint(
                fields=("lab", "ico"),
                condition=Q(ico__isnull=False) & ~Q(ico=""),
                name="unique_clinic_ico_per_lab",
            ),
        ),
        migrations.AddConstraint(
            model_name="patient",
            constraint=models.UniqueConstraint(
                fields=("lab", "birth_number"),
                name="unique_patient_birth_number_per_lab",
            ),
        ),
    ]
