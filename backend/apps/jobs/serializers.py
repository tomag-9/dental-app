from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.core.access import is_superadmin
from apps.crm.models import Clinic, Doctor, Patient
from apps.crm.serializers import ClinicSerializer, DoctorSerializer, PatientSerializer
from apps.finance.models import PriceList

from .dental import validate_tooth_range
from .models import CalendarEvent, Job, JobItem, JobTimelineEvent, Technician, Vacation


class TechnicianSerializer(serializers.ModelSerializer):
    jobs_count = serializers.SerializerMethodField()
    active_jobs = serializers.SerializerMethodField()
    jobs_this_month = serializers.SerializerMethodField()

    class Meta:
        model = Technician
        fields = (
            "id",
            "lab",
            "first_name",
            "last_name",
            "title_before",
            "title_after",
            "contact_info",
            "created_at",
            "jobs_count",
            "active_jobs",
            "jobs_this_month",
        )
        read_only_fields = [
            "lab",
            "created_at",
            "jobs_count",
            "active_jobs",
            "jobs_this_month",
        ]

    def get_jobs_count(self, obj):
        return obj.jobs.count()

    def get_active_jobs(self, obj):
        return obj.jobs.filter(status__in=("new", "in_progress")).count()

    def get_jobs_this_month(self, obj):
        today = timezone.localdate()
        return obj.jobs.filter(
            created_at__year=today.year,
            created_at__month=today.month,
        ).count()


class JobItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobItem
        fields = (
            "id",
            "price_list_code",
            "description",
            "tooth",
            "quantity",
            "unit_price",
            "total",
            "procedure_category",
            "created_at",
        )
        read_only_fields = ("id", "description", "unit_price", "total", "created_at")

    def validate_tooth(self, value):
        if value and not validate_tooth_range(value):
            raise serializers.ValidationError(
                "Use canonical FDI tooth notation, for example 26 or 45-47."
            )
        return value


class JobTimelineEventSerializer(serializers.ModelSerializer):
    actor_name = serializers.SerializerMethodField()

    class Meta:
        model = JobTimelineEvent
        fields = (
            "id",
            "event",
            "note",
            "from_status",
            "to_status",
            "actor",
            "actor_name",
            "created_at",
        )
        read_only_fields = fields

    def get_actor_name(self, obj):
        if not obj.actor:
            return ""
        full_name = obj.actor.get_full_name()
        return full_name or obj.actor.username


class JobSerializer(serializers.ModelSerializer):
    patient_details = PatientSerializer(source="patient", read_only=True)
    clinic_details = ClinicSerializer(source="clinic", read_only=True)
    doctor_details = DoctorSerializer(source="doctor", read_only=True)
    technician_details = TechnicianSerializer(source="technician", read_only=True)
    items = JobItemSerializer(many=True, required=False)
    timeline = JobTimelineEventSerializer(many=True, read_only=True)

    class Meta:
        model = Job
        fields = "__all__"
        read_only_fields = ["lab"]
        extra_kwargs = {
            "doctor": {"required": False, "allow_null": True},
        }

    def _price_list_queryset(self):
        request = self.context.get("request")
        user = getattr(request, "user", None)
        queryset = PriceList.objects.all()
        if user and not is_superadmin(user):
            lab_id = getattr(user, "lab_id", None)
            if not lab_id:
                raise serializers.ValidationError("User is not assigned to any lab")
            queryset = queryset.filter(lab_id=lab_id)
        return queryset

    def validate_procedure_codes(self, value):
        """Validate that all procedure codes exist in the price list."""
        if not value:
            return value

        valid_codes = set(self._price_list_queryset().values_list("code", flat=True))
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
        items = data.get("items")

        if procedure_codes and procedure_quantities:
            if len(procedure_codes) != len(set(procedure_quantities.keys())):
                raise serializers.ValidationError(
                    "Procedure codes and quantities must match"
                )
            missing_quantities = [
                code for code in procedure_codes if code not in procedure_quantities
            ]
            if missing_quantities:
                raise serializers.ValidationError(
                    "Procedure codes and quantities must match"
                )

        if items:
            valid_codes = set(
                self._price_list_queryset().values_list("code", flat=True)
            )
            invalid_codes = [
                item.get("price_list_code")
                for item in items
                if item.get("price_list_code") not in valid_codes
            ]
            if invalid_codes:
                raise serializers.ValidationError(
                    {"items": f"Invalid procedure codes: {invalid_codes}"}
                )

        # Get current user from context
        request = self.context.get("request")
        if not request or not request.user:
            return data

        user = request.user
        user_is_superadmin = is_superadmin(user)

        # Validate entity consistency for non-superadmins
        if not user_is_superadmin and hasattr(user, "lab") and user.lab:
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

    def _sync_items(self, job, items):
        if items is None:
            return

        price_items = {
            item.code: item
            for item in self._price_list_queryset().filter(
                code__in=[entry["price_list_code"] for entry in items]
            )
        }
        JobItem.objects.filter(job=job).delete()

        created_items = []
        total = Decimal("0.00")
        procedure_codes = []
        procedure_quantities = {}

        for entry in items:
            code = entry["price_list_code"]
            price_item = price_items[code]
            quantity = max(1, int(entry.get("quantity") or 1))
            job_item = JobItem(
                job=job,
                price_list_code=code,
                description=price_item.description,
                tooth=entry.get("tooth") or None,
                quantity=quantity,
                unit_price=price_item.price,
                total=Decimal("0.00"),
                procedure_category=entry.get("procedure_category") or None,
            )
            job_item.save()
            created_items.append(job_item)
            total += job_item.total
            procedure_codes.append(code)
            procedure_quantities[code] = procedure_quantities.get(code, 0) + quantity

        job.procedure_codes = procedure_codes or None
        job.procedure_quantities = procedure_quantities or None
        job.price = total if created_items else None
        job.save(update_fields=["procedure_codes", "procedure_quantities", "price"])

    def create(self, validated_data):
        items = validated_data.pop("items", None)
        job = super().create(validated_data)
        self._sync_items(job, items)
        return job

    def update(self, instance, validated_data):
        items = validated_data.pop("items", None)
        job = super().update(instance, validated_data)
        self._sync_items(job, items)
        return job


class JobStatusTransitionSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=[choice[0] for choice in Job.STATUS_CHOICES]
    )
    note = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class VacationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vacation
        fields = "__all__"


class CalendarEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = CalendarEvent
        fields = "__all__"
        read_only_fields = ["lab", "created_at"]
