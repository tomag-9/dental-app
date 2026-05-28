from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("jobs", "0011_calendarevent_contact_jobattachment"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="job",
            index=models.Index(
                fields=["lab", "status", "due_date"],
                name="jobs_job_lab_id_7cdf67_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="calendarevent",
            index=models.Index(
                fields=["lab", "start", "end"],
                name="jobs_calend_lab_id_39c7ad_idx",
            ),
        ),
    ]
