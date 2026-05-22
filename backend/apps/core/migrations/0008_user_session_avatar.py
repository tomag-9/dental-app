from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0007_add_lab_slug"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="avatar_url",
            field=models.URLField(blank=True, max_length=500, null=True),
        ),
        migrations.CreateModel(
            name="UserSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("jti", models.CharField(max_length=255, unique=True)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("device_info", models.CharField(blank=True, default="", max_length=500)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("expires_at", models.DateTimeField()),
                ("revoked", models.BooleanField(default=False)),
                ("user", models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name="sessions",
                    to=settings.AUTH_USER_MODEL,
                )),
            ],
            options={"ordering": ["-created_at"]},
        ),
    ]
