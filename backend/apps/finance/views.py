from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import Invoice, PriceList, Subscription
from .serializers import InvoiceSerializer, PriceListSerializer, SubscriptionSerializer


def _is_superadmin(user):
    return bool(
        getattr(user, "is_superuser", False)
        or getattr(user, "role", None) == "superadmin"
    )


class PriceListViewSet(viewsets.ModelViewSet):
    queryset = PriceList.objects.all()
    serializer_class = PriceListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "lab") and user.lab:
            return PriceList.objects.filter(lab=user.lab)
        return PriceList.objects.none()

    def perform_create(self, serializer):
        if hasattr(self.request.user, "lab"):
            serializer.save(lab=self.request.user.lab)


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "lab") and user.lab:
            return Invoice.objects.filter(lab=user.lab)
        return Invoice.objects.none()

    def perform_create(self, serializer):
        if hasattr(self.request.user, "lab"):
            serializer.save(lab=self.request.user.lab)


class SubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _assert_superadmin(self, user):
        if not _is_superadmin(user):
            raise PermissionDenied("Superadmin only endpoint")

    def get_queryset(self):
        if _is_superadmin(self.request.user):
            return Subscription.objects.all()
        return Subscription.objects.none()

    def list(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request):
        user = request.user
        if not getattr(user, "lab_id", None):
            return Response(
                {"detail": "No lab associated with user"},
                status=status.HTTP_404_NOT_FOUND,
            )

        subscription = Subscription.objects.filter(lab_id=user.lab_id).first()
        if not subscription:
            return Response(
                {"detail": "No subscription found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(SubscriptionSerializer(subscription).data)
