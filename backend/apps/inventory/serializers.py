from rest_framework import serializers

from .models import WarehouseItem


class WarehouseItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarehouseItem
        fields = "__all__"
        read_only_fields = ["lab"]
