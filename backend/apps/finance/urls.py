from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    FinanceStatsView,
    InvoiceAgingView,
    InvoiceViewSet,
    PriceListViewSet,
    ProcedureCatalogView,
    StripeWebhookView,
    SubscriptionViewSet,
)

router = DefaultRouter()
router.register(r"invoices", InvoiceViewSet)
router.register(r"price-list", PriceListViewSet)
router.register(r"subscriptions", SubscriptionViewSet)

urlpatterns = [
    # Named sub-paths before the router so they aren't matched as pk.
    path("invoices/aging/", InvoiceAgingView.as_view(), name="invoice-aging"),
    path("stats/", FinanceStatsView.as_view(), name="finance-stats"),
    path("procedure-catalog/", ProcedureCatalogView.as_view(), name="procedure-catalog"),
    path("stripe/webhook/", StripeWebhookView.as_view(), name="stripe-webhook"),
    path("", include(router.urls)),
]
