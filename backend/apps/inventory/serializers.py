from rest_framework import serializers

from .models import WarehouseItem


class WarehouseItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarehouseItem
        fields = "__all__"
        read_only_fields = ["lab"]


class WarehouseItemImportSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    sku = serializers.CharField(
        max_length=100, required=False, allow_null=True, allow_blank=True
    )
    quantity = serializers.DecimalField(max_digits=12, decimal_places=2, default=0)
    unit = serializers.CharField(max_length=20, default="pcs")
    min_threshold = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    category = serializers.CharField(
        max_length=100, required=False, allow_null=True, allow_blank=True
    )
    location = serializers.CharField(
        max_length=100, required=False, allow_null=True, allow_blank=True
    )
    supplier = serializers.CharField(
        max_length=255, required=False, allow_null=True, allow_blank=True
    )
    cost_price = serializers.DecimalField(
        max_digits=12, decimal_places=2, required=False, allow_null=True
    )
    notes = serializers.CharField(required=False, allow_null=True, allow_blank=True)
