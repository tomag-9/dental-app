from django.urls import include, path
from rest_framework.routers import DefaultRouter

# Note: Users and Labs are also exposed at root level (/api/users/, /api/labs/)
# This is kept for backward compatibility and nested access (/api/core/users/, /api/core/labs/)
from .views import LabViewSet, UserViewSet

router = DefaultRouter()
router.register(r"labs", LabViewSet)
router.register(r"users", UserViewSet)

urlpatterns = [
    path("", include(router.urls)),
]
