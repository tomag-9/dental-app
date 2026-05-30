"""
Re-export all test classes for backward compatibility.
`apps.core.tests.ClassName` continues to work after the split.
"""

from apps.core.tests.test_alias import AliasAuthenticationTests
from apps.core.tests.test_auth import (
    AuthLoginFlowTests,
    AuthThrottleTests,
    SessionEndpointsTests,
    TwoFactorTests,
)
from apps.core.tests.test_lab import (
    LabApiKeyTests,
    LabRolePermissionTests,
    LabSettingsValidationTests,
    LabSlugTests,
)
from apps.core.tests.test_misc import (
    AvatarUrlTests,
    DashboardChartDataTests,
    DashboardTodayScheduleVacationTests,
    NotificationFilterTests,
    PermissionsMatrixTests,
)
from apps.core.tests.test_role_matrix import (
    CrossDomainExportRoleMatrixTests,
    CrossDomainWriteRoleMatrixTests,
)
from apps.core.tests.test_superadmin import (
    ImpersonationTests,
    SchemaDocsPolicyTests,
    SuperadminMetricsTests,
    SystemHealthRuntimeTests,
)
from apps.core.tests.test_user_flows import CoreUserFlowsApiTests
from apps.core.tests.test_user_service import (
    UserServiceCreateTests,
    UserServiceDeleteTests,
    UserServiceUpdateTests,
)

__all__ = [
    "CoreUserFlowsApiTests",
    "UserServiceCreateTests",
    "UserServiceUpdateTests",
    "UserServiceDeleteTests",
    "SessionEndpointsTests",
    "AuthLoginFlowTests",
    "AuthThrottleTests",
    "TwoFactorTests",
    "AliasAuthenticationTests",
    "CrossDomainWriteRoleMatrixTests",
    "CrossDomainExportRoleMatrixTests",
    "LabSlugTests",
    "LabSettingsValidationTests",
    "LabApiKeyTests",
    "LabRolePermissionTests",
    "SuperadminMetricsTests",
    "ImpersonationTests",
    "SystemHealthRuntimeTests",
    "SchemaDocsPolicyTests",
    "AvatarUrlTests",
    "DashboardChartDataTests",
    "PermissionsMatrixTests",
    "NotificationFilterTests",
    "DashboardTodayScheduleVacationTests",
]
