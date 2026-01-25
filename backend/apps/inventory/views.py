from rest_framework import viewsets, permissions
from .models import WarehouseItem
from .serializers import WarehouseItemSerializer

class WarehouseItemViewSet(viewsets.ModelViewSet):
    queryset = WarehouseItem.objects.all()
    serializer_class = WarehouseItemSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'lab') and user.lab:
             return WarehouseItem.objects.filter(lab=user.lab)
        return WarehouseItem.objects.none()

    def perform_create(self, serializer):
         if hasattr(self.request.user, 'lab'):
            serializer.save(lab=self.request.user.lab)
