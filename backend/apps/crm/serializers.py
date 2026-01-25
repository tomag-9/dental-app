from rest_framework import serializers
from .models import Clinic, Doctor, Patient

class ClinicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Clinic
        fields = '__all__'

class DoctorSerializer(serializers.ModelSerializer):
    clinic_name = serializers.ReadOnlyField(source='clinic.name', allow_null=True)

    class Meta:
        model = Doctor
        fields = '__all__'

class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = '__all__'
