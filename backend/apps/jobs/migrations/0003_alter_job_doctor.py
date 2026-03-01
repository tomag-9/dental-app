import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("crm", "0001_initial"),
        ("jobs", "0002_vacation"),
    ]

    operations = [
        migrations.AlterField(
            model_name="job",
            name="doctor",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="jobs",
                to="crm.doctor",
            ),
        ),
    ]
