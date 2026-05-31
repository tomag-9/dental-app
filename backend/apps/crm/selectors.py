from apps.core.access import tenant_scoped_queryset

from .models import Clinic, Doctor, Patient


def patients_for_user(user):
    return tenant_scoped_queryset(Patient.objects.all(), user)


def clinics_for_user(user):
    return tenant_scoped_queryset(Clinic.objects.all(), user)


def doctors_for_user(user):
    return tenant_scoped_queryset(Doctor.objects.all(), user)
