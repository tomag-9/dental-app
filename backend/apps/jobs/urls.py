from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    CalendarEventViewSet,
    CalendarView,
    JobViewSet,
    TechnicianViewSet,
    VacationViewSet,
)

router = DefaultRouter()
router.register(r"jobs", JobViewSet)
router.register(r"technicians", TechnicianViewSet)
router.register(r"vacations", VacationViewSet)
router.register(r"calendar-events", CalendarEventViewSet)

urlpatterns = [
    path("calendar/", CalendarView.as_view(), name="jobs-calendar"),
    path("", include(router.urls)),
]
