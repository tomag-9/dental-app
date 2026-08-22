"""Shared fixtures for the MDR materials test suite."""

from datetime import timedelta

from django.utils import timezone

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Patient
from apps.jobs.models import Job, Technician
from apps.materials.models import (
    Manufacturer,
    MaterialCatalog,
    MaterialLot,
    MaterialRecipe,
    RecipeLine,
)


class MaterialsFixtureMixin:
    """Builds two labs with a full material chain so tenant leaks are visible."""

    def build_materials_fixture(self):
        self.today = timezone.localdate()
        self.lab = Lab.objects.create(name="MDR Lab")
        self.other_lab = Lab.objects.create(name="Other Lab")
        self.admin = User.objects.create_user(
            username="mdr-admin",
            email="mdr-admin@example.test",
            role="admin",
            lab=self.lab,
        )
        self.member = User.objects.create_user(
            username="mdr-member",
            email="mdr-member@example.test",
            role="user",
            lab=self.lab,
        )
        self.other_admin = User.objects.create_user(
            username="other-admin",
            email="other-admin@example.test",
            role="admin",
            lab=self.other_lab,
        )
        self.superadmin = User.objects.create_user(
            username="mdr-superadmin",
            email="mdr-superadmin@example.test",
            role="superadmin",
            is_superuser=True,
        )

        self.manufacturer = Manufacturer.objects.create(lab=self.lab, name="Vita", prefix="VIT", country="DE")
        self.catalog = MaterialCatalog.objects.create(
            lab=self.lab,
            code="VIT-0001",
            name="Ceramic",
            manufacturer=self.manufacturer,
            unit="g",
            mdr_class="IIa",
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Clinic")
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Eva",
            last_name="Test",
            birth_number="900101/1234",
        )
        self.technician = Technician.objects.create(lab=self.lab, first_name="Ján", last_name="Technik")
        self.job = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            patient=self.patient,
            technician=self.technician,
        )

        self.other_manufacturer = Manufacturer.objects.create(lab=self.other_lab, name="Ivoclar", prefix="IVO")
        self.other_catalog = MaterialCatalog.objects.create(
            lab=self.other_lab,
            code="IVO-0001",
            name="Other ceramic",
            manufacturer=self.other_manufacturer,
            unit="g",
        )
        self.other_clinic = Clinic.objects.create(lab=self.other_lab, name="Other clinic")
        self.other_patient = Patient.objects.create(
            lab=self.other_lab,
            first_name="Iva",
            last_name="Cudzia",
            birth_number="910101/1234",
        )
        self.other_job = Job.objects.create(
            lab=self.other_lab,
            clinic=self.other_clinic,
            patient=self.other_patient,
        )

    def make_lot(
        self,
        *,
        short_code,
        lot,
        qty,
        expiry=None,
        received_days_ago=5,
        status=MaterialLot.Status.ACTIVE,
        catalog=None,
        lab=None,
        qty_remaining=None,
    ):
        catalog = catalog or self.catalog
        return MaterialLot.objects.create(
            lab=lab or catalog.lab,
            catalog=catalog,
            short_code=short_code,
            lot=lot,
            received=self.today - timedelta(days=received_days_ago),
            expiry=expiry,
            qty_received=qty,
            qty_remaining=qty if qty_remaining is None else qty_remaining,
            status=status,
        )

    def make_recipe(self, *, name, catalog=None, qty="1.000", lab=None):
        catalog = catalog or self.catalog
        recipe = MaterialRecipe.objects.create(lab=lab or catalog.lab, name=name)
        RecipeLine.objects.create(recipe=recipe, catalog=catalog, qty=qty)
        return recipe

    def days(self, count):
        return self.today + timedelta(days=count)
