from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0003_add_invoice_sequence"),
    ]

    operations = [
        migrations.AddField(
            model_name="pricelist",
            name="category",
            field=models.CharField(
                blank=True,
                choices=[
                    ("crown", "Crown"),
                    ("bridge", "Bridge"),
                    ("denture", "Denture"),
                    ("implant", "Implant"),
                    ("orthodontic", "Orthodontic"),
                    ("repair", "Repair"),
                    ("other", "Other"),
                ],
                max_length=30,
                null=True,
            ),
        ),
    ]
