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
        # Add as nullable first — no unique constraint yet.
        migrations.AddField(
            model_name="lab",
            name="slug",
            field=models.SlugField(max_length=255, blank=True, null=True),
        ),
        # Populate slugs for existing rows.
        migrations.RunPython(populate_slugs, migrations.RunPython.noop),
        # Add the unique constraint directly (avoids re-creating the _like index).
        migrations.RunSQL(
            "ALTER TABLE core_lab ADD CONSTRAINT core_lab_slug_key UNIQUE (slug);",
            reverse_sql="ALTER TABLE core_lab DROP CONSTRAINT IF EXISTS core_lab_slug_key;",
        ),
    ]
