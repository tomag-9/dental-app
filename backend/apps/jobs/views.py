from rest_framework import viewsets, permissions
from .models import Job, Technician
from .serializers import JobSerializer, TechnicianSerializer

class TechnicianViewSet(viewsets.ModelViewSet):
    queryset = Technician.objects.all()
    serializer_class = TechnicianSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'lab') and user.lab:
             return Technician.objects.filter(lab=user.lab)
        return Technician.objects.none()

    def perform_create(self, serializer):
         if hasattr(self.request.user, 'lab'):
            serializer.save(lab=self.request.user.lab)

class JobViewSet(viewsets.ModelViewSet):
    queryset = Job.objects.all()
    serializer_class = JobSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'lab') and user.lab:
             return Job.objects.filter(lab=user.lab)
        return Job.objects.none()

    def perform_create(self, serializer):
         if hasattr(self.request.user, 'lab'):
            serializer.save(lab=self.request.user.lab)
