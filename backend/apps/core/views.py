from rest_framework import viewsets, permissions
from .models import Lab, User
from .serializers import LabSerializer, UserSerializer

class LabViewSet(viewsets.ModelViewSet):
    queryset = Lab.objects.all()
    serializer_class = LabSerializer
    permission_classes = [permissions.IsAuthenticated]

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if user.is_superuser:
            return User.objects.all()
        # Restrict to same lab users
        if user.lab:
            return User.objects.filter(lab=user.lab)
        return User.objects.filter(id=user.id)
