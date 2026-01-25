from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import InvoiceViewSet, PriceListViewSet, SubscriptionViewSet

router = DefaultRouter()
router.register(r'invoices', InvoiceViewSet)
router.register(r'price-list', PriceListViewSet)
router.register(r'subscriptions', SubscriptionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
