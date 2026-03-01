from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import LabViewSet, UserViewSet

router = DefaultRouter()
router.register(r"labs", LabViewSet)
router.register(r"users", UserViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
