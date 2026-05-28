from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0011_lab_role_permission"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(
                fields=["recipient", "read_at"],
                name="core_notifi_recipie_5f8814_idx",
            ),
        ),
    ]
