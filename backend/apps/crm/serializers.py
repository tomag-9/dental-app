import re

from django.db.models import Sum
from django.utils import timezone
from rest_framework import serializers

from .models import Clinic, Doctor, Patient


def _age_from_birth_number(birth_number):
    """Return age in years from a Slovak rodné číslo, or None if unparseable."""
    try:
        digits = birth_number.replace('/', '').strip()
        if not re.fullmatch(r'\d{9,10}', digits):
            return None
        yy = int(digits[0:2])
        mm = int(digits[2:4])
        dd = int(digits[4:6])
        if mm > 50:
            mm -= 50
        if not (1 <= mm <= 12) or not (1 <= dd <= 31):
            return None
        today = timezone.localdate()
        # Determine full year: YY >= 54 → 19YY, YY < 54 → 20YY (post-1954 rule)
        full_year = (1900 + yy) if yy >= 54 else (2000 + yy)
        age = today.year - full_year
        if (today.month, today.day) < (mm, dd):
            age -= 1
        return max(age, 0)
    except (ValueError, TypeError):
        return None


def _validate_birth_number(value):
    digits = value.replace('/', '').strip()
    if not re.fullmatch(r'\d{9,10}', digits):
        raise serializers.ValidationError(
            'Rodné číslo musí obsahovať 9 alebo 10 číslic (napr. 900101/1234).'
        )
    mm = int(digits[2:4])
    dd = int(digits[4:6])
    if mm > 50:
        mm -= 50
    if not (1 <= mm <= 12):
        raise serializers.ValidationError('Rodné číslo obsahuje neplatný mesiac.')
    if not (1 <= dd <= 31):
        raise serializers.ValidationError('Rodné číslo obsahuje neplatný deň.')


def _validate_ico(value):
    if not value:
        return
    digits = value.strip()
    if not re.fullmatch(r'\d{8}', digits):
        raise serializers.ValidationError('IČO musí mať presne 8 číslic.')
    weights = [8, 7, 6, 5, 4, 3, 2]
    total = sum(int(digits[i]) * weights[i] for i in range(7))
    remainder = total % 11
    check = int(digits[7])
    if remainder == 0:
        if check != 0:
            raise serializers.ValidationError('IČO má neplatný kontrolný súčet.')
    elif remainder > 1 and check != 11 - remainder:
        raise serializers.ValidationError('IČO má neplatný kontrolný súčet.')


def _validate_dic(value):
    if not value:
        return
    stripped = value.strip().upper()
    if re.fullmatch(r'\d{8,10}', stripped):
        return
    if re.fullmatch(r'SK\d{10}', stripped):
        return
    raise serializers.ValidationError(
        'DIČ musí byť vo formáte 10 číslic alebo SK0000000000.'
    )

ACTIVE_JOB_STATUSES = ("new", "in_progress")


def _year_start():
    today = timezone.localdate()
    return today.replace(month=1, day=1)


def _paid_invoice_revenue_for_jobs(jobs):
    from apps.finance.models import InvoiceItem

    job_ids = jobs.values_list("id", flat=True)
    total = (
        InvoiceItem.objects.filter(
            job_id__in=job_ids,
            invoice__status="paid",
            invoice__paid_at__date__gte=_year_start(),
        ).aggregate(total=Sum("line_total"))["total"]
        or 0
    )
    return f"{total:.2f}"


class ClinicSerializer(serializers.ModelSerializer):
    email = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    street = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    city = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    zip_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    doctor_count = serializers.IntegerField(source="doctors.count", read_only=True)
    doctors = serializers.SerializerMethodField(read_only=True)
    jobs_count = serializers.SerializerMethodField()
    active_jobs = serializers.SerializerMethodField()
    ytd_revenue = serializers.SerializerMethodField()

    class Meta:
        model = Clinic
        fields = [
            "id",
            "lab",
            "name",
            "ico",
            "dic",
            "address",
            "bank_details",
            "contact_info",
            "created_at",
            "email",
            "phone",
            "street",
            "city",
            "zip_code",
            "doctor_count",
            "doctors",
            "jobs_count",
            "active_jobs",
            "ytd_revenue",
        ]
        read_only_fields = [
            "lab",
            "created_at",
            "doctor_count",
            "doctors",
            "jobs_count",
            "active_jobs",
            "ytd_revenue",
        ]

    def _merge_contact_fields(self, validated_data):
        contact_info = dict(validated_data.get("contact_info") or {})
        for field in ["email", "phone", "street", "city", "zip_code"]:
            value = validated_data.pop(field, None)
            if value is not None:
                contact_info[field] = value

        if contact_info:
            validated_data["contact_info"] = contact_info

        if "address" not in validated_data:
            parts = [
                (contact_info.get("street") or "").strip(),
                " ".join(
                    p
                    for p in [
                        (contact_info.get("zip_code") or "").strip(),
                        (contact_info.get("city") or "").strip(),
                    ]
                    if p
                ).strip(),
            ]
            address = ", ".join(p for p in parts if p)
            if address:
                validated_data["address"] = address

        return validated_data

    def validate_ico(self, value):
        if value:
            _validate_ico(value)
        return value

    def validate_dic(self, value):
        if value:
            _validate_dic(value)
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        lab = getattr(getattr(request, "user", None), "lab", None) or getattr(
            self.instance, "lab", None
        )
        ico = attrs.get("ico", getattr(self.instance, "ico", None))
        if lab and ico:
            qs = Clinic.objects.filter(lab=lab, ico=ico)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {"ico": "Clinic IČO already exists for this lab."}
                )
        return attrs

    def create(self, validated_data):
        validated_data = self._merge_contact_fields(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._merge_contact_fields(validated_data)
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        contact_info = data.get("contact_info") or {}
        for field in ["email", "phone", "street", "city", "zip_code"]:
            if data.get(field) in [None, ""]:
                data[field] = contact_info.get(field) or ""
        return data

    def get_doctors(self, obj):
        if not self.context.get("include_doctors", False):
            return []
        return [
            {
                "id": doctor.id,
                "first_name": doctor.first_name,
                "last_name": doctor.last_name,
                "email": (doctor.contact_info or {}).get("email", ""),
                "phone": (doctor.contact_info or {}).get("phone", ""),
            }
            for doctor in obj.doctors.order_by("last_name", "first_name")
        ]

    def get_jobs_count(self, obj):
        return obj.jobs.count()

    def get_active_jobs(self, obj):
        return obj.jobs.filter(status__in=ACTIVE_JOB_STATUSES).count()

    def get_ytd_revenue(self, obj):
        return _paid_invoice_revenue_for_jobs(obj.jobs.all())


class DoctorSerializer(serializers.ModelSerializer):
    clinic_name = serializers.ReadOnlyField(source="clinic.name", allow_null=True)
    email = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    jobs_count = serializers.SerializerMethodField()
    active_jobs = serializers.SerializerMethodField()
    ytd_revenue = serializers.SerializerMethodField()

    class Meta:
        model = Doctor
        fields = [
            "id",
            "lab",
            "clinic",
            "clinic_name",
            "first_name",
            "last_name",
            "title_before",
            "title_after",
            "contact_info",
            "created_at",
            "email",
            "phone",
            "jobs_count",
            "active_jobs",
            "ytd_revenue",
        ]
        read_only_fields = [
            "lab",
            "created_at",
            "jobs_count",
            "active_jobs",
            "ytd_revenue",
        ]

    def validate_clinic(self, clinic):
        request = self.context.get("request")
        if not clinic or not request or not getattr(request.user, "lab", None):
            return clinic
        if clinic.lab_id != request.user.lab_id:
            raise serializers.ValidationError("Klinika nepatrí do vášho laboratória.")
        return clinic

    def _merge_contact_fields(self, validated_data):
        contact_info = dict(validated_data.get("contact_info") or {})
        for field in ["email", "phone"]:
            value = validated_data.pop(field, None)
            if value is not None:
                contact_info[field] = value
        if contact_info:
            validated_data["contact_info"] = contact_info
        return validated_data

    def create(self, validated_data):
        validated_data = self._merge_contact_fields(validated_data)
        return super().create(validated_data)

    def update(self, instance, validated_data):
        validated_data = self._merge_contact_fields(validated_data)
        return super().update(instance, validated_data)

    def to_representation(self, instance):
        data = super().to_representation(instance)
        contact_info = data.get("contact_info") or {}
        data["email"] = data.get("email") or contact_info.get("email") or ""
        data["phone"] = data.get("phone") or contact_info.get("phone") or ""
        return data

    def get_jobs_count(self, obj):
        return obj.jobs.count()

    def get_active_jobs(self, obj):
        return obj.jobs.filter(status__in=ACTIVE_JOB_STATUSES).count()

    def get_ytd_revenue(self, obj):
        return _paid_invoice_revenue_for_jobs(obj.jobs.all())


class PatientSerializer(serializers.ModelSerializer):
    jobs_count = serializers.SerializerMethodField()
    active_jobs = serializers.SerializerMethodField()
    ytd_revenue = serializers.SerializerMethodField()
    age = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            "id", "lab", "first_name", "last_name", "birth_number",
            "address", "phone", "email", "tooth_procedures", "created_at",
            "jobs_count", "active_jobs", "ytd_revenue", "age",
        ]
        read_only_fields = ["lab", "jobs_count", "active_jobs", "ytd_revenue", "age"]

    def validate_birth_number(self, value):
        if value:
            _validate_birth_number(value)
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        lab = getattr(getattr(request, "user", None), "lab", None) or getattr(
            self.instance, "lab", None
        )
        birth_number = attrs.get(
            "birth_number", getattr(self.instance, "birth_number", None)
        )
        if lab and birth_number:
            qs = Patient.objects.filter(lab=lab, birth_number=birth_number)
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    {
                        "birth_number": (
                            "Patient birth number already exists for this lab."
                        )
                    }
                )
        return attrs

    def get_jobs_count(self, obj):
        return obj.jobs.count()

    def get_active_jobs(self, obj):
        return obj.jobs.filter(status__in=ACTIVE_JOB_STATUSES).count()

    def get_ytd_revenue(self, obj):
        return _paid_invoice_revenue_for_jobs(obj.jobs.all())

    def get_age(self, obj):
        return _age_from_birth_number(obj.birth_number)
