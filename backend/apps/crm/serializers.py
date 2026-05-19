from rest_framework import serializers

from .models import Clinic, Doctor, Patient


class ClinicSerializer(serializers.ModelSerializer):
    email = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    street = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    city = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    zip_code = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    doctor_count = serializers.IntegerField(source="doctors.count", read_only=True)
    doctors = serializers.SerializerMethodField(read_only=True)

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
        ]
        read_only_fields = ["lab", "created_at", "doctor_count", "doctors"]

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


class DoctorSerializer(serializers.ModelSerializer):
    clinic_name = serializers.ReadOnlyField(source="clinic.name", allow_null=True)
    email = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    phone = serializers.CharField(required=False, allow_blank=True, allow_null=True)

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
        ]
        read_only_fields = ["lab", "created_at"]

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


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = "__all__"
        read_only_fields = ["lab"]
