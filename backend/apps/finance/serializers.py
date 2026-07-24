from decimal import Decimal

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.models import AuditLog

from . import invoice_service
from .calculations import calculate_invoice_amounts, reverse_invoice_subtotal
from .models import Invoice, InvoiceItem, PriceList, Subscription


class PriceListSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceList
        fields = "__all__"
        read_only_fields = ["lab"]

    def validate(self, attrs):
        request = self.context.get("request")
        lab = getattr(getattr(request, "user", None), "lab", None) or getattr(self.instance, "lab", None)
        code = attrs.get("code", getattr(self.instance, "code", None))
        if lab and code:
            qs = PriceList.objects.filter(lab=lab, code=code)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError({"code": "Price-list code already exists for this lab."})
        return attrs


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = (
            "id",
            "invoice",
            "job",
            "description",
            "quantity",
            "unit_price",
            "line_total",
        )


class InvoiceCreateSerializer(serializers.Serializer):
    clinic_id = serializers.IntegerField()
    job_ids = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        allow_empty=False,
    )
    document_type = serializers.ChoiceField(
        choices=("invoice", "proforma"),
        default="invoice",
        required=False,
    )
    discount_percent = serializers.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=0,
        required=False,
        min_value=0,
        max_value=100,
    )
    description_mode = serializers.ChoiceField(
        choices=("structured", "custom"),
        default="structured",
        required=False,
    )
    custom_description = serializers.CharField(
        allow_blank=True,
        required=False,
        default="",
        max_length=1000,
    )
    show_patient_list = serializers.BooleanField(default=True, required=False)

    def validate(self, attrs):
        if attrs.get("description_mode") == "custom" and not attrs.get("custom_description", "").strip():
            raise serializers.ValidationError({"custom_description": "Voľný popis je povinný."})
        return attrs


class InvoiceStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=("draft", "issued", "paid", "cancelled"))


class InvoiceEmailSerializer(serializers.Serializer):
    email = serializers.EmailField(required=False, allow_blank=False)


class InvoiceAuditLogEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    action = serializers.CharField()
    label = serializers.CharField()
    actor_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    message = serializers.CharField(allow_blank=True, allow_null=True)
    metadata = serializers.DictField()


class InvoiceMaterialLineSerializer(serializers.Serializer):
    name = serializers.CharField()
    code = serializers.CharField()
    manufacturer = serializers.CharField()
    lot = serializers.CharField()
    quantity = serializers.DecimalField(max_digits=12, decimal_places=3)
    unit = serializers.CharField()


class InvoiceRecipeSerializer(serializers.Serializer):
    name = serializers.CharField()
    date = serializers.CharField(allow_blank=True, allow_null=True)
    materials = InvoiceMaterialLineSerializer(many=True)


class InvoiceProcedureSerializer(serializers.Serializer):
    description = serializers.CharField()
    quantity = serializers.IntegerField()
    unit_price = serializers.DecimalField(max_digits=10, decimal_places=2)
    line_total = serializers.DecimalField(max_digits=10, decimal_places=2)


class InvoiceAppendixRowSerializer(serializers.Serializer):
    job_id = serializers.IntegerField(allow_null=True)
    patient_id = serializers.IntegerField(allow_null=True)
    patient_name = serializers.CharField()
    job_description = serializers.CharField(allow_blank=True)
    procedures = InvoiceProcedureSerializer(many=True)
    recipes = InvoiceRecipeSerializer(many=True)
    total = serializers.DecimalField(max_digits=12, decimal_places=2)


class InvoicePatientSummarySerializer(serializers.Serializer):
    patient_id = serializers.IntegerField(allow_null=True)
    patient_name = serializers.CharField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2)


def _sk_date(d):
    """Format a date as DD.MM.YYYY (Slovak locale convention)."""
    if d is None:
        return None
    return d.strftime("%d.%m.%Y")


def _sk_amount(amount):
    """Format a Decimal as '1 234,56 EUR' (Slovak locale convention)."""
    if amount is None:
        return None
    # Slovak: thousands separator = space, decimal separator = comma
    parts = f"{Decimal(str(amount)):.2f}".split(".")
    integer_part = "{:,}".format(int(parts[0])).replace(",", " ")  # non-breaking space
    return f"{integer_part},{parts[1]} EUR"


class InvoiceSerializer(serializers.ModelSerializer):
    AUDIT_LABELS = {
        "invoice.created": "Faktúra vytvorená",
        "invoice.status_changed": "Zmena stavu faktúry",
        "invoice.deleted": "Faktúra zmazaná",
        "invoice.email_sent": "Faktúra odoslaná e-mailom",
    }

    items = InvoiceItemSerializer(many=True, read_only=True)
    clinic_name = serializers.CharField(source="clinic.name", read_only=True)
    clinic_email = serializers.SerializerMethodField()
    patient_names = serializers.SerializerMethodField()
    subtotal_amount = serializers.SerializerMethodField()
    discount_amount = serializers.SerializerMethodField()
    taxable_amount = serializers.SerializerMethodField()
    vat_amount = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    days_overdue = serializers.SerializerMethodField()
    related_jobs = serializers.SerializerMethodField()
    patient_summaries = serializers.SerializerMethodField()
    appendix_rows = serializers.SerializerMethodField()
    formatted_total = serializers.SerializerMethodField()
    formatted_due_date = serializers.SerializerMethodField()
    formatted_issued_at = serializers.SerializerMethodField()
    audit_log = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = (
            "id",
            "number",
            "lab",
            "clinic",
            "clinic_name",
            "clinic_email",
            "status",
            "document_type",
            "vat_rate",
            "discount_percent",
            "description_mode",
            "custom_description",
            "show_patient_list",
            "total_amount",
            "subtotal_amount",
            "discount_amount",
            "taxable_amount",
            "vat_amount",
            "formatted_total",
            "formatted_due_date",
            "formatted_issued_at",
            "is_overdue",
            "days_overdue",
            "created_at",
            "issued_at",
            "paid_at",
            "due_date",
            "items",
            "patient_names",
            "patient_summaries",
            "appendix_rows",
            "related_jobs",
            "audit_log",
        )

    def get_patient_names(self, obj):
        return sorted(
            {
                row["patient_name"]
                for row in self._breakdown(obj)
                if row.get("patient_name") and row["patient_name"] != "Bez pacienta"
            }
        )

    def get_clinic_email(self, obj):
        contact_info = obj.clinic.contact_info or {}
        return contact_info.get("email", "") if isinstance(contact_info, dict) else ""

    def get_formatted_total(self, obj):
        return _sk_amount(obj.total_amount)

    def get_formatted_due_date(self, obj):
        return _sk_date(obj.due_date)

    def get_formatted_issued_at(self, obj):
        d = obj.issued_at.date() if obj.issued_at else None
        return _sk_date(d)

    def get_subtotal_amount(self, obj):
        subtotal = self._subtotal(obj)
        return f"{subtotal:.2f}"

    def get_vat_amount(self, obj):
        amounts = calculate_invoice_amounts(self._subtotal(obj), obj.vat_rate, obj.discount_percent)
        return f"{amounts['vat_amount']:.2f}"

    def get_discount_amount(self, obj):
        amounts = calculate_invoice_amounts(self._subtotal(obj), obj.vat_rate, obj.discount_percent)
        return f"{amounts['discount_amount']:.2f}"

    def get_taxable_amount(self, obj):
        amounts = calculate_invoice_amounts(self._subtotal(obj), obj.vat_rate, obj.discount_percent)
        return f"{amounts['taxable_amount']:.2f}"

    def _subtotal(self, obj):
        items = obj.items.all()
        if items:
            return sum((Decimal(str(item.line_total or 0)) for item in items), Decimal())
        return reverse_invoice_subtotal(obj.total_amount, obj.vat_rate, obj.discount_percent)

    def get_is_overdue(self, obj):
        return bool(obj.status == "issued" and obj.due_date and obj.due_date < timezone.localdate())

    def get_days_overdue(self, obj):
        if not self.get_is_overdue(obj):
            return 0
        return (timezone.localdate() - obj.due_date).days

    def get_related_jobs(self, obj):
        related = []
        seen = set()
        for item in sorted(obj.items.all(), key=lambda value: (value.job_id or 0, value.id)):
            job = item.job
            if not job or job.id in seen:
                continue
            seen.add(job.id)
            patient = job.patient
            patient_name = f"{patient.first_name} {patient.last_name}".strip() if patient else ""
            related.append(
                {
                    "id": job.id,
                    "status": job.status,
                    "description": job.description,
                    "patient_name": patient_name,
                    "due_date": job.due_date.isoformat() if job.due_date else None,
                }
            )
        return related

    def _breakdown(self, obj):
        if not hasattr(obj, "_invoice_breakdown_cache"):
            obj._invoice_breakdown_cache = invoice_service.build_invoice_breakdown(obj)
        return obj._invoice_breakdown_cache

    @extend_schema_field(InvoicePatientSummarySerializer(many=True))
    def get_patient_summaries(self, obj):
        summaries = invoice_service.build_invoice_patient_summaries(obj, self._breakdown(obj))
        return InvoicePatientSummarySerializer(summaries, many=True).data

    @extend_schema_field(InvoiceAppendixRowSerializer(many=True))
    def get_appendix_rows(self, obj):
        return InvoiceAppendixRowSerializer(self._breakdown(obj), many=True).data

    @extend_schema_field(InvoiceAuditLogEntrySerializer(many=True))
    def get_audit_log(self, obj):
        logs = (
            AuditLog.objects.filter(entity_type="invoice", entity_id=str(obj.id), lab_id=obj.lab_id)
            .select_related("actor")
            .order_by("-created_at", "-id")[:20]
        )
        return [
            {
                "id": log.id,
                "action": log.action,
                "label": self.AUDIT_LABELS.get(log.action, log.action),
                "actor_name": log.actor.username if log.actor else "Systém",
                "created_at": log.created_at,
                "message": log.description,
                "metadata": log.metadata or {},
            }
            for log in logs
        ]


class InvoiceListSerializer(InvoiceSerializer):
    """Lightweight invoice representation for collection/workspace responses."""

    class Meta(InvoiceSerializer.Meta):
        fields = tuple(
            field
            for field in InvoiceSerializer.Meta.fields
            if field not in {"patient_names", "patient_summaries", "appendix_rows", "audit_log"}
        )


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = "__all__"
