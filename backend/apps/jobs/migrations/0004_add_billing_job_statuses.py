from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("jobs", "0003_alter_job_doctor"),
    ]

    operations = [
        migrations.AlterField(
            model_name="job",
            name="status",
            field=models.CharField(
                choices=[
                    ("new", "New"),
                    ("in_progress", "In Progress"),
                    ("completed", "Completed"),
                    ("cancelled", "Cancelled"),
                    ("finished_factured", "Finished \u2013 Factured"),
                    ("finished_unfactured", "Finished \u2013 Unfactured"),
                    ("closed", "Closed"),
                ],
                default="new",
                max_length=20,
            ),
        ),
    ]
