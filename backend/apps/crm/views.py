from decimal import Decimal

from django.db.models import Q, Sum
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.access import TenantScopedQuerysetMixin
from apps.jobs.models import Job

from .models import Clinic, Doctor, Patient
from .serializers import ClinicSerializer, DoctorSerializer, PatientSerializer


class ClinicViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Clinic.objects.all()
    serializer_class = ClinicSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = self.get_tenant_scoped_queryset(Clinic.objects.all())
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(ico__icontains=search))
        return qs

    def perform_create(self, serializer):
        self.save_with_request_lab(serializer)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["include_doctors"] = self.action == "retrieve"
        return context


class DoctorViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = self.get_tenant_scoped_queryset(Doctor.objects.all())
        clinic_id = self.request.query_params.get("clinic")
        if clinic_id:
            queryset = queryset.filter(clinic_id=clinic_id)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search)
            )
        return queryset

    def perform_create(self, serializer):
        self.save_with_request_lab(serializer)


class PatientViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = self.get_tenant_scoped_queryset(Patient.objects.all())
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(birth_number__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        self.save_with_request_lab(serializer)

    def retrieve(self, request, *args, **kwargs):
        patient = self.get_object()
        data = self.get_serializer(patient).data

        recent_jobs = Job.objects.filter(patient=patient).select_related(
            "clinic", "doctor", "technician"
        ).order_by("-created_at")[:5]
        data["recent_jobs"] = [
            {
                "id": j.id,
                "status": j.status,
                "description": j.description,
                "due_date": j.due_date,
                "clinic_name": j.clinic.name if j.clinic else None,
                "doctor_name": (
                    f"{j.doctor.first_name} {j.doctor.last_name}".strip()
                    if j.doctor else None
                ),
            }
            for j in recent_jobs
        ]

        from apps.crm.models import Doctor
        doctor_ids = (
            Job.objects.filter(patient=patient, doctor__isnull=False)
            .values_list("doctor_id", flat=True)
            .distinct()
        )
        doctors = Doctor.objects.filter(id__in=doctor_ids).select_related("clinic")
        data["attending_doctors"] = [
            {
                "id": d.id,
                "name": f"{d.first_name} {d.last_name}".strip(),
                "clinic_name": d.clinic.name if d.clinic else None,
            }
            for d in doctors
        ]

        from apps.finance.models import Invoice, InvoiceItem

        job_ids = (
            Job.objects.filter(patient=patient)
            .values_list("id", flat=True)
        )
        invoice_ids = (
            InvoiceItem.objects.filter(job_id__in=job_ids)
            .values_list("invoice_id", flat=True)
            .distinct()
        )
        revenue = (
            Invoice.objects.filter(id__in=invoice_ids, status="paid")
            .aggregate(total=Sum("total_amount"))["total"]
            or Decimal("0.00")
        )
        jobs_count = Job.objects.filter(patient=patient).count()
        avg_job_value = (
            float(revenue) / jobs_count if jobs_count > 0 else 0.0
        )

        data["revenue_stats"] = {
            "total_revenue": f"{revenue:.2f}",
            "jobs_count": jobs_count,
            "avg_job_value": f"{avg_job_value:.2f}",
        }

        return Response(data)

    @action(detail=True, methods=["get"], url_path="cumulative_tooth_map")
    def cumulative_tooth_map(self, request, pk=None):
        patient = self.get_object()
        jobs = Job.objects.filter(
            patient=patient,
            status__in=["closed", "completed"],
        ).order_by("created_at")

        tooth_map = {}
        for job in jobs:
            # Newer jobs override older values for the same tooth.
            job_map = job.output_tooth_procedures or job.input_tooth_procedures or {}
            if isinstance(job_map, dict):
                tooth_map.update(job_map)

        return Response(tooth_map)
