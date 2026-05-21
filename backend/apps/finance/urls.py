from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    FinanceStatsView,
    InvoiceViewSet,
    ProcedureCatalogView,
    PriceListViewSet,
    SubscriptionViewSet,
)

router = DefaultRouter()
router.register(r"invoices", InvoiceViewSet)
router.register(r"price-list", PriceListViewSet)
router.register(r"subscriptions", SubscriptionViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("stats/", FinanceStatsView.as_view(), name="finance-stats"),
    path("procedure-catalog/", ProcedureCatalogView.as_view(), name="procedure-catalog"),
]
