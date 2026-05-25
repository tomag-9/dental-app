import csv
from decimal import Decimal
from io import BytesIO

import openpyxl
from django.db import transaction
from django.db.models import Count, DecimalField, ExpressionWrapper, F, Sum
from django.http import HttpResponse
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.access import TenantScopedQuerysetMixin
from apps.core.access import is_superadmin

from .models import WarehouseItem
from .serializers import WarehouseItemImportSerializer, WarehouseItemSerializer


def _check_low_stock_notification(item):
    from apps.core.models import Notification, User

    if not item.lab_id:
        return
    threshold = item.min_threshold
    if threshold is None:
        return
    if item.quantity > threshold:
        return
    title = (
        f"Nulový stav skladu: {item.name}"
        if item.quantity <= 0
        else f"Nízky stav skladu: {item.name}"
    )
    message = f"Aktuálny stav: {item.quantity} {item.unit or 'ks'}, minimum: {threshold} {item.unit or 'ks'}."
    already_notified = Notification.objects.filter(
        lab_id=item.lab_id,
        type="stock",
        url=f"/inventory/{item.id}",
        read_at__isnull=True,
    ).exists()
    if already_notified:
        return
    for admin in User.objects.filter(
        lab_id=item.lab_id, role__in=("admin", "superadmin"), is_active=True
    ):
        Notification.objects.create(
            lab_id=item.lab_id,
            recipient=admin,
            type="stock",
            title=title,
            message=message,
            url=f"/inventory/{item.id}",
        )


class WarehouseItemViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = WarehouseItem.objects.all()
    serializer_class = WarehouseItemSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.get_tenant_scoped_queryset(WarehouseItem.objects.all())

    def perform_create(self, serializer):
        self.save_with_request_lab(serializer)
        _check_low_stock_notification(serializer.instance)

    def perform_update(self, serializer):
        serializer.save()
        _check_low_stock_notification(serializer.instance)

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

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        header = [
            "name",
            "sku",
            "quantity",
            "unit",
            "category",
            "supplier",
            "cost_price",
            "location",
            "notes",
        ]
        rows = [
            [
                item.name,
                item.sku or "",
                item.quantity,
                item.unit or "",
                item.category or "",
                item.supplier or "",
                item.cost_price if item.cost_price is not None else "",
                item.location or "",
                item.notes or "",
            ]
            for item in self.get_queryset().order_by("name")
        ]
        if request.query_params.get("format") == "xlsx":
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Sklad"
            ws.append(header)
            for row in rows:
                ws.append(row)
            buf = BytesIO()
            wb.save(buf)
            buf.seek(0)
            response = HttpResponse(
                buf.read(),
                content_type=(
                    "application/vnd.openxmlformats-officedocument"
                    ".spreadsheetml.sheet"
                ),
            )
            response["Content-Disposition"] = 'attachment; filename="inventory.xlsx"'
            return response
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="inventory.csv"'
        writer = csv.writer(response)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)
        return response

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
                        supplier=s.validated_data.get("supplier") or None,
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
                        supplier=s.validated_data.get("supplier") or None,
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

    _CSV_FIELDS = [
        "name",
        "sku",
        "quantity",
        "unit",
        "min_threshold",
        "category",
        "location",
        "supplier",
        "cost_price",
        "notes",
    ]

    @action(detail=False, methods=["post"], url_path="import-csv")
    def import_csv(self, request):
        """
        Import warehouse items from a multipart CSV file upload.
        POST /api/inventory/warehouse/import-csv/  (field name: file)
        Header row must match field names; unknown columns are ignored.
        Invalid rows are skipped; returns counts of imported and skipped items.
        """
        user = request.user
        if not (hasattr(user, "lab") and user.lab):
            return Response(
                {"detail": "No lab associated with user"},
                status=status.HTTP_403_FORBIDDEN,
            )

        csv_file = request.FILES.get("file")
        if not csv_file:
            return Response(
                {"detail": "No file provided. Send a CSV file in the 'file' field."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            text = csv_file.read().decode("utf-8-sig")
        except UnicodeDecodeError:
            return Response(
                {"detail": "File encoding must be UTF-8."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        reader = csv.DictReader(text.splitlines())
        if not reader.fieldnames:
            return Response(
                {"detail": "CSV file is empty or missing a header row."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        _MAX_ROWS = 5_000

        lab = user.lab
        valid_items = []
        skipped = 0
        row_errors = {}

        for idx, row in enumerate(reader):
            if idx >= _MAX_ROWS:
                return Response(
                    {
                        "detail": f"CSV exceeds the {_MAX_ROWS}-row limit. Split into smaller files."
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )

            item_data = {
                field: value
                for field in self._CSV_FIELDS
                if (value := (row.get(field) or "").strip())
            }
            ser = WarehouseItemImportSerializer(data=item_data)
            if ser.is_valid():
                valid_items.append(ser)
            else:
                skipped += 1
                row_errors[idx + 2] = ser.errors

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
                        supplier=s.validated_data.get("supplier") or None,
                        cost_price=s.validated_data.get("cost_price"),
                        notes=s.validated_data.get("notes") or None,
                    )
                    for s in valid_items
                ]
            )

        response_data = {"imported": len(created), "skipped": skipped}
        if row_errors:
            response_data["row_errors"] = row_errors
        return Response(response_data, status=status.HTTP_201_CREATED)
