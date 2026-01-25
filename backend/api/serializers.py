from rest_framework import serializers
from .models import (
    Lab,
    User,
    Patient,
    Clinic,
    Doctor,
    WarehouseItem,
    Technician,
    PriceList,
    Job,
    Invoice,
    InvoiceItem,
    Vacation,
    Subscription,
)
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer


class MyTokenObtainPairSerializer(TokenObtainPairSerializer):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field] = serializers.EmailField()

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        token["email"] = user.email
        token["role"] = user.role
        return token


class LabSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lab
        fields = "__all__"


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "email", "nickname", "role", "is_active", "created_at", "lab")
        read_only_fields = ("id", "created_at")


class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        model = Patient
        fields = "__all__"
        read_only_fields = ("lab",)


class ClinicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Clinic
        fields = "__all__"
        read_only_fields = ("lab",)


class DoctorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Doctor
        fields = "__all__"
        read_only_fields = ("lab",)


class WarehouseItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = WarehouseItem
        fields = "__all__"
        read_only_fields = ("lab",)


class TechnicianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Technician
        fields = "__all__"
        read_only_fields = ("lab",)


class PriceListSerializer(serializers.ModelSerializer):
    class Meta:
        model = PriceList
        fields = "__all__"
        read_only_fields = ("lab",)


class JobSerializer(serializers.ModelSerializer):
    class Meta:
        model = Job
        fields = "__all__"
        read_only_fields = ("lab",)


class InvoiceItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvoiceItem
        fields = "__all__"


class InvoiceSerializer(serializers.ModelSerializer):
    items = InvoiceItemSerializer(many=True, read_only=True)

    class Meta:
        model = Invoice
        fields = "__all__"


class VacationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vacation
        fields = "__all__"


class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = "__all__"
