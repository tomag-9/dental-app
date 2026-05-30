from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finance", "0008_subscription_extended_fields"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="invoice",
            index=models.Index(
                fields=["lab", "status", "due_date"],
                name="finance_inv_lab_sta_00fb4f_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="invoice",
            index=models.Index(
                fields=["lab", "status", "paid_at"],
                name="finance_inv_lab_sta_b60bb7_idx",
            ),
        ),
    ]
