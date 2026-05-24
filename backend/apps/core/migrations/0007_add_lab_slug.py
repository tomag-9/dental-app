from django.db import migrations, models
from django.utils.text import slugify


def populate_slugs(apps, schema_editor):
    Lab = apps.get_model("core", "Lab")
    for lab in Lab.objects.all():
        base = slugify(lab.name) or f"lab-{lab.pk}"
        slug = base
        n = 1
        while Lab.objects.filter(slug=slug).exclude(pk=lab.pk).exists():
            slug = f"{base}-{n}"
            n += 1
        lab.slug = slug
        lab.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0006_teaminvitation"),
    ]

    operations = [
        # Add as nullable first, no index yet to avoid duplicate index on AlterField.
        migrations.AddField(
            model_name="lab",
            name="slug",
            field=models.SlugField(
                max_length=255, blank=True, null=True, db_index=False
            ),
        ),
        # Populate slugs for existing rows.
        migrations.RunPython(populate_slugs, migrations.RunPython.noop),
        # Make slug non-nullable and unique.
        migrations.AlterField(
            model_name="lab",
            name="slug",
            field=models.SlugField(max_length=255, blank=True, unique=True),
        ),
    ]
