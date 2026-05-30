import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_user_totp_lab_qr_payment"),
    ]

    operations = [
        migrations.CreateModel(
            name="LabRolePermission",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "role",
                    models.CharField(
                        choices=[
                            ("admin", "Admin"),
                            ("user", "User"),
                            ("technician", "Technician"),
                        ],
                        max_length=30,
                    ),
                ),
                ("action", models.CharField(max_length=100)),
                ("allowed", models.BooleanField(default=True)),
                (
                    "lab",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="role_permissions",
                        to="core.lab",
                    ),
                ),
            ],
            options={
                "ordering": ["role", "action"],
                "unique_together": {("lab", "role", "action")},
            },
        ),
    ]
