from rest_framework import serializers

from .models import Invoice, InvoiceItem, PriceList, Subscription


class PriceListSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceList
        fields = "__all__"
        read_only_fields = ["lab"]

    def validate(self, attrs):
        request = self.context.get("request")
        lab = getattr(getattr(request, "user", None), "lab", None) or getattr(
            self.instance, "lab", None
        )
        code = attrs.get("code", getattr(self.instance, "code", None))
        if lab and code:
            qs = PriceList.objects.filter(lab=lab, code=code)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"code": "Price-list code already exists for this lab."}
                )
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


class InvoiceStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=("draft", "issued", "paid", "cancelled"))


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)
    clinic_name = serializers.CharField(source="clinic.name", read_only=True)
    patient_names = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = (
            "id",
            "number",
            "lab",
            "clinic",
            "clinic_name",
            "status",
            "total_amount",
            "created_at",
            "issued_at",
            "paid_at",
            "due_date",
            "items",
            "patient_names",
        )

    def get_patient_names(self, obj):
        patient_names = set()
        for item in obj.items.select_related("job__patient").all():
            patient = getattr(getattr(item, "job", None), "patient", None)
            if patient:
                patient_names.add(f"{patient.first_name} {patient.last_name}")
        return sorted(patient_names)


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = "__all__"
