import csv
from datetime import timedelta
from io import BytesIO, StringIO

from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone
from drf_spectacular.types import OpenApiTypes
from drf_spectacular.utils import OpenApiParameter, extend_schema
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import (
    IsReadOnlyOrAdminOrSuperadminPermission,
    TenantScopedQuerysetMixin,
    is_superadmin,
)
from apps.core.models import Lab
from apps.inventory.models import WarehouseItem
from apps.jobs.models import Job

from .models import (
    Manufacturer,
    MaterialCatalog,
    MaterialLot,
    MaterialRecipe,
    MaterialUsage,
)
from .serializers import (
    CatalogImportSerializer,
    CreateMaterialUsageSerializer,
    LotImportSerializer,
    ManufacturerSerializer,
    MaterialCatalogSerializer,
    MaterialLotSerializer,
    MaterialRecipeSerializer,
    MaterialUsageSerializer,
)
from .services import available_lots, create_usage


class MaterialTenantViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    permission_classes = [
        permissions.IsAuthenticated,
        IsReadOnlyOrAdminOrSuperadminPermission,
    ]

    def perform_create(self, serializer):
        self.save_with_request_lab(serializer)


class ManufacturerViewSet(MaterialTenantViewSet):
    queryset = Manufacturer.objects.all()
    serializer_class = ManufacturerSerializer

    def get_queryset(self):
        return self.get_tenant_scoped_queryset(self.queryset).order_by("name")


class MaterialCatalogViewSet(MaterialTenantViewSet):
    queryset = MaterialCatalog.objects.select_related("manufacturer", "stock_item")
    serializer_class = MaterialCatalogSerializer

    def get_queryset(self):
        queryset = self.get_tenant_scoped_queryset(self.queryset)
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category=category)
        allow_in_job = self.request.query_params.get("allow_in_job")
        if allow_in_job in ("true", "false"):
            queryset = queryset.filter(allow_in_job=allow_in_job == "true")
        return queryset.order_by("code")

    def _import_lab(self):
        if not is_superadmin(self.request.user):
            lab = getattr(self.request.user, "lab", None)
            if not lab:
                raise ValidationError("Používateľ nemá priradené laboratórium.")
            return lab
        lab_id = self.request.data.get("lab") if isinstance(self.request.data, dict) else None
        lab_id = lab_id or self.request.query_params.get("lab") or self.request.query_params.get("lab_id")
        try:
            return Lab.objects.get(pk=lab_id)
        except (Lab.DoesNotExist, TypeError, ValueError) as exc:
            raise ValidationError({"lab": "Superadmin musí zadať platné laboratórium."}) from exc

    def _rows_from_request(self):
        if "file" not in self.request.FILES:
            data = self.request.data.get("items") if isinstance(self.request.data, dict) else self.request.data
            if not isinstance(data, list):
                raise ValidationError("Očakáva sa zoznam položiek alebo CSV súbor v poli 'file'.")
            return data
        try:
            text = self.request.FILES["file"].read().decode("utf-8-sig")
        except UnicodeDecodeError as exc:
            raise ValidationError({"file": "CSV musí byť v UTF-8."}) from exc
        nullable_csv_fields = {
            "mdr_class",
            "stock_code",
            "expiry",
            "opened",
            "qty_remaining",
        }
        return [
            {key: (None if key in nullable_csv_fields and value == "" else value) for key, value in row.items()}
            for row in csv.DictReader(StringIO(text))
        ]

    @action(detail=False, methods=["post"], url_path="import")
    def bulk_import(self, request):
        lab = self._import_lab()
        rows = self._rows_from_request()
        serializers = [CatalogImportSerializer(data=row) for row in rows]
        errors = {index: serializer.errors for index, serializer in enumerate(serializers) if not serializer.is_valid()}
        if errors:
            return Response(
                {"detail": "Import obsahuje neplatné riadky.", "errors": errors},
                status=400,
            )
        codes = [serializer.validated_data["code"] for serializer in serializers]
        duplicate_codes = sorted({code for code in codes if codes.count(code) > 1})
        existing_codes = sorted(MaterialCatalog.objects.filter(lab=lab, code__in=codes).values_list("code", flat=True))
        if duplicate_codes or existing_codes:
            raise ValidationError(
                {"code": f"Duplicitné kódy: {', '.join(sorted(set(duplicate_codes + existing_codes)))}"}
            )
        manufacturers = {item.prefix: item for item in Manufacturer.objects.filter(lab=lab)}
        missing = sorted(
            {serializer.validated_data["manufacturer_prefix"] for serializer in serializers} - manufacturers.keys()
        )
        if missing:
            raise ValidationError({"manufacturer_prefix": f"Neznáme prefixy výrobcov: {', '.join(missing)}"})
        skus = {serializer.validated_data.get("stock_code") for serializer in serializers}
        skus.discard(None)
        skus.discard("")
        stock = {item.sku: item for item in WarehouseItem.objects.filter(lab=lab, sku__in=skus)}
        ambiguous_skus = sorted(sku for sku in skus if WarehouseItem.objects.filter(lab=lab, sku=sku).count() != 1)
        if ambiguous_skus:
            raise ValidationError({"stock_code": f"Nejednoznačné skladové SKU: {', '.join(ambiguous_skus)}"})
        missing_skus = sorted(skus - stock.keys())
        if missing_skus:
            raise ValidationError({"stock_code": f"Neznáme skladové SKU: {', '.join(missing_skus)}"})
        with transaction.atomic():
            objects = [
                MaterialCatalog(
                    lab=lab,
                    manufacturer=manufacturers[data["manufacturer_prefix"]],
                    stock_item=stock.get(data.get("stock_code")),
                    **{key: value for key, value in data.items() if key not in ("manufacturer_prefix", "stock_code")},
                )
                for data in (serializer.validated_data for serializer in serializers)
            ]
            MaterialCatalog.objects.bulk_create(objects)
        return Response({"imported": len(objects)}, status=status.HTTP_201_CREATED)


class MaterialLotViewSet(MaterialTenantViewSet):
    queryset = MaterialLot.objects.select_related("catalog", "catalog__manufacturer", "catalog__stock_item")
    serializer_class = MaterialLotSerializer

    def get_queryset(self):
        queryset = self.get_tenant_scoped_queryset(self.queryset)
        catalog_id = _positive_int_query_param(self.request, "catalog")
        if catalog_id:
            queryset = queryset.filter(catalog_id=catalog_id)
        lot_status = self.request.query_params.get("status")
        if lot_status:
            queryset = queryset.filter(status=lot_status)
        expiry_state = self.request.query_params.get("expiry_state")
        today = timezone.localdate()
        if expiry_state == "expired":
            queryset = queryset.filter(expiry__lt=today)
        elif expiry_state == "soon":
            queryset = queryset.filter(expiry__range=(today, today + timedelta(days=60)))
        elif expiry_state == "ok":
            queryset = queryset.filter(expiry__gt=today + timedelta(days=60))
        elif expiry_state == "none":
            queryset = queryset.filter(expiry__isnull=True)
        return queryset

    @action(detail=False, methods=["post"], url_path="import")
    def bulk_import(self, request):
        helper = MaterialCatalogViewSet()
        helper.request = request
        lab = helper._import_lab()
        rows = helper._rows_from_request()
        serializers = [LotImportSerializer(data=row) for row in rows]
        errors = {index: serializer.errors for index, serializer in enumerate(serializers) if not serializer.is_valid()}
        if errors:
            return Response(
                {"detail": "Import obsahuje neplatné riadky.", "errors": errors},
                status=400,
            )
        short_codes = [serializer.validated_data["short_code"] for serializer in serializers]
        lot_keys = [
            (
                serializer.validated_data["catalog_code"],
                serializer.validated_data["lot"],
            )
            for serializer in serializers
        ]
        duplicates = sorted({code for code in short_codes if short_codes.count(code) > 1})
        duplicates.extend(
            code
            for code in MaterialLot.objects.filter(lab=lab, short_code__in=short_codes).values_list(
                "short_code", flat=True
            )
        )
        if len(set(lot_keys)) != len(lot_keys):
            raise ValidationError({"lot": "Import obsahuje duplicitnú kombináciu materiálu a LOT."})
        existing_lot_keys = {
            (catalogs_code, lot_number)
            for catalogs_code, lot_number in MaterialLot.objects.filter(
                lab=lab,
                catalog__code__in={key[0] for key in lot_keys},
                lot__in={key[1] for key in lot_keys},
            ).values_list("catalog__code", "lot")
        }
        if existing_lot_keys.intersection(lot_keys):
            raise ValidationError({"lot": "Materiál s týmto LOT už v laboratóriu existuje."})
        if duplicates:
            raise ValidationError({"short_code": f"Duplicitné krátke kódy: {', '.join(sorted(set(duplicates)))}"})
        catalogs = {item.code: item for item in MaterialCatalog.objects.filter(lab=lab)}
        missing = sorted({s.validated_data["catalog_code"] for s in serializers} - catalogs.keys())
        if missing:
            raise ValidationError({"catalog_code": f"Neznáme kódy materiálov: {', '.join(missing)}"})
        objects = []
        for serializer in serializers:
            data = dict(serializer.validated_data)
            catalog = catalogs[data.pop("catalog_code")]
            data.setdefault("qty_remaining", data["qty_received"])
            if data["qty_remaining"] > data["qty_received"]:
                raise ValidationError({"qty_remaining": "Zostatok nemôže prekročiť prijaté množstvo."})
            if data.get("expiry") and data["expiry"] < data["received"]:
                raise ValidationError({"expiry": "Expirácia nemôže byť pred dátumom príjmu."})
            if data["qty_remaining"] == 0:
                data["status"] = MaterialLot.Status.DEPLETED
            objects.append(MaterialLot(lab=lab, catalog=catalog, **data))
        with transaction.atomic():
            MaterialLot.objects.bulk_create(objects)
        return Response({"imported": len(objects)}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="label-pdf")
    def label_pdf(self, request, pk=None):
        lot = self.get_object()
        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=(100 * mm, 60 * mm))
        pdf.setTitle(f"LOT {lot.lot}")
        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(8 * mm, 51 * mm, lot.catalog.name)
        pdf.setFont("Helvetica", 10)
        lines = [
            f"Code: {lot.catalog.code}",
            f"LOT: {lot.lot}",
            f"Expiry: {lot.expiry.isoformat() if lot.expiry else '-'}",
            f"MDR: {lot.catalog.mdr_class or '-'}",
            f"Location: {lot.location or '-'}",
        ]
        for index, line in enumerate(lines):
            pdf.drawString(8 * mm, (43 - index * 7) * mm, line)
        widget = qr.QrCodeWidget(f"material-lot:{lot.id}:{lot.catalog.code}:{lot.lot}")
        bounds = widget.getBounds()
        size = 30 * mm
        drawing = Drawing(
            size,
            size,
            transform=[
                size / (bounds[2] - bounds[0]),
                0,
                0,
                size / (bounds[3] - bounds[1]),
                0,
                0,
            ],
        )
        drawing.add(widget)
        renderPDF.draw(drawing, pdf, 65 * mm, 7 * mm)
        pdf.save()
        return _pdf_response(buffer, f"lot_label_{lot.short_code}.pdf")

    @action(detail=True, methods=["get"], url_path="conformity-pdf")
    def conformity_pdf(self, request, pk=None):
        lot = self.get_object()
        return _render_conformity_pdf(lab=lot.lab, lot=lot)


class MaterialRecipeViewSet(MaterialTenantViewSet):
    queryset = MaterialRecipe.objects.prefetch_related("lines__catalog__manufacturer", "lines__catalog__stock_item")
    serializer_class = MaterialRecipeSerializer

    def get_queryset(self):
        return self.get_tenant_scoped_queryset(self.queryset)


class MaterialUsageViewSet(TenantScopedQuerysetMixin, viewsets.ReadOnlyModelViewSet):
    queryset = MaterialUsage.objects.select_related("job", "lab", "recipe_source").prefetch_related("lines")
    serializer_class = MaterialUsageSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsReadOnlyOrAdminOrSuperadminPermission,
    ]

    def get_queryset(self):
        queryset = self.get_tenant_scoped_queryset(self.queryset)
        job_id = _positive_int_query_param(self.request, "job", alias="job_id")
        if job_id:
            queryset = queryset.filter(job_id=job_id)
        return queryset

    def create(self, request, *args, **kwargs):
        input_serializer = CreateMaterialUsageSerializer(data=request.data, context={"request": request})
        input_serializer.is_valid(raise_exception=True)
        lab = _request_lab(request)
        usage = create_usage(actor=request.user, lab=lab, validated_data=input_serializer.validated_data)
        return Response(self.get_serializer(usage).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="conformity-pdf")
    def conformity_pdf(self, request, pk=None):
        usage = self.get_object()
        return _render_conformity_pdf(lab=usage.lab, usage=usage)

    @action(detail=False, methods=["get"], url_path="job-conformity-pdf")
    def job_conformity_pdf(self, request):
        job_id = _positive_int_query_param(request, "job", alias="job_id", required=True)
        usages = list(self.get_queryset().filter(job_id=job_id))
        if not usages:
            raise ValidationError({"job": "Zákazka nemá zaznamenanú spotrebu materiálu."})
        response = _render_conformity_pdf(lab=usages[0].lab, usages=usages)
        response["X-Material-Usage-Count"] = str(len(usages))
        return response


class FefoView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        parameters=[
            OpenApiParameter("recipe", OpenApiTypes.INT, required=True),
            OpenApiParameter("job", OpenApiTypes.INT, required=False),
        ],
        responses={200: OpenApiTypes.OBJECT},
        description="Return non-expired, usable lots for every recipe line in FEFO order.",
    )
    def get(self, request):
        lab = _request_lab(request, query=True)
        recipe_id = _positive_int_query_param(request, "recipe", required=True)
        try:
            recipe = MaterialRecipe.objects.prefetch_related("lines__catalog").get(pk=recipe_id, lab=lab)
        except MaterialRecipe.DoesNotExist as exc:
            raise ValidationError({"recipe": "Recept neexistuje v tomto laboratóriu."}) from exc
        job_id = _positive_int_query_param(request, "job")
        if job_id and not Job.objects.filter(pk=job_id, lab=lab).exists():
            raise ValidationError({"job": "Zákazka neexistuje v tomto laboratóriu."})
        result = []
        for line in recipe.lines.all():
            lots = available_lots(line.catalog)
            result.append(
                {
                    "catalog": MaterialCatalogSerializer(line.catalog, context={"request": request}).data,
                    "required_qty": str(line.qty),
                    "available_qty": str(sum((lot.qty_remaining for lot in lots), start=0)),
                    "lots": MaterialLotSerializer(lots, many=True, context={"request": request}).data,
                }
            )
        return Response(
            {
                "recipe": recipe.id,
                "job": int(job_id) if job_id else None,
                "lines": result,
            }
        )


def _request_lab(request, *, query=False):
    if not is_superadmin(request.user):
        lab = getattr(request.user, "lab", None)
        if not lab:
            raise ValidationError("Používateľ nemá priradené laboratórium.")
        return lab
    source = request.query_params if query else request.data
    lab_id = source.get("lab") or source.get("lab_id")
    try:
        return Lab.objects.get(pk=lab_id)
    except (Lab.DoesNotExist, TypeError, ValueError) as exc:
        raise ValidationError({"lab": "Superadmin musí zadať platné laboratórium."}) from exc


def _positive_int_query_param(request, name, *, alias=None, required=False):
    value = request.query_params.get(name)
    if value in (None, "") and alias:
        value = request.query_params.get(alias)
    if value in (None, ""):
        if required:
            raise ValidationError({name: f"Parameter {name} je povinný."})
        return None
    try:
        value = int(value)
    except (TypeError, ValueError) as exc:
        raise ValidationError({name: f"Parameter {name} musí byť celé číslo."}) from exc
    if value < 1:
        raise ValidationError({name: f"Parameter {name} musí byť kladné číslo."})
    return value


def _pdf_response(buffer, filename):
    content = buffer.getvalue()
    buffer.close()
    response = HttpResponse(content, content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response


def _render_conformity_pdf(*, lab, usage=None, usages=None, lot=None):
    usage_records = list(usages or ([usage] if usage else []))
    primary_usage = usage_records[0] if usage_records else None
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle("Declaration of conformity - MDR 2017/745 Annex XIII")
    y = 278 * mm
    pdf.setFont("Helvetica-Bold", 16)
    pdf.drawString(20 * mm, y, "Declaration of conformity")
    y -= 9 * mm
    pdf.setFont("Helvetica", 10)
    lines = [
        "Custom-made medical device — MDR (EU) 2017/745, Annex XIII",
        f"Manufacturer: {lab.name}",
        f"Address: {', '.join(filter(None, [lab.address, lab.postal_code, lab.city, lab.country]))}",
        f"Identifier: {'Job ' + str(primary_usage.job_id) if primary_usage else 'LOT ' + lot.lot}",
    ]
    if primary_usage:
        technicians = sorted({item.technician for item in usage_records if item.technician})
        recipes = sorted({item.recipe for item in usage_records if item.recipe})
        usage_dates = sorted({item.date.isoformat() for item in usage_records})
        lines.extend(
            [
                f"Patient: {primary_usage.patient_label}",
                f"Technician: {', '.join(technicians) or '-'}",
                f"Recipe / intended design: {', '.join(recipes) or 'custom dental device'}",
                f"Date of manufacture/use: {', '.join(usage_dates)}",
                "This device is intended exclusively for the identified patient.",
                "Materials used:",
            ]
        )
        for usage_record in usage_records:
            for line in usage_record.lines.all():
                lines.append(
                    f"  {line.code} {line.name}; LOT {line.lot}; {line.qty} {line.unit}; MDR {line.mdr_class or '-'}"
                )
    else:
        lines.extend(
            [
                f"Material: {lot.catalog.code} {lot.catalog.name}",
                f"Manufacturer: {lot.catalog.manufacturer.name}",
                f"Expiry: {lot.expiry.isoformat() if lot.expiry else '-'}",
                f"MDR class: {lot.catalog.mdr_class or '-'}",
            ]
        )
    lines.extend(
        [
            "The device/material conforms to the applicable general safety and performance requirements.",
            "Any requirements not fully met are documented in the technical documentation.",
            "Authorized person: ____________________",
            f"Issued: {timezone.localdate().isoformat()}    Signature: ____________________",
        ]
    )
    for text in lines:
        if y < 20 * mm:
            pdf.showPage()
            pdf.setFont("Helvetica", 10)
            y = 278 * mm
        pdf.drawString(20 * mm, y, str(text)[:115])
        y -= 7 * mm
    pdf.save()
    suffix = f"job_{primary_usage.job_id}" if primary_usage else f"lot_{lot.short_code}"
    return _pdf_response(buffer, f"conformity_{suffix}.pdf")
