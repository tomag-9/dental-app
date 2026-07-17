from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import (
    FefoView,
    ManufacturerViewSet,
    MaterialCatalogViewSet,
    MaterialLotViewSet,
    MaterialRecipeViewSet,
    MaterialUsageViewSet,
)

router = DefaultRouter()
router.register(r"manufacturers", ManufacturerViewSet)
router.register(r"catalog", MaterialCatalogViewSet)
router.register(r"lots", MaterialLotViewSet)
router.register(r"recipes", MaterialRecipeViewSet)
router.register(r"usage", MaterialUsageViewSet)

urlpatterns = [
    path("fefo/", FefoView.as_view(), name="materials-fefo"),
    path("", include(router.urls)),
]
