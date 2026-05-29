"""
Re-export all test classes for backward compatibility.
`apps.jobs.tests.ClassName` continues to work after the split.
"""

from apps.jobs.tests.test_attachment import JobAttachmentTests
from apps.jobs.tests.test_calendar import (
    CalendarApiTests,
    CalendarEventContactFieldsTests,
)
from apps.jobs.tests.test_dental import DentalNotationTests
from apps.jobs.tests.test_job_actions import (
    JobBulkUpdateTests,
    JobDateRangeFilterTests,
    JobStatusChangeAuditLogTests,
    JobStatusNotificationTests,
)
from apps.jobs.tests.test_job_core import (
    JobStatusConfigTests,
    JobValidationApiTests,
    QuickCreateJobTests,
    WorkOrderEndpointTests,
)
from apps.jobs.tests.test_job_export import JobExportCsvTests
from apps.jobs.tests.test_technician import TechnicianApiTests
from apps.jobs.tests.test_vacation import VacationApiTests

__all__ = [
    "DentalNotationTests",
    "CalendarApiTests",
    "CalendarEventContactFieldsTests",
    "VacationApiTests",
    "JobValidationApiTests",
    "QuickCreateJobTests",
    "JobStatusConfigTests",
    "WorkOrderEndpointTests",
    "JobStatusChangeAuditLogTests",
    "JobBulkUpdateTests",
    "JobStatusNotificationTests",
    "JobDateRangeFilterTests",
    "JobExportCsvTests",
    "TechnicianApiTests",
    "JobAttachmentTests",
]
