import csv
from io import BytesIO, StringIO

import openpyxl
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import (
    IsReadOnlyOrAdminOrSuperadminPermission,
    TenantScopedQuerysetMixin,
    is_admin_or_superadmin,
    is_superadmin,
)
from apps.core.exports import limited_export_queryset
from apps.core.models import AuditLog
from apps.crm.models import Clinic, Patient
from apps.crm.serializers import PatientSerializer

from . import job_service
from .models import (
    CalendarEvent,
    Job,
    JobAttachment,
    Technician,
    Vacation,
)
from .serializers import (
    CalendarEventSerializer,
    JobAttachmentSerializer,
    JobSerializer,
    JobStatusTransitionSerializer,
    TechnicianSerializer,
    VacationSerializer,
)

STATUS_LABELS = job_service.STATUS_LABELS


class TechnicianViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Technician.objects.all()
    serializer_class = TechnicianSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsReadOnlyOrAdminOrSuperadminPermission,
    ]

    def get_queryset(self):
        return self.get_tenant_scoped_queryset(Technician.objects.all())

    def perform_create(self, serializer):
        self.save_with_request_lab(serializer)


class JobViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsReadOnlyOrAdminOrSuperadminPermission,
    ]
    allowed_transitions = job_service.ALLOWED_TRANSITIONS

    def get_queryset(self):
        qs = self.get_tenant_scoped_queryset(
            Job.objects.select_related("patient", "clinic", "doctor", "technician")
            .prefetch_related("items", "timeline__actor")
            .order_by("-created_at")
        )

        # Patient filtering
        patient_id = self.request.query_params.get("patient_id")
        if patient_id:
            qs = qs.filter(patient_id=patient_id)
            if not qs.exists():
                raise NotFound(f"No jobs found for patient_id: {patient_id}")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            statuses = [value.strip() for value in status_filter.split(",") if value.strip()]
            qs = qs.filter(status__in=statuses)

        priority = self.request.query_params.get("priority")
        if priority:
            qs = qs.filter(priority=priority)

        from_date = self.request.query_params.get("from_date")
        if from_date:
            parsed = parse_date(from_date)
            if parsed:
                qs = qs.filter(due_date__gte=parsed)

        to_date = self.request.query_params.get("to_date")
        if to_date:
            parsed = parse_date(to_date)
            if parsed:
                qs = qs.filter(due_date__lte=parsed)

        technician_id = self.request.query_params.get("technician_id")
        if technician_id:
            try:
                qs = qs.filter(technician_id=int(technician_id))
            except (ValueError, TypeError):
                pass

        search = (self.request.query_params.get("search") or self.request.query_params.get("q") or "").strip()
        if search:
            search_filter = (
                Q(description__icontains=search)
                | Q(status__icontains=search)
                | Q(patient__first_name__icontains=search)
                | Q(patient__last_name__icontains=search)
                | Q(clinic__name__icontains=search)
                | Q(doctor__first_name__icontains=search)
                | Q(doctor__last_name__icontains=search)
                | Q(technician__first_name__icontains=search)
                | Q(technician__last_name__icontains=search)
            )
            if search.isdigit():
                search_filter |= Q(id=int(search))
            qs = qs.filter(search_filter)

        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if is_superadmin(user):
            lab = self._get_lab_from_request_data()
        elif not hasattr(user, "lab") or not user.lab:
            raise ValidationError("User is not assigned to any lab")
        else:
            lab = user.lab
        job_service.create_job(user, serializer, lab)

    def perform_update(self, serializer):
        job_service.update_job(self.request.user, serializer)

    def destroy(self, request, *args, **kwargs):
        job = self.get_object()
        job_service.delete_job(job)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="bulk-update")
    def bulk_update(self, request):
        """
        Update status and/or priority for multiple jobs at once.
        Body: {"job_ids": [1, 2, 3], "status": "in_progress"} (status optional)
              {"job_ids": [1, 2], "priority": "high"} (priority optional)
        Invalid transitions are skipped and reported; valid ones are applied atomically.
        """
        job_ids = request.data.get("job_ids", [])
        new_status = request.data.get("status")
        new_priority = request.data.get("priority")

        if not isinstance(job_ids, list) or not job_ids:
            return Response(
                {"detail": "job_ids must be a non-empty list."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not new_status and not new_priority:
            return Response(
                {"detail": "Provide at least one of: status, priority."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        qs = self.get_queryset().filter(id__in=job_ids)
        updated = []
        skipped = []

        with transaction.atomic():
            for job in qs:
                skip_reason = None
                if new_status:
                    if new_status == job.status:
                        pass
                    elif new_status not in self.allowed_transitions.get(job.status, set()):
                        skip_reason = f"Invalid transition {job.status}→{new_status}"
                if skip_reason:
                    skipped.append({"id": job.id, "reason": skip_reason})
                    continue

                old_status = job.status
                update_fields = ["updated_at"]
                if new_status and new_status != job.status:
                    job.status = new_status
                    update_fields.append("status")
                if new_priority:
                    job.priority = new_priority
                    update_fields.append("priority")
                job.save(update_fields=update_fields)

                actor = request.user if request.user.is_authenticated else None
                if new_status and old_status != job.status:
                    job_service.record_job_timeline(
                        job,
                        actor,
                        "status_changed",
                        note="Hromadná zmena stavu.",
                        from_status=old_status,
                        to_status=job.status,
                    )
                elif new_priority:
                    job_service.record_job_timeline(job, actor, "updated", note="Hromadná zmena priority.")
                    AuditLog.objects.create(
                        actor=actor,
                        lab=job.lab,
                        action="job.bulk_priority_changed",
                        entity_type="job",
                        entity_id=str(job.id),
                        description=f"Job #{job.id} priority changed in bulk",
                        metadata={"priority": new_priority},
                    )

                updated.append(job.id)

        return Response(
            {"updated": updated, "skipped": skipped, "updated_count": len(updated)},
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="transition-status")
    def transition_status(self, request, pk=None):
        job = self.get_object()
        serializer = JobStatusTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        note = serializer.validated_data.get("note")
        job = job_service.transition_job_status(request.user, job, new_status, note)
        return Response(self.get_serializer(job).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"], url_path="work_order")
    def work_order(self, request, pk=None):
        job = self.get_object()

        def _name(obj, fields=("first_name", "last_name")):
            if not obj:
                return None
            return " ".join(filter(None, (getattr(obj, f, "") for f in fields))).strip() or None

        items = [
            {
                "price_list_code": item.price_list_code,
                "description": item.description,
                "tooth": item.tooth,
                "tooth_scope": item.tooth_scope,
                "quantity": item.quantity,
                "unit_price": str(item.unit_price),
                "total": str(item.total),
                "procedure_category": item.procedure_category,
                "material": item.material,
                "color": item.color,
                "bridge_span": item.bridge_span,
            }
            for item in job.items.all()
        ]

        doctor = job.doctor
        doctor_name = None
        if doctor:
            parts = [
                doctor.title_before or "",
                _name(doctor),
                doctor.title_after or "",
            ]
            doctor_name = " ".join(p for p in parts if p).strip() or None

        data = {
            "id": job.id,
            "number": f"WO-{job.id:05d}",
            "status": job.status,
            "priority": job.priority,
            "description": job.description,
            "tooth_color": job.tooth_color,
            "due_date": job.due_date,
            "start_date": job.start_date,
            "end_date": job.end_date,
            "try_in_date": job.try_in_date,
            "created_at": job.created_at,
            "patient": (
                {
                    "id": job.patient_id,
                    "name": _name(job.patient),
                    "birth_number": getattr(job.patient, "birth_number", None),
                }
                if job.patient
                else None
            ),
            "clinic": (
                {
                    "id": job.clinic_id,
                    "name": getattr(job.clinic, "name", None),
                }
                if job.clinic
                else None
            ),
            "doctor": (
                {
                    "id": job.doctor_id,
                    "name": doctor_name,
                }
                if job.doctor
                else None
            ),
            "technician": (
                {
                    "id": job.technician_id,
                    "name": _name(job.technician),
                }
                if job.technician
                else None
            ),
            "lab": {
                "name": job.lab.name,
                "address": job.lab.address,
                "phone": job.lab.phone,
                "email": job.lab.email,
            },
            "items": items,
        }
        return Response(data)

    @action(detail=False, methods=["post"], url_path="quick-create")
    @transaction.atomic
    def quick_create(self, request):
        """
        Atomically create a patient (if needed) and a job in one request.

        Expected payload:
          {
            "patient": {"first_name": "...", "last_name": "...", "birth_number": "...", ...},
            "clinic_id": <int>,           # required
            "job": {"description": "...", "due_date": "...", ...}
          }
        Patient is matched by birth_number if provided and already exists; otherwise created.
        """
        user = request.user
        if not is_superadmin(user) and not getattr(user, "lab_id", None):
            return Response({"detail": "No lab associated"}, status=status.HTTP_403_FORBIDDEN)
        if not is_admin_or_superadmin(user):
            return Response(
                {"detail": "Only admin or superadmin can create patients and jobs."},
                status=status.HTTP_403_FORBIDDEN,
            )
        lab = user.lab if not is_superadmin(user) else None

        clinic_id = request.data.get("clinic_id")
        if not clinic_id:
            return Response({"detail": "clinic_id is required"}, status=status.HTTP_400_BAD_REQUEST)
        clinic_qs = Clinic.objects.filter(id=clinic_id)
        if lab:
            clinic_qs = clinic_qs.filter(lab=lab)
        clinic = clinic_qs.first()
        if not clinic:
            return Response(
                {"detail": "Clinic not found or out of scope"},
                status=status.HTTP_404_NOT_FOUND,
            )
        if lab is None:
            lab = clinic.lab

        patient_data = request.data.get("patient")
        if not patient_data:
            return Response(
                {"detail": "patient data is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        birth_number = patient_data.get("birth_number", "").strip()
        patient = None
        if birth_number:
            patient = Patient.objects.filter(lab=lab, birth_number=birth_number).first()

        if patient is None:
            pat_ser = PatientSerializer(data={**patient_data, "lab": lab.id})
            pat_ser.is_valid(raise_exception=True)
            patient = pat_ser.save(lab=lab)

        job_data = request.data.get("job") or {}
        job_ser = self.get_serializer(
            data={
                "patient": patient.id,
                "clinic": clinic.id,
                **{k: v for k, v in job_data.items() if k not in ("patient", "clinic", "lab")},
            }
        )
        job_ser.is_valid(raise_exception=True)
        job = job_ser.save(lab=lab, patient=patient, clinic=clinic)
        actor = request.user if request.user.is_authenticated else None
        job_service.record_job_timeline(job, actor, "created", note="Práca bola vytvorená (quick-create).")

        return Response(
            {
                "patient": {
                    "id": patient.id,
                    "first_name": patient.first_name,
                    "last_name": patient.last_name,
                },
                "job": self.get_serializer(job).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="status-config")
    def status_config(self, request):
        status_order = [
            "new",
            "in_progress",
            "completed",
            "finished_unfactured",
            "finished_factured",
            "cancelled",
            "closed",
        ]

        def transitions(status_name):
            allowed = self.allowed_transitions.get(status_name, set())
            return [status for status in status_order if status in allowed]

        config = {
            "new": {
                "label": "Nová",
                "label_en": "New",
                "color": "blue",
                "allowed_transitions": transitions("new"),
            },
            "in_progress": {
                "label": "V procese",
                "label_en": "In Progress",
                "color": "yellow",
                "allowed_transitions": transitions("in_progress"),
            },
            "completed": {
                "label": "Dokončená",
                "label_en": "Completed",
                "color": "green",
                "allowed_transitions": transitions("completed"),
            },
            "cancelled": {
                "label": "Zrušená",
                "label_en": "Cancelled",
                "color": "red",
                "allowed_transitions": transitions("cancelled"),
            },
            "finished_factured": {
                "label": "Vyfakturovaná",
                "label_en": "Invoiced",
                "color": "purple",
                "allowed_transitions": transitions("finished_factured"),
            },
            "finished_unfactured": {
                "label": "Ukončená – nevyfakturovaná",
                "label_en": "Closed – Not Invoiced",
                "color": "gray",
                "allowed_transitions": transitions("finished_unfactured"),
            },
            "closed": {
                "label": "Uzavretá",
                "label_en": "Closed",
                "color": "slate",
                "allowed_transitions": transitions("closed"),
            },
        }
        return Response(config)

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        qs = self.get_queryset().select_related("patient", "clinic", "doctor", "technician")

        header = [
            "id",
            "status",
            "patient",
            "clinic",
            "doctor",
            "technician",
            "due_date",
            "priority",
            "price",
            "created_at",
        ]
        rows = []
        for job in limited_export_queryset(qs, "jobs"):
            patient = f"{job.patient.first_name} {job.patient.last_name}".strip() if job.patient else ""
            clinic = job.clinic.name if job.clinic else ""
            doctor = f"{job.doctor.first_name} {job.doctor.last_name}".strip() if job.doctor else ""
            technician = f"{job.technician.first_name} {job.technician.last_name}".strip() if job.technician else ""
            rows.append(
                [
                    job.id,
                    job.status,
                    patient,
                    clinic,
                    doctor,
                    technician,
                    str(job.due_date) if job.due_date else "",
                    job.priority or "",
                    str(job.price) if job.price is not None else "",
                    job.created_at.strftime("%Y-%m-%d"),
                ]
            )

        if request.query_params.get("export_format") == "xlsx":
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Práce"
            ws.append(header)
            for row in rows:
                ws.append(row)
            buf = BytesIO()
            wb.save(buf)
            buf.seek(0)
            response = HttpResponse(
                buf.read(),
                content_type=("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            )
            response["Content-Disposition"] = 'attachment; filename="jobs.xlsx"'
            return response

        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)
        response = HttpResponse(buf.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="jobs.csv"'
        return response

    @action(detail=True, methods=["get", "post"], url_path="attachments")
    def attachments(self, request, pk=None):
        job = self.get_object()
        if request.method == "GET":
            qs = JobAttachment.objects.filter(job=job)
            serializer = JobAttachmentSerializer(qs, many=True, context={"request": request})
            return Response(serializer.data)
        serializer = JobAttachmentSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        serializer.save(job=job, uploaded_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class VacationViewSet(viewsets.ModelViewSet):
    queryset = Vacation.objects.all()
    serializer_class = VacationSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsReadOnlyOrAdminOrSuperadminPermission,
    ]

    def get_queryset(self):
        user = self.request.user
        # Match legacy behavior: superadmins can view all vacations.
        if is_superadmin(user):
            return Vacation.objects.all()
        if hasattr(user, "lab") and user.lab:
            return Vacation.objects.filter(lab=user.lab)
        return Vacation.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if is_superadmin(user):
            serializer.save()
            return
        if not (hasattr(user, "lab") and user.lab):
            raise serializers.ValidationError("User is not assigned to a lab")
        serializer.save(lab=user.lab)


class CalendarEventViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = CalendarEvent.objects.all()
    serializer_class = CalendarEventSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsReadOnlyOrAdminOrSuperadminPermission,
    ]

    def get_queryset(self):
        return self.get_tenant_scoped_queryset(
            CalendarEvent.objects.select_related("related_job").order_by("start", "id")
        )

    def _validate_related_job_scope(self, serializer):
        related_job = serializer.validated_data.get("related_job")
        if not related_job or is_superadmin(self.request.user):
            return
        if related_job.lab_id != getattr(self.request.user, "lab_id", None):
            raise ValidationError("Related job must belong to your lab")

    def perform_create(self, serializer):
        self._validate_related_job_scope(serializer)
        self.save_with_request_lab(serializer)

    def perform_update(self, serializer):
        self._validate_related_job_scope(serializer)
        serializer.save()


def _calendar_window(request):
    today = timezone.localdate()
    start_date = parse_date(request.query_params.get("start", "")) or today
    end_date = parse_date(request.query_params.get("end", "")) or (start_date + timezone.timedelta(days=30))
    if end_date < start_date:
        raise ValidationError("end must be on or after start")
    return start_date, end_date


class CalendarView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _tenant_filter(self, model):
        user = self.request.user
        if is_superadmin(user):
            return model.objects.all()
        lab_id = getattr(user, "lab_id", None)
        if lab_id:
            return model.objects.filter(lab_id=lab_id)
        return model.objects.none()

    def get(self, request):
        start_date, end_date = _calendar_window(request)

        events = []
        jobs = (
            self._tenant_filter(Job)
            .select_related("patient", "clinic")
            .filter(due_date__gte=start_date, due_date__lte=end_date)
            .exclude(status__in=("cancelled", "closed"))
        )
        for job in jobs:
            patient_name = f"{job.patient.first_name} {job.patient.last_name}".strip() if job.patient_id else ""
            events.append(
                {
                    "id": f"job:{job.id}",
                    "source": "job",
                    "type": "deadline",
                    "title": f"Job #{job.id} - {patient_name}".strip(),
                    "start": job.due_date.isoformat(),
                    "end": job.due_date.isoformat(),
                    "status": job.status,
                    "job_id": job.id,
                    "clinic_name": job.clinic.name if job.clinic_id else "",
                }
            )

        vacations = self._tenant_filter(Vacation).filter(
            start__date__lte=end_date,
            end__date__gte=start_date,
        )
        for vacation in vacations:
            events.append(
                {
                    "id": f"vacation:{vacation.id}",
                    "source": "vacation",
                    "type": "vacation",
                    "title": vacation.description or "Vacation",
                    "start": vacation.start.isoformat(),
                    "end": vacation.end.isoformat(),
                    "status": None,
                    "job_id": None,
                    "clinic_name": "",
                }
            )

        calendar_events = self._tenant_filter(CalendarEvent).filter(
            Q(end__isnull=True, start__date__gte=start_date, start__date__lte=end_date)
            | Q(end__isnull=False, start__date__lte=end_date, end__date__gte=start_date)
        )
        for event in calendar_events:
            events.append(
                {
                    "id": f"event:{event.id}",
                    "source": "calendar_event",
                    "type": event.event_type,
                    "title": event.title,
                    "start": event.start.isoformat(),
                    "end": event.end.isoformat() if event.end else None,
                    "status": None,
                    "job_id": event.related_job_id,
                    "clinic_name": "",
                }
            )

        return Response(
            {
                "start": start_date.isoformat(),
                "end": end_date.isoformat(),
                "events": sorted(events, key=lambda item: (item["start"], item["id"])),
            }
        )
