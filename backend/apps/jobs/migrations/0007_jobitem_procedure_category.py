from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("jobs", "0006_calendarevent"),
    ]

    operations = [
        migrations.AddField(
            model_name="jobitem",
            name="procedure_category",
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
