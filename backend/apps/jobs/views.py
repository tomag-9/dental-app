from rest_framework import permissions, serializers, viewsets

from .models import Job, Technician, Vacation
from .serializers import JobSerializer, TechnicianSerializer, VacationSerializer


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
        if hasattr(user, "lab") and user.lab:
            return Job.objects.filter(lab=user.lab)
        return Job.objects.none()

    def perform_create(self, serializer):
        if hasattr(self.request.user, "lab"):
            serializer.save(lab=self.request.user.lab)


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
