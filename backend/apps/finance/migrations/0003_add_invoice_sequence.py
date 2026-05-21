from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0006_teaminvitation"),
        ("finance", "0002_pricelist_code_per_lab"),
    ]

    operations = [
        migrations.CreateModel(
            name="InvoiceSequence",
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
                ("last_number", models.PositiveIntegerField(default=0)),
                (
                    "lab",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="invoice_sequence",
                        to="core.lab",
                    ),
                ),
            ],
        ),
    ]
