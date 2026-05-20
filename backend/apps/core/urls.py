from django.urls import include, path
from rest_framework.routers import DefaultRouter

# Note: Users and Labs are also exposed at root level (/api/users/, /api/labs/)
# This is kept for backward compatibility and nested access (/api/core/users/, /api/core/labs/)
from .views import (
    AuditLogViewSet,
    GlobalSearchView,
    LabViewSet,
    NotificationViewSet,
    PermissionsView,
    TeamInvitationViewSet,
    UserViewSet,
)

router = DefaultRouter()
router.register(r"labs", LabViewSet)
router.register(r"users", UserViewSet)
router.register(r"notifications", NotificationViewSet)
router.register(r"audit-logs", AuditLogViewSet)
router.register(r"team-invitations", TeamInvitationViewSet)

urlpatterns = [
    path("search/", GlobalSearchView.as_view(), name="global-search"),
    path("permissions/", PermissionsView.as_view(), name="permissions"),
    path("", include(router.urls)),
]
