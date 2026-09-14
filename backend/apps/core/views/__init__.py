"""``apps.core.views`` re-exported as a package (issue #120).

The original ``views.py`` grew to 2000+ lines and 20 unrelated classes. It is
split into topic modules below; everything that used to be importable from
``apps.core.views`` (``from apps.core.views import X`` or
``apps.core.views.X``) stays importable from here, unchanged, so
``apps/core/urls.py``, ``config/urls.py`` and the test suite need no changes.

``connection`` is re-exported too: ``apps.core.tests.test_observability``
patches ``apps.core.views.connection.cursor`` — the patch target must resolve
through this package.
"""

from django.db import connection  # noqa: F401 - re-exported; see module docstring

from ._shared import IMPERSONATION_TOKEN_LIFETIME, _client_ip, _write_audit_log
from .api_keys import LabApiKeyViewSet
from .audit import AuditLogViewSet
from .auth_views import CsrfView, LogoutView, SessionLoginView
from .dashboard import DashboardChartDataView, DashboardStatsView
from .health import HealthCheckResponseSerializer, HealthCheckView, SystemHealthView
from .labs import LabViewSet
from .notifications import NotificationViewSet
from .permissions import (
    LabRolePermissionViewSet,
    PermissionsMatrixView,
    PermissionsView,
    _role_permission_payload,
)
from .search import GlobalSearchView, _matches_query, _static_search_results
from .sessions import SessionViewSet
from .superadmin import BILLING_SUBSCRIPTION_STATUSES, SuperadminMetricsView
from .two_factor import TwoFactorView
from .users import (
    SUBSCRIPTION_TRIAL_DAYS,
    TeamInvitationViewSet,
    UserViewSet,
    _assert_seat_available,
    _build_unique_username,
    _send_invitation_email,
    _send_welcome_email,
    logger,  # noqa: F401 - kept importable, matches old module-level `logger`
)

__all__ = [
    "AuditLogViewSet",
    "BILLING_SUBSCRIPTION_STATUSES",
    "CsrfView",
    "DashboardChartDataView",
    "DashboardStatsView",
    "GlobalSearchView",
    "HealthCheckResponseSerializer",
    "HealthCheckView",
    "IMPERSONATION_TOKEN_LIFETIME",
    "LabApiKeyViewSet",
    "LabRolePermissionViewSet",
    "LabViewSet",
    "LogoutView",
    "NotificationViewSet",
    "PermissionsMatrixView",
    "PermissionsView",
    "SessionLoginView",
    "SessionViewSet",
    "SUBSCRIPTION_TRIAL_DAYS",
    "SuperadminMetricsView",
    "SystemHealthView",
    "TeamInvitationViewSet",
    "TwoFactorView",
    "UserViewSet",
    "_assert_seat_available",
    "_build_unique_username",
    "_client_ip",
    "_matches_query",
    "_role_permission_payload",
    "_send_invitation_email",
    "_send_welcome_email",
    "_static_search_results",
    "_write_audit_log",
    "connection",
    "logger",
]
