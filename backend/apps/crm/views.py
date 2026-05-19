from rest_framework import permissions, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.jobs.models import Job

from .models import Clinic, Doctor, Patient
from .serializers import ClinicSerializer, DoctorSerializer, PatientSerializer


class ClinicViewSet(viewsets.ModelViewSet):
    queryset = Clinic.objects.all()
    serializer_class = ClinicSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "lab") and user.lab:
            return Clinic.objects.filter(lab=user.lab)
        return Clinic.objects.none()

    def perform_create(self, serializer):
        if hasattr(self.request.user, "lab"):
            serializer.save(lab=self.request.user.lab)

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["include_doctors"] = self.action == "retrieve"
        return context


class DoctorViewSet(viewsets.ModelViewSet):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "lab") and user.lab:
            queryset = Doctor.objects.filter(lab=user.lab)
            clinic_id = self.request.query_params.get("clinic")
            if clinic_id:
                queryset = queryset.filter(clinic_id=clinic_id)
            return queryset
        return Doctor.objects.none()

    def perform_create(self, serializer):
        if hasattr(self.request.user, "lab"):
            serializer.save(lab=self.request.user.lab)


class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "lab") and user.lab:
            return Patient.objects.filter(lab=user.lab)
        return Patient.objects.none()

    def perform_create(self, serializer):
        if hasattr(self.request.user, "lab"):
            serializer.save(lab=self.request.user.lab)

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
