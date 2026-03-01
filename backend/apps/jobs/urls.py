from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import JobViewSet, TechnicianViewSet, VacationViewSet

router = DefaultRouter()
router.register(r"jobs", JobViewSet)
router.register(r"technicians", TechnicianViewSet)
router.register(r"vacations", VacationViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
