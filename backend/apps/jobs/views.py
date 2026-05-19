from rest_framework import permissions, serializers, viewsets
from rest_framework.exceptions import NotFound, ValidationError

from apps.core.access import TenantScopedQuerysetMixin, is_superadmin

from .models import Job, Technician, Vacation
from .serializers import JobSerializer, TechnicianSerializer, VacationSerializer


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

    def get_queryset(self):
        qs = self.get_tenant_scoped_queryset(Job.objects.all())

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
        serializer.save(lab=user.lab)


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
