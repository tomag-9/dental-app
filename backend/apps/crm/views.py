from rest_framework import viewsets, permissions
from .models import Clinic, Doctor, Patient
from .serializers import ClinicSerializer, DoctorSerializer, PatientSerializer

class ClinicViewSet(viewsets.ModelViewSet):
    queryset = Clinic.objects.all()
    serializer_class = ClinicSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'lab') and user.lab:
             return Clinic.objects.filter(lab=user.lab)
        return Clinic.objects.none()
    
    def perform_create(self, serializer):
        if hasattr(self.request.user, 'lab'):
            serializer.save(lab=self.request.user.lab)

class DoctorViewSet(viewsets.ModelViewSet):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'lab') and user.lab:
             return Doctor.objects.filter(lab=user.lab)
        return Doctor.objects.none()

    def perform_create(self, serializer):
         if hasattr(self.request.user, 'lab'):
            serializer.save(lab=self.request.user.lab)

class PatientViewSet(viewsets.ModelViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'lab') and user.lab:
             return Patient.objects.filter(lab=user.lab)
        return Patient.objects.none()

    def perform_create(self, serializer):
         if hasattr(self.request.user, 'lab'):
            serializer.save(lab=self.request.user.lab)
