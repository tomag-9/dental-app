from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand
from django.utils import timezone

from apps.core.models import Lab
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import PriceList, Subscription
from apps.inventory.models import WarehouseItem
from apps.jobs.models import Job, Technician, Vacation

User = get_user_model()


class Command(BaseCommand):
    help = "Creates deterministic demo users and sample data for local development"

    def _upsert_user(
        self,
        *,
        username,
        email,
        password,
        role,
        lab,
        is_superuser=False,
        is_staff=False,
    ):
        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "email": email,
                "role": role,
                "lab": lab,
                "is_active": True,
                "is_superuser": is_superuser,
                "is_staff": is_staff,
            },
        )

        user.email = email
        user.role = role
        user.lab = lab
        user.is_active = True
        user.is_superuser = is_superuser
        user.is_staff = is_staff
        user.set_password(password)
        user.save()

        return user, created

    def handle(self, *args, **options):
        self.stdout.write("Seeding deterministic demo users and data...")

        lab, _ = Lab.objects.get_or_create(
            name="Demo Dental Lab",
            defaults={
                "country": "Slovakia",
                "city": "Bratislava",
                "email": "demo.lab@example.com",
                "phone": "+421900000000",
            },
        )

        self._upsert_user(
            username="admin",
            email="admin@example.com",
            password="admin",
            role="admin",
            lab=lab,
            is_superuser=False,
            is_staff=True,
        )
        self.stdout.write(self.style.SUCCESS('User "admin" ready (password: admin)'))

        self._upsert_user(
            username="user",
            email="user@example.com",
            password="user",
            role="user",
            lab=lab,
            is_superuser=False,
            is_staff=False,
        )
        self.stdout.write(self.style.SUCCESS('User "user" ready (password: user)'))

        self._upsert_user(
            username="superadmin",
            email="superadmin@example.com",
            password="superadmin",
            role="superadmin",
            lab=lab,
            is_superuser=True,
            is_staff=True,
        )
        self.stdout.write(self.style.SUCCESS('User "superadmin" ready (password: superadmin)'))

        Subscription.objects.update_or_create(
            lab=lab,
            defaults={
                "plan": "pro",
                "status": "active",
                "seats": 20,
                "current_period_start": date.today(),
                "current_period_end": date.today() + timedelta(days=30),
            },
        )

        clinic_a, _ = Clinic.objects.update_or_create(
            lab=lab,
            name="Downtown Clinic",
            defaults={
                "address": "Main Street 12",
                "contact_info": {
                    "phone": "+421911111111",
                    "email": "downtown@clinic.example.com",
                },
            },
        )
        clinic_b, _ = Clinic.objects.update_or_create(
            lab=lab,
            name="Uptown Clinic",
            defaults={
                "address": "North Avenue 8",
                "contact_info": {
                    "phone": "+421922222222",
                    "email": "uptown@clinic.example.com",
                },
            },
        )

        doctor_a, _ = Doctor.objects.update_or_create(
            lab=lab,
            first_name="John",
            last_name="Smith",
            defaults={"clinic": clinic_a, "title_before": "MUDr."},
        )
        doctor_b, _ = Doctor.objects.update_or_create(
            lab=lab,
            first_name="Eva",
            last_name="Kovac",
            defaults={"clinic": clinic_b, "title_before": "MUDr."},
        )

        patient_a, _ = Patient.objects.update_or_create(
            birth_number="900101/1234",
            defaults={
                "lab": lab,
                "first_name": "Peter",
                "last_name": "Novak",
                "phone": "+421933333333",
                "email": "peter.novak@example.com",
            },
        )
        patient_b, _ = Patient.objects.update_or_create(
            birth_number="920202/5678",
            defaults={
                "lab": lab,
                "first_name": "Maria",
                "last_name": "Horvat",
                "phone": "+421944444444",
                "email": "maria.horvat@example.com",
            },
        )

        tech_a, _ = Technician.objects.update_or_create(
            lab=lab,
            first_name="Lukas",
            last_name="Technik",
            defaults={"contact_info": {"phone": "+421955555555"}},
        )

        Job.objects.update_or_create(
            lab=lab,
            patient=patient_a,
            clinic=clinic_a,
            doctor=doctor_a,
            description="Crown preparation",
            defaults={
                "technician": tech_a,
                "status": "in_progress",
                "price": "180.00",
                "procedure_codes": ["CROWN_A1"],
                "procedure_quantities": {"CROWN_A1": 1},
            },
        )
        Job.objects.update_or_create(
            lab=lab,
            patient=patient_b,
            clinic=clinic_b,
            doctor=doctor_b,
            description="Retainer repair",
            defaults={
                "technician": tech_a,
                "status": "new",
                "price": "75.00",
                "procedure_codes": ["RET_REPAIR"],
                "procedure_quantities": {"RET_REPAIR": 1},
            },
        )

        PriceList.objects.update_or_create(
            code="CROWN_A1",
            defaults={
                "lab": lab,
                "description": "Ceramic crown A1",
                "price": "180.00",
                "valid_from": date.today(),
                "valid_to": date.today() + timedelta(days=365),
            },
        )
        PriceList.objects.update_or_create(
            code="RET_REPAIR",
            defaults={
                "lab": lab,
                "description": "Retainer repair",
                "price": "75.00",
                "valid_from": date.today(),
                "valid_to": date.today() + timedelta(days=365),
            },
        )

        WarehouseItem.objects.update_or_create(
            lab=lab,
            sku="MAT-COMP-A2",
            defaults={
                "name": "Composite Resin A2",
                "quantity": "42",
                "unit": "pcs",
                "min_threshold": "10",
                "category": "Resins",
                "location": "Shelf A3",
                "cost_price": "8.50",
            },
        )
        WarehouseItem.objects.update_or_create(
            lab=lab,
            sku="MAT-CEM-GLASS",
            defaults={
                "name": "Glass Ionomer Cement",
                "quantity": "16",
                "unit": "pcs",
                "min_threshold": "5",
                "category": "Cements",
                "location": "Shelf B1",
                "cost_price": "12.90",
            },
        )

        Vacation.objects.get_or_create(
            lab=lab,
            start=timezone.make_aware(timezone.datetime(2026, 7, 1, 8, 0, 0)),
            end=timezone.make_aware(timezone.datetime(2026, 7, 7, 17, 0, 0)),
            defaults={"description": "Summer maintenance"},
        )

        self.stdout.write(self.style.SUCCESS("Demo seed completed successfully."))
        self.stdout.write(self.style.SUCCESS("Credentials:"))
        self.stdout.write(self.style.SUCCESS("- admin / admin"))
        self.stdout.write(self.style.SUCCESS("- user / user"))
        self.stdout.write(self.style.SUCCESS("- superadmin / superadmin"))
