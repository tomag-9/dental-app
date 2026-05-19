from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.response import Response

from apps.core.access import TenantScopedQuerysetMixin, is_superadmin

from .models import Job, JobTimelineEvent, Technician, Vacation
from .serializers import (
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
