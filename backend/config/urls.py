from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from rest_framework.routers import DefaultRouter

from apps.core.access import IsAdminOrSuperadminPermission
from apps.core.auth import MolarisTokenObtainPairView, MolarisTokenRefreshView
from apps.core.views import (
    AuditLogViewSet,
    DashboardStatsView,
    GlobalSearchView,
    HealthCheckView,
    LabViewSet,
    NotificationViewSet,
    PermissionsView,
    SystemHealthView,
    TeamInvitationViewSet,
    UserViewSet,
)
from apps.finance.views import InvoiceViewSet
from apps.inventory.views import WarehouseItemViewSet
from apps.jobs.views import CalendarEventViewSet, CalendarView, VacationViewSet

# Root-level router — flat shortcuts kept as deprecated backward-compat aliases.
# New clients should use the app-scoped /api/v1/ routes instead.
root_router = DefaultRouter()
root_router.register(r"invoices", InvoiceViewSet)
root_router.register(r"users", UserViewSet)
root_router.register(r"labs", LabViewSet)
root_router.register(r"notifications", NotificationViewSet)
root_router.register(r"audit-logs", AuditLogViewSet)
root_router.register(r"team-invitations", TeamInvitationViewSet)
root_router.register(r"vacations", VacationViewSet)
root_router.register(r"calendar-events", CalendarEventViewSet)
root_router.register(r"warehouse", WarehouseItemViewSet)

# Versioned app-scoped patterns — shared between /api/v1/ and the deprecated /api/ prefix.
# Defined once to ensure both prefixes stay in sync; adding a new app URL here
# automatically exposes it under both the canonical v1 path and the legacy path.
_versioned_patterns = [
    path("core/", include("apps.core.urls")),
    path("crm/", include("apps.crm.urls")),
    path("jobs/", include("apps.jobs.urls")),
    path("finance/", include("apps.finance.urls")),
    path("inventory/", include("apps.inventory.urls")),
    path("materials/", include("apps.materials.urls")),
    path("dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("search/", GlobalSearchView.as_view(), name="global-search"),
    path("permissions/", PermissionsView.as_view(), name="permissions"),
    path("system-health/", SystemHealthView.as_view(), name="system-health"),
    path("calendar/", CalendarView.as_view(), name="calendar"),
]

urlpatterns = [
    path("admin/", admin.site.urls),
    # ------------------------------------------------------------------
    # Auth — not versioned; used by all API versions
    # ------------------------------------------------------------------
    path("api/token/", MolarisTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", MolarisTokenRefreshView.as_view(), name="token_refresh"),
    # ------------------------------------------------------------------
    # Swagger / OpenAPI schema — not versioned
    # ------------------------------------------------------------------
    path("api/health/", HealthCheckView.as_view(), name="health"),
    path(
        "api/schema/",
        SpectacularAPIView.as_view(permission_classes=[IsAdminOrSuperadminPermission]),
        name="schema",
    ),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(
            url_name="schema",
            permission_classes=[IsAdminOrSuperadminPermission],
        ),
        name="swagger-ui",
    ),
    # ------------------------------------------------------------------
    # DEPRECATED — unversioned aliases kept for backward compatibility.
    # New clients should use /api/v1/... equivalents below.
    # ------------------------------------------------------------------
    path("api/", include(_versioned_patterns)),
    path("api/", include(root_router.urls)),
    # ------------------------------------------------------------------
    # v1 — canonical versioned routes (registered last so reverse() returns
    # /api/v1/... paths; Django builds _reverse_dict in reverse order so
    # the last-registered name wins the reverse lookup).
    # ------------------------------------------------------------------
    path("api/v1/", include(_versioned_patterns)),
]
