from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import JobViewSet, TechnicianViewSet

router = DefaultRouter()
router.register(r'jobs', JobViewSet)
router.register(r'technicians', TechnicianViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
