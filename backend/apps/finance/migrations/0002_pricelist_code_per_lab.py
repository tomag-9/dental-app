from django.db import migrations, models
from django.db.models import Count


def check_duplicate_codes(apps, schema_editor):
    PriceList = apps.get_model("finance", "PriceList")
    duplicates = (
        PriceList.objects.values("lab_id", "code")
        .annotate(count=Count("id"))
        .filter(count__gt=1)
    )
    if duplicates.exists():
        sample = duplicates.first()
        raise RuntimeError(
            "Cannot add per-lab price-list code constraint; duplicate code "
            f"{sample['code']!r} exists for lab_id={sample['lab_id']}."
        )


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pricelist",
            name="code",
            field=models.CharField(max_length=50),
        ),
        migrations.RunPython(check_duplicate_codes, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="pricelist",
            constraint=models.UniqueConstraint(
                fields=("lab", "code"),
                name="unique_pricelist_code_per_lab",
            ),
        ),
    ]
