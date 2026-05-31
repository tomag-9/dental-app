import csv
from decimal import Decimal
from io import BytesIO

import openpyxl
from django.db.models import Q, Sum
from django.http import HttpResponse
from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core.access import TenantScopedQuerysetMixin, is_admin_or_superadmin
from apps.core.exports import limited_export_queryset
from apps.jobs.models import Job

from .models import Clinic, Doctor, Patient
from .serializers import ClinicSerializer, DoctorSerializer, PatientSerializer

_XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def _xlsx_response(header, rows, sheet_title, filename):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = sheet_title
    ws.append(header)
    for row in rows:
        ws.append(row)
    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)
    response = HttpResponse(buf.read(), content_type=_XLSX_CONTENT_TYPE)
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


def _csv_response(header, rows, filename):
    response = HttpResponse(content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    writer = csv.writer(response)
    writer.writerow(header)
    for row in rows:
        writer.writerow(row)
    return response


def _assert_crm_write(user):
    if not is_admin_or_superadmin(user):
        raise PermissionDenied("Only admin or superadmin can create, edit or delete CRM records.")


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
        _assert_crm_write(self.request.user)
        self.save_with_request_lab(serializer)

    def perform_update(self, serializer):
        _assert_crm_write(self.request.user)
        serializer.save()

    def perform_destroy(self, instance):
        _assert_crm_write(self.request.user)
        instance.delete()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["include_doctors"] = self.action == "retrieve"
        return context

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        header = ["id", "name", "ico", "dic", "address", "bank_details", "created_at"]
        rows = [
            [
                c.id,
                c.name or "",
                c.ico or "",
                c.dic or "",
                c.address or "",
                c.bank_details or "",
                c.created_at.date().isoformat() if c.created_at else "",
            ]
            for c in limited_export_queryset(self.get_queryset().order_by("name"), "clinics")
        ]
        if request.query_params.get("export_format") == "xlsx":
            return _xlsx_response(header, rows, "Kliniky", "clinics.xlsx")
        return _csv_response(header, rows, "clinics.csv")


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
            queryset = queryset.filter(Q(first_name__icontains=search) | Q(last_name__icontains=search))
        return queryset

    def perform_create(self, serializer):
        _assert_crm_write(self.request.user)
        self.save_with_request_lab(serializer)

    def perform_update(self, serializer):
        _assert_crm_write(self.request.user)
        serializer.save()

    def perform_destroy(self, instance):
        _assert_crm_write(self.request.user)
        instance.delete()

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        _assert_crm_write(request.user)
        header = [
            "id",
            "title_before",
            "first_name",
            "last_name",
            "title_after",
            "clinic_name",
            "created_at",
        ]
        rows = [
            [
                d.id,
                d.title_before or "",
                d.first_name or "",
                d.last_name or "",
                d.title_after or "",
                d.clinic.name if d.clinic else "",
                d.created_at.date().isoformat() if d.created_at else "",
            ]
            for d in limited_export_queryset(
                self.get_queryset().select_related("clinic").order_by("last_name", "first_name"),
                "doctors",
            )
        ]
        if request.query_params.get("export_format") == "xlsx":
            return _xlsx_response(header, rows, "Lekári", "doctors.xlsx")
        return _csv_response(header, rows, "doctors.csv")


class PatientViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = self.get_tenant_scoped_queryset(Patient.objects.all())
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search) | Q(birth_number__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        _assert_crm_write(self.request.user)
        self.save_with_request_lab(serializer)

    def perform_update(self, serializer):
        _assert_crm_write(self.request.user)
        serializer.save()

    def perform_destroy(self, instance):
        _assert_crm_write(self.request.user)
        instance.delete()

    def retrieve(self, request, *args, **kwargs):
        patient = self.get_object()
        data = self.get_serializer(patient).data

        recent_jobs = (
            Job.objects.filter(patient=patient)
            .select_related("clinic", "doctor", "technician")
            .order_by("-created_at")[:5]
        )
        data["recent_jobs"] = [
            {
                "id": j.id,
                "status": j.status,
                "description": j.description,
                "due_date": j.due_date,
                "clinic_name": j.clinic.name if j.clinic else None,
                "doctor_name": (f"{j.doctor.first_name} {j.doctor.last_name}".strip() if j.doctor else None),
            }
            for j in recent_jobs
        ]

        from apps.crm.models import Doctor

        doctor_ids = (
            Job.objects.filter(patient=patient, doctor__isnull=False).values_list("doctor_id", flat=True).distinct()
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

        job_ids = Job.objects.filter(patient=patient).values_list("id", flat=True)
        invoice_ids = InvoiceItem.objects.filter(job_id__in=job_ids).values_list("invoice_id", flat=True).distinct()
        revenue = Invoice.objects.filter(id__in=invoice_ids, status="paid").aggregate(total=Sum("total_amount"))[
            "total"
        ] or Decimal("0.00")
        jobs_count = Job.objects.filter(patient=patient).count()
        avg_job_value = float(revenue) / jobs_count if jobs_count > 0 else 0.0

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

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        _assert_crm_write(request.user)
        header = [
            "id",
            "first_name",
            "last_name",
            "birth_number",
            "address",
            "phone",
            "email",
            "created_at",
        ]
        rows = [
            [
                p.id,
                p.first_name or "",
                p.last_name or "",
                p.birth_number or "",
                p.address or "",
                p.phone or "",
                p.email or "",
                p.created_at.date().isoformat() if p.created_at else "",
            ]
            for p in limited_export_queryset(self.get_queryset().order_by("last_name", "first_name"), "patients")
        ]
        if request.query_params.get("export_format") == "xlsx":
            return _xlsx_response(header, rows, "Pacienti", "patients.xlsx")
        return _csv_response(header, rows, "patients.csv")
