from rest_framework import viewsets, permissions
from .models import Invoice, PriceList, Subscription
from .serializers import InvoiceSerializer, PriceListSerializer, SubscriptionSerializer

class PriceListViewSet(viewsets.ModelViewSet):
    queryset = PriceList.objects.all()
    serializer_class = PriceListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'lab') and user.lab:
             return PriceList.objects.filter(lab=user.lab)
        return PriceList.objects.none()

    def perform_create(self, serializer):
         if hasattr(self.request.user, 'lab'):
            serializer.save(lab=self.request.user.lab)

class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, 'lab') and user.lab:
             return Invoice.objects.filter(lab=user.lab)
        return Invoice.objects.none()

    def perform_create(self, serializer):
         if hasattr(self.request.user, 'lab'):
            serializer.save(lab=self.request.user.lab)

class SubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]
    # Usually subscriptions are managed by admins or automated, restricted edits
