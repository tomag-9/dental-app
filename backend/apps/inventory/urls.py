from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import WarehouseItemViewSet

router = DefaultRouter()
router.register(r'warehouse', WarehouseItemViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
