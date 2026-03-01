from rest_framework import permissions, serializers, viewsets
from rest_framework.exceptions import NotFound, PermissionDenied, ValidationError

from .models import Job, Technician, Vacation
from .serializers import JobSerializer, TechnicianSerializer, VacationSerializer


def _is_superadmin(user):
    return (
        getattr(user, "is_superuser", False)
        or getattr(user, "role", None) == "superadmin"
    )


class TechnicianViewSet(viewsets.ModelViewSet):
    queryset = Technician.objects.all()
    serializer_class = TechnicianSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "lab") and user.lab:
            return Technician.objects.filter(lab=user.lab)
        return Technician.objects.none()

    def perform_create(self, serializer):
        if hasattr(self.request.user, "lab"):
            serializer.save(lab=self.request.user.lab)


class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = (
            Job.objects.all()
            if _is_superadmin(user)
            else (
                Job.objects.filter(lab=user.lab)
                if hasattr(user, "lab") and user.lab
                else Job.objects.none()
            )
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
        serializer.save(lab=user.lab)


class VacationViewSet(viewsets.ModelViewSet):
    queryset = Vacation.objects.all()
    serializer_class = VacationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Match legacy behavior: superadmins can view all vacations.
        if (
            getattr(user, "is_superuser", False)
            or getattr(user, "role", None) == "superadmin"
        ):
            return Vacation.objects.all()
        if hasattr(user, "lab") and user.lab:
            return Vacation.objects.filter(lab=user.lab)
        return Vacation.objects.none()

    def perform_create(self, serializer):
        user = self.request.user
        if (
            getattr(user, "is_superuser", False)
            or getattr(user, "role", None) == "superadmin"
        ):
            serializer.save()
            return
        if not (hasattr(user, "lab") and user.lab):
            raise serializers.ValidationError("User is not assigned to a lab")
        serializer.save(lab=user.lab)
