from decimal import Decimal

from django.db import transaction
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.access import TenantScopedQuerysetMixin
from apps.core.access import is_superadmin

from .models import WarehouseItem
from .serializers import WarehouseItemImportSerializer, WarehouseItemSerializer


class WarehouseItemViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = WarehouseItem.objects.all()
    serializer_class = WarehouseItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.get_tenant_scoped_queryset(WarehouseItem.objects.all())

    def perform_create(self, serializer):
        self.save_with_request_lab(serializer)

    @action(detail=False, methods=["get"], url_path="stats")
    def stats(self, request):
        user = request.user
        if not is_superadmin(user) and not getattr(user, "lab_id", None):
            return Response(
                {"detail": "No lab associated with user"},
                status=status.HTTP_403_FORBIDDEN,
            )

        qs = self.get_queryset()
        stock_value = ExpressionWrapper(
            F("quantity") * F("cost_price"),
            output_field=DecimalField(max_digits=14, decimal_places=2),
        )
        total_value = qs.aggregate(total=Sum(stock_value))["total"] or Decimal("0.00")

        category_rows = (
            qs.values("category").annotate(count=Count("id")).order_by("category")
        )

        return Response(
            {
                "total_items": qs.count(),
                "total_value": f"{total_value:.2f}",
                "low_stock_count": qs.filter(
                    min_threshold__isnull=False,
                    quantity__gt=0,
                    quantity__lte=F("min_threshold"),
                ).count(),
                "out_of_stock_count": qs.filter(quantity__lte=0).count(),
                "categories": [
                    {
                        "category": row["category"] or "Uncategorized",
                        "count": row["count"],
                    }
                    for row in category_rows
                ],
            }
        )

    @action(detail=False, methods=["post"], url_path="import")
    def bulk_import(self, request):
        """
        Import multiple warehouse items in a single atomic transaction.
        Validates all rows first; returns 400 if any row is invalid.
        """
        user = request.user
        if not (hasattr(user, "lab") and user.lab):
            return Response(
                {"detail": "No lab associated with user"},
                status=status.HTTP_403_FORBIDDEN,
            )

        items_data = request.data
        if not isinstance(items_data, list):
            return Response(
                {"detail": "Expected a list of items."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializers = []
        errors = {}
        for idx, item_data in enumerate(items_data):
            ser = WarehouseItemImportSerializer(data=item_data)
            if ser.is_valid():
                serializers.append(ser)
            else:
                errors[idx] = ser.errors

        if errors:
            return Response(
                {"detail": "Validation errors in import data.", "errors": errors},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lab = user.lab
        with transaction.atomic():
            created = WarehouseItem.objects.bulk_create(
                [
                    WarehouseItem(
                        lab=lab,
                        name=s.validated_data["name"],
                        sku=s.validated_data.get("sku") or None,
                        quantity=s.validated_data.get("quantity", 0),
                        unit=s.validated_data.get("unit", "pcs"),
                        min_threshold=s.validated_data.get("min_threshold"),
                        category=s.validated_data.get("category") or None,
                        location=s.validated_data.get("location") or None,
                        cost_price=s.validated_data.get("cost_price"),
                        notes=s.validated_data.get("notes") or None,
                    )
                    for s in serializers
                ]
            )

        return Response(
            {"imported": len(created)},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="import-partial")
    def bulk_import_partial(self, request):
        """
        Import multiple warehouse items, skipping invalid rows.
        Returns count of imported and skipped items.
        """
        user = request.user
        if not (hasattr(user, "lab") and user.lab):
            return Response(
                {"detail": "No lab associated with user"},
                status=status.HTTP_403_FORBIDDEN,
            )

        items_data = request.data
        if not isinstance(items_data, list):
            return Response(
                {"detail": "Expected a list of items."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        lab = user.lab
        valid_items = []
        skipped = 0
        for item_data in items_data:
            ser = WarehouseItemImportSerializer(data=item_data)
            if ser.is_valid():
                valid_items.append(ser)
            else:
                skipped += 1

        with transaction.atomic():
            created = WarehouseItem.objects.bulk_create(
                [
                    WarehouseItem(
                        lab=lab,
                        name=s.validated_data["name"],
                        sku=s.validated_data.get("sku") or None,
                        quantity=s.validated_data.get("quantity", 0),
                        unit=s.validated_data.get("unit", "pcs"),
                        min_threshold=s.validated_data.get("min_threshold"),
                        category=s.validated_data.get("category") or None,
                        location=s.validated_data.get("location") or None,
                        cost_price=s.validated_data.get("cost_price"),
                        notes=s.validated_data.get("notes") or None,
                    )
                    for s in valid_items
                ]
            )

        return Response(
            {"imported": len(created), "skipped": skipped},
            status=status.HTTP_201_CREATED,
        )
