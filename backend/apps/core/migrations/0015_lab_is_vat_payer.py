from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0014_alter_labrolepermission_role_alter_notification_type"),
    ]

    operations = [
        migrations.AddField(
            model_name="lab",
            name="is_vat_payer",
            field=models.BooleanField(default=True),
        ),
    ]
