from django.urls import include, path
from rest_framework.routers import DefaultRouter

# Note: Users and Labs are also exposed at root level (/api/users/, /api/labs/)
# This is kept for backward compatibility and nested access (/api/core/users/, /api/core/labs/)
from .views import (
    AuditLogViewSet,
    DashboardChartDataView,
    GlobalSearchView,
    LabApiKeyViewSet,
    LabViewSet,
    NotificationViewSet,
    PermissionsView,
    SessionLoginView,
    SessionViewSet,
    SuperadminMetricsView,
    SystemHealthView,
    TeamInvitationViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register(r"labs", LabViewSet)
router.register(r"users", UserViewSet)
router.register(r"notifications", NotificationViewSet)
router.register(r"audit-logs", AuditLogViewSet)
router.register(r"team-invitations", TeamInvitationViewSet)
router.register(r"sessions", SessionViewSet, basename="session")
router.register(r"api-keys", LabApiKeyViewSet, basename="api-key")

urlpatterns = [
    path("search/", GlobalSearchView.as_view(), name="global-search"),
    path("permissions/", PermissionsView.as_view(), name="permissions"),
    path("system-health/", SystemHealthView.as_view(), name="system-health"),
    path("superadmin-metrics/", SuperadminMetricsView.as_view(), name="superadmin-metrics"),
    path("auth/login/", SessionLoginView.as_view(), name="session-login"),
    path("dashboard/chart-data/", DashboardChartDataView.as_view(), name="dashboard-chart-data"),
    path("", include(router.urls)),
]
