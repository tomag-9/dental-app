from rest_framework import serializers

from apps.crm.models import Clinic, Doctor, Patient
from apps.crm.serializers import ClinicSerializer, DoctorSerializer, PatientSerializer
from apps.finance.models import PriceList

from .models import Job, Technician, Vacation


def _is_superadmin(user):
    return (
        getattr(user, "is_superuser", False)
        or getattr(user, "role", None) == "superadmin"
    )


class TechnicianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Technician
        fields = "__all__"
        read_only_fields = ["lab", "created_at"]


class JobSerializer(serializers.ModelSerializer):
    patient_details = PatientSerializer(source="patient", read_only=True)
    clinic_details = ClinicSerializer(source="clinic", read_only=True)
    doctor_details = DoctorSerializer(source="doctor", read_only=True)
    technician_details = TechnicianSerializer(source="technician", read_only=True)

    class Meta:
        model = Job
        fields = "__all__"
        read_only_fields = ["lab"]

    def validate_procedure_codes(self, value):
        """Validate that all procedure codes exist in the price list."""
        if not value:
            return value

        valid_codes = set(PriceList.objects.values_list("code", flat=True))
        invalid_codes = [code for code in value if code not in valid_codes]
        if invalid_codes:
            raise serializers.ValidationError(
                f"Invalid procedure codes: {invalid_codes}"
            )

        return value

    def validate(self, data):
        """Cross-field validation for jobs."""
        # Validate procedure codes and quantities match
        procedure_codes = data.get("procedure_codes")
        procedure_quantities = data.get("procedure_quantities")

        if procedure_codes and procedure_quantities:
            if len(procedure_codes) != len(set(procedure_quantities.keys())):
                raise serializers.ValidationError(
                    "Procedure codes and quantities must match"
                )

        # Get current user from context
        request = self.context.get("request")
        if not request or not request.user:
            return data

        user = request.user
        is_superadmin = _is_superadmin(user)

        # Validate entity consistency for non-superadmins
        if not is_superadmin and hasattr(user, "lab") and user.lab:
            user_lab_id = user.lab.id

            # Check all referenced entities
            patient_id = data.get("patient_id") or (
                data.get("patient").id if data.get("patient") else None
            )
            clinic_id = data.get("clinic_id") or (
                data.get("clinic").id if data.get("clinic") else None
            )
            doctor_id = data.get("doctor_id") or (
                data.get("doctor").id if data.get("doctor") else None
            )
            technician_id = data.get("technician_id") or (
                data.get("technician").id if data.get("technician") else None
            )

            # Fetch entities and validate they exist
            try:
                patient = Patient.objects.get(id=patient_id) if patient_id else None
                clinic = Clinic.objects.get(id=clinic_id) if clinic_id else None
                doctor = Doctor.objects.get(id=doctor_id) if doctor_id else None
                technician = (
                    Technician.objects.get(id=technician_id) if technician_id else None
                )
            except (
                Patient.DoesNotExist,
                Clinic.DoesNotExist,
                Doctor.DoesNotExist,
                Technician.DoesNotExist,
            ):
                raise serializers.ValidationError("Referenced entities not found")

            # Check all entities belong to user's lab
            entities = [
                e for e in [patient, clinic, doctor, technician] if e is not None
            ]
            for entity in entities:
                if hasattr(entity, "lab_id") and entity.lab_id != user_lab_id:
                    raise serializers.ValidationError(
                        "Entities must belong to the same lab"
                    )

        return data


class VacationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vacation
        fields = "__all__"
