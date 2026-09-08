import csv
from decimal import Decimal
from io import BytesIO

import openpyxl
from django.db.models import Q, Sum
from django.http import HttpResponse
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.access import (
    AUTHENTICATED,
    LabActionPermissionMixin,
    TenantScopedQuerysetMixin,
    assert_lab_permission,
)
from apps.core.exports import limited_export_queryset
from apps.core.localization import format_sk_date
from apps.jobs.models import Job

from .models import Clinic, Doctor, Insurer, Patient
from .selectors import clinics_for_user, doctors_for_user, patients_for_user
from .serializers import (
    ClinicSerializer,
    DoctorSerializer,
    InsurerSerializer,
    PatientSerializer,
)

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


def _assert_crm_write(user, action):
    """Guard CRM writes/exports through the shared permission registry.

    ``action`` is one of ``clinic:write`` / ``doctor:write`` / ``patient:write``
    so that a lab can revoke (or grant) each resource independently.
    """
    assert_lab_permission(
        user,
        action,
        "CRM záznamy môže vytvárať, upravovať alebo mazať iba administrátor alebo superadministrátor.",
    )


class InsurerViewSet(viewsets.ReadOnlyModelViewSet):
    """Celoštátny číselník zdravotných poisťovní — read-only, nie je tenant-scoped."""

    queryset = Insurer.objects.all()
    serializer_class = InsurerSerializer
    permission_classes = AUTHENTICATED
    pagination_class = None

    def get_queryset(self):
        queryset = Insurer.objects.all()
        if self.request.query_params.get("include_inactive") not in ("1", "true", "True"):
            queryset = queryset.filter(is_active=True)
        return queryset.order_by("code")


class ClinicViewSet(LabActionPermissionMixin, TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    lab_permission_actions = {
        "create": "clinic:write",
        "export": "clinic:write",
    }
    lab_permission_message = (
        "CRM záznamy môže vytvárať, upravovať alebo mazať iba administrátor alebo superadministrátor."
    )
    queryset = Clinic.objects.all()
    serializer_class = ClinicSerializer
    permission_classes = AUTHENTICATED

    def get_queryset(self):
        qs = clinics_for_user(self.request.user)
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(ico__icontains=search))
        return qs

    def perform_create(self, serializer):
        _assert_crm_write(self.request.user, "clinic:write")
        self.save_with_request_lab(serializer)

    def perform_update(self, serializer):
        _assert_crm_write(self.request.user, "clinic:write")
        serializer.save()

    def perform_destroy(self, instance):
        _assert_crm_write(self.request.user, "clinic:write")
        instance.delete()

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["include_doctors"] = self.action == "retrieve"
        return context

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        header = ["ID", "Názov", "IČO", "DIČ", "Adresa", "Bankové údaje", "Vytvorené"]
        rows = [
            [
                c.id,
                c.name or "",
                c.ico or "",
                c.dic or "",
                c.address or "",
                c.bank_details or "",
                format_sk_date(c.created_at),
            ]
            for c in limited_export_queryset(self.get_queryset().order_by("name"), "clinics")
        ]
        if request.query_params.get("export_format") == "xlsx":
            return _xlsx_response(header, rows, "Kliniky", "clinics.xlsx")
        return _csv_response(header, rows, "clinics.csv")


class DoctorViewSet(LabActionPermissionMixin, TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    lab_permission_actions = {
        "create": "doctor:write",
        "export": "doctor:write",
    }
    lab_permission_message = (
        "CRM záznamy môže vytvárať, upravovať alebo mazať iba administrátor alebo superadministrátor."
    )
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer
    permission_classes = AUTHENTICATED

    def get_queryset(self):
        queryset = doctors_for_user(self.request.user)
        clinic_id = self.request.query_params.get("clinic")
        if clinic_id:
            queryset = queryset.filter(clinic_id=clinic_id)
        search = self.request.query_params.get("search", "").strip()
        if search:
            queryset = queryset.filter(Q(first_name__icontains=search) | Q(last_name__icontains=search))
        return queryset

    def perform_create(self, serializer):
        _assert_crm_write(self.request.user, "doctor:write")
        self.save_with_request_lab(serializer)

    def perform_update(self, serializer):
        _assert_crm_write(self.request.user, "doctor:write")
        serializer.save()

    def perform_destroy(self, instance):
        _assert_crm_write(self.request.user, "doctor:write")
        instance.delete()

    @action(detail=False, methods=["get"], url_path="export")
    def export_csv(self, request):
        _assert_crm_write(request.user, "doctor:write")
        header = [
            "ID",
            "Titul pred menom",
            "Meno",
            "Priezvisko",
            "Titul za menom",
            "Klinika",
            "Vytvorené",
        ]
        rows = [
            [
                d.id,
                d.title_before or "",
                d.first_name or "",
                d.last_name or "",
                d.title_after or "",
                d.clinic.name if d.clinic else "",
                format_sk_date(d.created_at),
            ]
            for d in limited_export_queryset(
                self.get_queryset().select_related("clinic").order_by("last_name", "first_name"),
                "doctors",
            )
        ]
        if request.query_params.get("export_format") == "xlsx":
            return _xlsx_response(header, rows, "Lekári", "doctors.xlsx")
        return _csv_response(header, rows, "doctors.csv")


class PatientViewSet(LabActionPermissionMixin, TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    lab_permission_actions = {
        "create": "patient:write",
        "export": "patient:write",
    }
    lab_permission_message = (
        "CRM záznamy môže vytvárať, upravovať alebo mazať iba administrátor alebo superadministrátor."
    )
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = AUTHENTICATED

    def get_queryset(self):
        qs = patients_for_user(self.request.user)
        search = self.request.query_params.get("search", "").strip()
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search) | Q(last_name__icontains=search) | Q(birth_number__icontains=search)
            )
        return qs

    def perform_create(self, serializer):
        _assert_crm_write(self.request.user, "patient:write")
        self.save_with_request_lab(serializer)

    def perform_update(self, serializer):
        _assert_crm_write(self.request.user, "patient:write")
        serializer.save()

    def perform_destroy(self, instance):
        _assert_crm_write(self.request.user, "patient:write")
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
        _assert_crm_write(request.user, "patient:write")
        header = [
            "ID",
            "Meno",
            "Priezvisko",
            "Rodné číslo",
            "Poisťovňa",
            "Adresa",
            "Telefón",
            "E-mail",
            "Vytvorené",
        ]
        rows = [
            [
                p.id,
                p.first_name or "",
                p.last_name or "",
                p.birth_number or "",
                p.insurer.code if p.insurer else "",
                p.address or "",
                p.phone or "",
                p.email or "",
                format_sk_date(p.created_at),
            ]
            for p in limited_export_queryset(
                self.get_queryset().select_related("insurer").order_by("last_name", "first_name"),
                "patients",
            )
        ]
        if request.query_params.get("export_format") == "xlsx":
            return _xlsx_response(header, rows, "Pacienti", "patients.xlsx")
        return _csv_response(header, rows, "patients.csv")
