from decimal import Decimal

from django.utils import timezone
from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from apps.core.models import AuditLog

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


class InvoiceAuditLogEntrySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    action = serializers.CharField()
    label = serializers.CharField()
    actor_name = serializers.CharField()
    created_at = serializers.DateTimeField()
    message = serializers.CharField(allow_blank=True, allow_null=True)
    metadata = serializers.DictField()


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
    patient_names = serializers.SerializerMethodField()
    subtotal_amount = serializers.SerializerMethodField()
    vat_amount = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    days_overdue = serializers.SerializerMethodField()
    related_jobs = serializers.SerializerMethodField()
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
            "status",
            "document_type",
            "vat_rate",
            "discount_percent",
            "description_mode",
            "custom_description",
            "show_patient_list",
            "total_amount",
            "subtotal_amount",
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
            "related_jobs",
            "audit_log",
        )

    def get_patient_names(self, obj):
        patient_names = set()
        for item in obj.items.select_related("job__patient").all():
            patient = getattr(getattr(item, "job", None), "patient", None)
            if patient:
                patient_names.add(f"{patient.first_name} {patient.last_name}")
        return sorted(patient_names)

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
        for item in obj.items.select_related("job__patient").order_by("job_id"):
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


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = "__all__"
