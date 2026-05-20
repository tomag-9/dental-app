from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from apps.core.views import (
    AuditLogViewSet,
    DashboardStatsView,
    GlobalSearchView,
    LabViewSet,
    NotificationViewSet,
    PermissionsView,
    UserViewSet,
)
from apps.finance.views import InvoiceViewSet
from apps.inventory.views import WarehouseItemViewSet
from apps.jobs.views import CalendarEventViewSet, CalendarView, VacationViewSet

# Root-level router for commonly accessed endpoints
root_router = DefaultRouter()
root_router.register(r"invoices", InvoiceViewSet)
root_router.register(r"users", UserViewSet)
root_router.register(r"labs", LabViewSet)
root_router.register(r"notifications", NotificationViewSet)
root_router.register(r"audit-logs", AuditLogViewSet)
root_router.register(r"vacations", VacationViewSet)
root_router.register(r"calendar-events", CalendarEventViewSet)
root_router.register(r"warehouse", WarehouseItemViewSet)

urlpatterns = [
    path("admin/", admin.site.urls),
    # Root API endpoints
    path("api/", include(root_router.urls)),
    path("api/dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("api/search/", GlobalSearchView.as_view(), name="global-search-root"),
    path("api/permissions/", PermissionsView.as_view(), name="permissions-root"),
    path("api/calendar/", CalendarView.as_view(), name="calendar"),
    # Nested app routes
    path("api/core/", include("apps.core.urls")),
    path("api/crm/", include("apps.crm.urls")),
    path("api/jobs/", include("apps.jobs.urls")),
    path("api/finance/", include("apps.finance.urls")),
    path("api/inventory/", include("apps.inventory.urls")),
    # Auth
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    # Swagger/Schema
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
]
