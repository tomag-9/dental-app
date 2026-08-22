from django.db import migrations

# Celoštátny číselník zdravotných poisťovní SR.
INSURERS = [
    ("25", "Všeobecná zdravotná poisťovňa, a. s.", "VšZP"),
    ("24", "Dôvera zdravotná poisťovňa, a. s.", "Dôvera"),
    ("27", "Union zdravotná poisťovňa, a. s.", "Union"),
]


def seed_insurers(apps, schema_editor):
    Insurer = apps.get_model("crm", "Insurer")
    for code, name, short_name in INSURERS:
        Insurer.objects.update_or_create(
            code=code,
            defaults={"name": name, "short_name": short_name, "is_active": True},
        )


def unseed_insurers(apps, schema_editor):
    Insurer = apps.get_model("crm", "Insurer")
    codes = [code for code, _, _ in INSURERS]
    Insurer.objects.filter(code__in=codes, patients__isnull=True).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("crm", "0003_insurer_clinic_pzs_code_doctor_doctor_code_and_more"),
    ]

    operations = [
        migrations.RunPython(seed_insurers, unseed_insurers),
    ]
