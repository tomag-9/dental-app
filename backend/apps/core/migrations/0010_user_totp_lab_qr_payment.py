from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_lab_api_key"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="totp_secret",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="totp_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="lab",
            name="enable_qr_payment",
            field=models.BooleanField(default=False),
        ),
    ]
