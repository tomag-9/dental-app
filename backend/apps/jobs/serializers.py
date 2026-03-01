from rest_framework import serializers

from apps.crm.serializers import ClinicSerializer, DoctorSerializer, PatientSerializer

from .models import Job, Technician, Vacation


class TechnicianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Technician
        fields = "__all__"


class JobSerializer(serializers.ModelSerializer):
    patient_details = PatientSerializer(source="patient", read_only=True)
    clinic_details = ClinicSerializer(source="clinic", read_only=True)
    doctor_details = DoctorSerializer(source="doctor", read_only=True)
    technician_details = TechnicianSerializer(source="technician", read_only=True)

    class Meta:
        model = Job
        fields = "__all__"


class VacationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vacation
        fields = "__all__"
