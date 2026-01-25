from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LabViewSet,
    UserViewSet,
    PatientViewSet,
    ClinicViewSet,
    DoctorViewSet,
    WarehouseItemViewSet,
    TechnicianViewSet,
    PriceListViewSet,
    JobViewSet,
    InvoiceViewSet,
    VacationViewSet,
    SubscriptionViewSet,
    signup,
)
from rest_framework_simplejwt.views import TokenRefreshView, TokenObtainPairView
from .serializers import MyTokenObtainPairSerializer


class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer


router = DefaultRouter()
router.register(r"labs", LabViewSet)
router.register(r"users", UserViewSet)
router.register(r"patients", PatientViewSet)
router.register(r"clinics", ClinicViewSet)
router.register(r"doctors", DoctorViewSet)
router.register(r"warehouse", WarehouseItemViewSet, basename="warehouse")
router.register(r"technicians", TechnicianViewSet)
router.register(r"price_list", PriceListViewSet)
router.register(r"jobs", JobViewSet)
router.register(r"invoices", InvoiceViewSet)
router.register(r"vacations", VacationViewSet)
router.register(r"subscriptions", SubscriptionViewSet)

urlpatterns = [
    path("", include(router.urls)),
    path("signup/", signup, name="signup"),
    path("token/", MyTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
]
