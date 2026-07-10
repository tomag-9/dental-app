from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0010_alter_invoice_document_type_alter_invoice_status_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="invoice",
            name="custom_description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AddField(
            model_name="invoice",
            name="description_mode",
            field=models.CharField(
                choices=[
                    ("structured", "Štruktúrovaný popis"),
                    ("custom", "Voľný popis"),
                ],
                default="structured",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="invoice",
            name="show_patient_list",
            field=models.BooleanField(default=True),
        ),
    ]
