from decimal import Decimal

from django.db import transaction
from rest_framework import serializers

from apps.core.access import is_superadmin
from apps.inventory.models import WarehouseItem

from .models import (
    Manufacturer,
    MaterialCatalog,
    MaterialLot,
    MaterialRecipe,
    MaterialUsage,
    MaterialUsageLine,
    RecipeLine,
)


def request_lab_id(serializer):
    request = serializer.context.get("request")
    user = getattr(request, "user", None)
    if not user:
        return None
    if not is_superadmin(user):
        return getattr(user, "lab_id", None)
    raw = request.data.get("lab") or request.query_params.get("lab") or request.query_params.get("lab_id")
    try:
        return int(raw) if raw else None
    except (TypeError, ValueError):
        return None


class ManufacturerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Manufacturer
        fields = "__all__"
        read_only_fields = ("lab", "created_at", "updated_at")


class MaterialCatalogSerializer(serializers.ModelSerializer):
    stock_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    stock_item = serializers.PrimaryKeyRelatedField(read_only=True)
    manufacturer_name = serializers.CharField(source="manufacturer.name", read_only=True)

    class Meta:
        model = MaterialCatalog
        fields = "__all__"
        read_only_fields = ("lab", "stock_item", "created_at", "updated_at")

    def validate(self, attrs):
        lab_id = request_lab_id(self) or getattr(self.instance, "lab_id", None)
        manufacturer = attrs.get("manufacturer", getattr(self.instance, "manufacturer", None))
        if manufacturer and lab_id and manufacturer.lab_id != lab_id:
            raise serializers.ValidationError({"manufacturer": "Výrobca patrí do iného laboratória."})
        stock_code = attrs.pop("stock_code", serializers.empty)
        if stock_code is not serializers.empty:
            if not stock_code:
                attrs["stock_item"] = None
            else:
                matches = WarehouseItem.objects.filter(lab_id=lab_id, sku=stock_code)
                if matches.count() != 1:
                    raise serializers.ValidationError(
                        {"stock_code": "SKU musí jednoznačne identifikovať skladovú položku laboratória."}
                    )
                attrs["stock_item"] = matches.first()
        return attrs


class MaterialLotSerializer(serializers.ModelSerializer):
    expiry_state = serializers.CharField(read_only=True)
    catalog_details = MaterialCatalogSerializer(source="catalog", read_only=True)

    class Meta:
        model = MaterialLot
        fields = "__all__"
        read_only_fields = ("lab", "expiry_state", "created_at", "updated_at")
        extra_kwargs = {"qty_remaining": {"required": False}}

    def validate(self, attrs):
        lab_id = request_lab_id(self) or getattr(self.instance, "lab_id", None)
        catalog = attrs.get("catalog", getattr(self.instance, "catalog", None))
        if catalog and lab_id and catalog.lab_id != lab_id:
            raise serializers.ValidationError({"catalog": "Materiál patrí do iného laboratória."})
        received = attrs.get("received", getattr(self.instance, "received", None))
        expiry = attrs.get("expiry", getattr(self.instance, "expiry", None))
        if expiry and received and expiry < received:
            raise serializers.ValidationError({"expiry": "Expirácia nemôže byť pred dátumom príjmu."})
        qty_received = attrs.get("qty_received", getattr(self.instance, "qty_received", None))
        has_remaining = "qty_remaining" in attrs
        qty_remaining = attrs.get("qty_remaining", getattr(self.instance, "qty_remaining", qty_received))
        if not has_remaining and self.instance is None:
            attrs["qty_remaining"] = qty_received
            qty_remaining = qty_received
        if qty_received is not None and qty_remaining is not None and qty_remaining > qty_received:
            raise serializers.ValidationError({"qty_remaining": "Zostatok nemôže prekročiť prijaté množstvo."})
        if qty_remaining == 0:
            attrs["status"] = MaterialLot.Status.DEPLETED
        elif attrs.get("status", getattr(self.instance, "status", None)) == MaterialLot.Status.DEPLETED:
            raise serializers.ValidationError({"status": "Spotrebovaná šarža musí mať nulový zostatok."})
        return attrs


class RecipeLineSerializer(serializers.ModelSerializer):
    catalog_details = MaterialCatalogSerializer(source="catalog", read_only=True)

    class Meta:
        model = RecipeLine
        fields = ("id", "catalog", "catalog_details", "qty", "note")
        read_only_fields = ("id",)


class MaterialRecipeSerializer(serializers.ModelSerializer):
    lines = RecipeLineSerializer(many=True)

    class Meta:
        model = MaterialRecipe
        fields = "__all__"
        read_only_fields = ("lab", "created_at", "updated_at")

    def validate_lines(self, lines):
        lab_id = request_lab_id(self) or getattr(self.instance, "lab_id", None)
        seen = set()
        for line in lines:
            catalog = line["catalog"]
            if lab_id and catalog.lab_id != lab_id:
                raise serializers.ValidationError("Materiál receptu patrí do iného laboratória.")
            if catalog.id in seen:
                raise serializers.ValidationError("Materiál môže byť v recepte iba raz.")
            seen.add(catalog.id)
        return lines

    @transaction.atomic
    def create(self, validated_data):
        lines = validated_data.pop("lines")
        recipe = MaterialRecipe.objects.create(**validated_data)
        RecipeLine.objects.bulk_create([RecipeLine(recipe=recipe, **line) for line in lines])
        return recipe

    @transaction.atomic
    def update(self, instance, validated_data):
        lines = validated_data.pop("lines", None)
        instance = super().update(instance, validated_data)
        if lines is not None:
            instance.lines.all().delete()
            RecipeLine.objects.bulk_create([RecipeLine(recipe=instance, **line) for line in lines])
        return instance


class MaterialUsageLineSerializer(serializers.ModelSerializer):
    class Meta:
        model = MaterialUsageLine
        fields = "__all__"
        read_only_fields = (
            "id",
            "usage",
            "source_catalog_id",
            "source_lot_id",
            "name",
            "code",
            "manufacturer",
            "mdr_class",
            "lot",
            "expiry",
            "qty",
            "unit",
        )


class MaterialUsageSerializer(serializers.ModelSerializer):
    lines = MaterialUsageLineSerializer(many=True, read_only=True)

    class Meta:
        model = MaterialUsage
        fields = "__all__"
        read_only_fields = (
            "id",
            "lab",
            "job",
            "patient_label",
            "technician",
            "date",
            "recipe",
            "recipe_source",
            "created_at",
        )


class UsageSelectionSerializer(serializers.Serializer):
    catalog = serializers.PrimaryKeyRelatedField(queryset=MaterialCatalog.objects.all(), required=False)
    lot = serializers.PrimaryKeyRelatedField(queryset=MaterialLot.objects.all(), required=False)
    qty = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))


class CreateMaterialUsageSerializer(serializers.Serializer):
    job = serializers.IntegerField(min_value=1)
    recipe = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    date = serializers.DateField(required=False)
    lines = UsageSelectionSerializer(many=True, required=False)

    def validate(self, attrs):
        if not attrs.get("recipe") and not attrs.get("lines"):
            raise serializers.ValidationError("Zadajte recept alebo aspoň jeden riadok spotreby.")
        for line in attrs.get("lines", []):
            lot = line.get("lot")
            catalog = line.get("catalog")
            if lot and catalog and lot.catalog_id != catalog.id:
                raise serializers.ValidationError({"lines": "Šarža nepatrí k zvolenému materiálu."})
            if not lot and not catalog:
                raise serializers.ValidationError({"lines": "Riadok musí obsahovať materiál alebo šaržu."})
        return attrs


class CatalogImportSerializer(serializers.Serializer):
    code = serializers.CharField(max_length=50)
    name = serializers.CharField(max_length=255)
    manufacturer_prefix = serializers.CharField(max_length=20)
    category = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    unit = serializers.CharField(max_length=20, default="pcs")
    mdr_class = serializers.ChoiceField(
        choices=MaterialCatalog.MDRClass.choices,
        allow_null=True,
        allow_blank=True,
        required=False,
    )
    mode = serializers.ChoiceField(choices=MaterialCatalog.Mode.choices, default=MaterialCatalog.Mode.REPEAT)
    allow_in_job = serializers.BooleanField(default=True)
    stock_code = serializers.CharField(max_length=100, required=False, allow_blank=True, allow_null=True)
    note = serializers.CharField(required=False, allow_blank=True, default="")

    def validate_mdr_class(self, value):
        return value or None


class LotImportSerializer(serializers.Serializer):
    catalog_code = serializers.CharField(max_length=50)
    short_code = serializers.CharField(max_length=50)
    lot = serializers.CharField(max_length=100)
    received = serializers.DateField()
    expiry = serializers.DateField(required=False, allow_null=True)
    opened = serializers.DateField(required=False, allow_null=True)
    qty_received = serializers.DecimalField(max_digits=12, decimal_places=3, min_value=Decimal("0.001"))
    qty_remaining = serializers.DecimalField(
        max_digits=12,
        decimal_places=3,
        min_value=Decimal("0"),
        required=False,
        allow_null=True,
    )
    status = serializers.ChoiceField(choices=MaterialLot.Status.choices, default=MaterialLot.Status.ACTIVE)
    location = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
