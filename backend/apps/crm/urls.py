from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import ClinicViewSet, DoctorViewSet, PatientViewSet

router = DefaultRouter()
router.register(r"clinics", ClinicViewSet)
router.register(r"doctors", DoctorViewSet)
router.register(r"patients", PatientViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
