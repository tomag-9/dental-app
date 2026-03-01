from rest_framework import serializers

from .models import Clinic, Doctor, Patient


class ClinicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Clinic
        fields = "__all__"
        read_only_fields = ["lab"]


class DoctorSerializer(serializers.ModelSerializer):
    clinic_name = serializers.ReadOnlyField(source="clinic.name", allow_null=True)

    class Meta:
        model = Doctor
        fields = "__all__"
        read_only_fields = ["lab"]


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = "__all__"
        read_only_fields = ["lab"]
