from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("inventory", "0002_warehouseitem_supplier"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="warehouseitem",
            index=models.Index(
                fields=["lab", "sku"],
                name="inventory_w_lab_id_1c6952_idx",
            ),
        ),
    ]
