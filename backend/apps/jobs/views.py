from django.db.models import Q
from django.utils import timezone
from django.utils.dateparse import parse_date
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import TenantScopedQuerysetMixin, is_superadmin

from .models import CalendarEvent, Job, JobTimelineEvent, Technician, Vacation
from .serializers import (
    CalendarEventSerializer,
    JobSerializer,
    JobStatusTransitionSerializer,
    TechnicianSerializer,
    VacationSerializer,
)


class TechnicianViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Technician.objects.all()
    serializer_class = TechnicianSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.get_tenant_scoped_queryset(Technician.objects.all())

    def perform_create(self, serializer):
        self.save_with_request_lab(serializer)


class JobViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated]
    allowed_transitions = {
        "new": {"in_progress", "cancelled"},
        "in_progress": {"completed", "cancelled"},
        "completed": {"finished_unfactured", "finished_factured", "closed"},
        "finished_unfactured": {"finished_factured", "closed"},
        "finished_factured": {"closed"},
        "cancelled": set(),
        "closed": set(),
    }

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
            statuses = [
                value.strip() for value in status_filter.split(",") if value.strip()
            ]
            qs = qs.filter(status__in=statuses)

        priority = self.request.query_params.get("priority")
        if priority:
            qs = qs.filter(priority=priority)

        search = (
            self.request.query_params.get("search")
            or self.request.query_params.get("q")
            or ""
        ).strip()
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
        if not hasattr(user, "lab") or not user.lab:
            raise ValidationError("User is not assigned to any lab")

        # Always assign current user's lab
        job = serializer.save(lab=user.lab)
        self._record_timeline(job, "created", note="Práca bola vytvorená.")

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        old_technician_id = serializer.instance.technician_id
        new_status = serializer.validated_data.get("status", old_status)
        if new_status != old_status:
            allowed = self.allowed_transitions.get(old_status, set())
            if new_status not in allowed:
                raise ValidationError(
                    f"Invalid status transition from {old_status} to {new_status}"
                )
        job = serializer.save()

        if old_status != job.status:
            self._record_timeline(
                job,
                "status_changed",
                note="Stav práce bol zmenený.",
                from_status=old_status,
                to_status=job.status,
            )
        elif old_technician_id != job.technician_id:
            self._record_timeline(job, "assigned", note="Technik bol zmenený.")
        else:
            self._record_timeline(job, "updated", note="Práca bola upravená.")

    def destroy(self, request, *args, **kwargs):
        job = self.get_object()
        if job.status == "closed" or job.invoice_items.exists():
            raise ValidationError("Closed or invoiced jobs cannot be deleted")
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="transition-status")
    def transition_status(self, request, pk=None):
        job = self.get_object()
        serializer = JobStatusTransitionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        if new_status == job.status:
            return Response(self.get_serializer(job).data)

        allowed = self.allowed_transitions.get(job.status, set())
        if new_status not in allowed:
            raise ValidationError(
                f"Invalid status transition from {job.status} to {new_status}"
            )

        old_status = job.status
        job.status = new_status
        job.save(update_fields=["status", "updated_at"])
        self._record_timeline(
            job,
            "status_changed",
            note=serializer.validated_data.get("note") or "Stav práce bol zmenený.",
            from_status=old_status,
            to_status=new_status,
        )
        return Response(self.get_serializer(job).data, status=status.HTTP_200_OK)

    def _record_timeline(self, job, event, note=None, from_status=None, to_status=None):
        JobTimelineEvent.objects.create(
            job=job,
            actor=self.request.user if self.request.user.is_authenticated else None,
            event=event,
            note=note,
            from_status=from_status,
            to_status=to_status,
        )


class VacationViewSet(viewsets.ModelViewSet):
    queryset = Vacation.objects.all()
    serializer_class = VacationSerializer
    permission_classes = [permissions.IsAuthenticated]

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
    permission_classes = [permissions.IsAuthenticated]

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
    end_date = parse_date(request.query_params.get("end", "")) or (
        start_date + timezone.timedelta(days=30)
    )
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
            patient_name = (
                f"{job.patient.first_name} {job.patient.last_name}".strip()
                if job.patient_id
                else ""
            )
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
