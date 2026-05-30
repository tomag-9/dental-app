from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0007_add_invoice_discount"),
    ]

    operations = [
        migrations.AddField(
            model_name="subscription",
            name="mrr",
            field=models.DecimalField(
                blank=True, decimal_places=2, default=0, max_digits=10, null=True
            ),
        ),
        migrations.AddField(
            model_name="subscription",
            name="billing_email",
            field=models.EmailField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="subscription",
            name="trial_ends_at",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="subscription",
            name="cancelled_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
