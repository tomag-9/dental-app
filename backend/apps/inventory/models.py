from django.db import models

from apps.core.models import Lab


class WarehouseItem(models.Model):
    lab = models.ForeignKey(
        Lab, on_delete=models.CASCADE, related_name="inventory_items"
    )
    name = models.CharField(max_length=255, null=False)
    sku = models.CharField(max_length=100, blank=True, null=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    unit = models.CharField(max_length=20, default="pcs")
    min_threshold = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    category = models.CharField(max_length=100, blank=True, null=True)
    location = models.CharField(max_length=100, blank=True, null=True)
    supplier = models.CharField(max_length=255, blank=True, null=True)
    cost_price = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    notes = models.TextField(blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.quantity} {self.unit})"

    class Meta:
        indexes = [
            models.Index(
                fields=["lab", "sku"],
                name="inventory_w_lab_id_1c6952_idx",
            ),
        ]
