from datetime import timedelta
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import AuditLog, Lab, User
from apps.crm.models import Clinic, Patient
from apps.inventory.models import WarehouseItem
from apps.jobs.models import Job, Technician
from apps.materials.models import (
    Manufacturer,
    MaterialCatalog,
    MaterialLot,
    MaterialRecipe,
    MaterialUsageLine,
    RecipeLine,
)


class MaterialsApiTestCase(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="MDR Lab")
        self.other_lab = Lab.objects.create(name="Other Lab")
        self.user = User.objects.create_user(
            username="mdr-admin",
            email="mdr@example.test",
            password="test",
            role="admin",
            lab=self.lab,
        )
        self.other_user = User.objects.create_user(
            username="other-admin",
            email="other@example.test",
            password="test",
            role="admin",
            lab=self.other_lab,
        )
        self.regular_user = User.objects.create_user(
            username="mdr-user",
            email="mdr-user@example.test",
            password="test",
            role="user",
            lab=self.lab,
        )
        self.client.force_authenticate(self.user)
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
            lab=self.lab, first_name="Eva", last_name="Test", birth_number="900101/1234"
        )
        self.technician = Technician.objects.create(lab=self.lab, first_name="Ján", last_name="Technik")
        self.job = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            patient=self.patient,
            technician=self.technician,
        )

    def lot(self, *, code, lot, qty, expiry=None, status=MaterialLot.Status.ACTIVE):
        return MaterialLot.objects.create(
            lab=self.lab,
            catalog=self.catalog,
            short_code=code,
            lot=lot,
            received=timezone.localdate() - timedelta(days=5),
            expiry=expiry,
            qty_received=qty,
            qty_remaining=qty,
            status=status,
        )

    def test_crud_is_tenant_scoped_and_cross_tenant_relations_are_rejected(self):
        own_response = self.client.get("/api/v1/materials/catalog/")
        self.assertEqual(own_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(own_response.data), 1)

        other_manufacturer = Manufacturer.objects.create(lab=self.other_lab, name="Other", prefix="OTH")
        response = self.client.post(
            "/api/v1/materials/catalog/",
            {"code": "BAD-1", "name": "Bad", "manufacturer": other_manufacturer.id},
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.force_authenticate(self.other_user)
        response = self.client.get(f"/api/v1/materials/catalog/{self.catalog.id}/")
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_stock_code_resolves_only_inside_lab(self):
        stock = WarehouseItem.objects.create(lab=self.lab, name="Ceramic stock", sku="CER-1", quantity=10)
        response = self.client.patch(
            f"/api/v1/materials/catalog/{self.catalog.id}/",
            {"stock_code": "CER-1"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.catalog.refresh_from_db()
        self.assertEqual(self.catalog.stock_item, stock)
        self.assertEqual(response.data["stock_code"], "CER-1")

    def test_expiry_state_boundary_and_filter(self):
        today = timezone.localdate()
        expired = self.lot(code="S-1", lot="E", qty=1, expiry=today - timedelta(days=1))
        soon = self.lot(code="S-2", lot="S", qty=1, expiry=today + timedelta(days=60))
        ok = self.lot(code="S-3", lot="O", qty=1, expiry=today + timedelta(days=61))
        none = self.lot(code="S-4", lot="N", qty=1)
        self.assertEqual(expired.expiry_state, "expired")
        self.assertEqual(soon.expiry_state, "soon")
        self.assertEqual(ok.expiry_state, "ok")
        self.assertEqual(none.expiry_state, "none")
        response = self.client.get("/api/v1/materials/lots/?expiry_state=soon")
        self.assertEqual([item["id"] for item in response.data], [soon.id])

    def test_fefo_excludes_expired_discarded_and_depleted_lots(self):
        today = timezone.localdate()
        late = self.lot(code="S-10", lot="LATE", qty=4, expiry=today + timedelta(days=100))
        early = self.lot(code="S-11", lot="EARLY", qty=3, expiry=today + timedelta(days=10))
        self.lot(code="S-12", lot="EXPIRED", qty=2, expiry=today - timedelta(days=1))
        self.lot(code="S-13", lot="DISCARDED", qty=2, status=MaterialLot.Status.DISCARDED)
        depleted = self.lot(code="S-14", lot="DEPLETED", qty=2)
        depleted.qty_remaining = 0
        depleted.status = MaterialLot.Status.DEPLETED
        depleted.save()
        recipe = MaterialRecipe.objects.create(lab=self.lab, name="Crown", product_type="single")
        RecipeLine.objects.create(recipe=recipe, catalog=self.catalog, qty=5)

        response = self.client.get(f"/api/v1/materials/fefo/?recipe={recipe.id}&job={self.job.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            [item["id"] for item in response.data["lines"][0]["lots"]],
            [early.id, late.id],
        )
        self.assertEqual(Decimal(response.data["lines"][0]["available_qty"]), Decimal("7"))

    def test_usage_auto_allocates_fefo_and_creates_immutable_snapshots(self):
        today = timezone.localdate()
        early = self.lot(code="S-20", lot="EARLY", qty=2, expiry=today + timedelta(days=10))
        late = self.lot(code="S-21", lot="LATE", qty=5, expiry=today + timedelta(days=30))
        recipe = MaterialRecipe.objects.create(lab=self.lab, name="Bridge", product_type="bridge")
        RecipeLine.objects.create(recipe=recipe, catalog=self.catalog, qty=4)

        response = self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.job.id, "recipe": recipe.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(
            [Decimal(line["qty"]) for line in response.data["lines"]],
            [Decimal("2"), Decimal("2")],
        )
        early.refresh_from_db()
        late.refresh_from_db()
        self.assertEqual(early.qty_remaining, 0)
        self.assertEqual(early.status, MaterialLot.Status.DEPLETED)
        self.assertEqual(late.qty_remaining, 3)
        self.assertEqual(late.status, MaterialLot.Status.OPEN)
        self.assertTrue(AuditLog.objects.filter(action="material.usage_created", lab=self.lab).exists())

        snapshot = MaterialUsageLine.objects.get(source_lot_id=early.id)
        self.catalog.name = "Renamed later"
        self.catalog.save()
        self.assertEqual(snapshot.name, "Ceramic")
        snapshot.name = "Tampered"
        with self.assertRaises(DjangoValidationError):
            snapshot.save()
        with self.assertRaises(DjangoValidationError):
            snapshot.delete()

    def test_usage_failure_does_not_decrement_any_lot(self):
        lot = self.lot(
            code="S-30",
            lot="ONLY",
            qty=1,
            expiry=timezone.localdate() + timedelta(days=30),
        )
        response = self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.job.id, "lines": [{"lot": lot.id, "qty": "2.000"}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        lot.refresh_from_db()
        self.assertEqual(lot.qty_remaining, 1)
        self.assertFalse(self.job.material_usages.exists())

    def test_regular_user_cannot_create_usage_or_decrement_stock(self):
        lot = self.lot(
            code="S-30-USER",
            lot="USER-DENIED",
            qty=2,
            expiry=timezone.localdate() + timedelta(days=30),
        )
        self.client.force_authenticate(self.regular_user)

        response = self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.job.id, "lines": [{"lot": lot.id, "qty": "1.000"}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        lot.refresh_from_db()
        self.assertEqual(lot.qty_remaining, 2)
        self.assertFalse(self.job.material_usages.exists())

    def test_invalid_query_ids_return_validation_errors(self):
        for url in (
            "/api/v1/materials/lots/?catalog=invalid",
            "/api/v1/materials/usage/?job=invalid",
            "/api/v1/materials/usage/job-conformity-pdf/?job=invalid",
            "/api/v1/materials/fefo/?recipe=invalid",
        ):
            with self.subTest(url=url):
                response = self.client.get(url)
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_explicit_and_auto_selection_cannot_double_allocate_same_lot(self):
        early = self.lot(
            code="S-31",
            lot="MIXED-EARLY",
            qty=5,
            expiry=timezone.localdate() + timedelta(days=10),
        )
        late = self.lot(
            code="S-32",
            lot="MIXED-LATE",
            qty=5,
            expiry=timezone.localdate() + timedelta(days=20),
        )
        response = self.client.post(
            "/api/v1/materials/usage/",
            {
                "job": self.job.id,
                "lines": [
                    {"lot": early.id, "qty": "4.000"},
                    {"catalog": self.catalog.id, "qty": "4.000"},
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        early.refresh_from_db()
        late.refresh_from_db()
        self.assertEqual(early.qty_remaining, 0)
        self.assertEqual(late.qty_remaining, 2)
        self.assertEqual(sum(Decimal(line["qty"]) for line in response.data["lines"]), Decimal("8"))

    def test_catalog_and_lot_bulk_import(self):
        response = self.client.post(
            "/api/v1/materials/catalog/import/",
            [
                {
                    "code": "VIT-0002",
                    "name": "Zircon",
                    "manufacturer_prefix": "VIT",
                    "unit": "g",
                }
            ],
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        response = self.client.post(
            "/api/v1/materials/lots/import/",
            [
                {
                    "catalog_code": "VIT-0002",
                    "short_code": "S-100",
                    "lot": "LOT-100",
                    "received": timezone.localdate().isoformat(),
                    "qty_received": "10.000",
                }
            ],
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(MaterialLot.objects.get(short_code="S-100").qty_remaining, 10)

    def test_invalid_bulk_import_is_atomic(self):
        response = self.client.post(
            "/api/v1/materials/catalog/import/",
            [
                {"code": "DUP-1", "name": "First", "manufacturer_prefix": "VIT"},
                {"code": "DUP-1", "name": "Second", "manufacturer_prefix": "VIT"},
            ],
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(MaterialCatalog.objects.filter(lab=self.lab, code="DUP-1").exists())

    def test_nested_recipe_crud_and_job_usage_filter(self):
        response = self.client.post(
            "/api/v1/materials/recipes/",
            {
                "name": "Crown recipe",
                "product_type": "single",
                "mdr": True,
                "lines": [{"catalog": self.catalog.id, "qty": "1.500", "note": "base"}],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["lines"][0]["catalog"], self.catalog.id)
        lot = self.lot(
            code="S-35",
            lot="FILTER",
            qty=2,
            expiry=timezone.localdate() + timedelta(days=30),
        )
        usage = self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.job.id, "lines": [{"lot": lot.id, "qty": "1.000"}]},
            format="json",
        )
        filtered = self.client.get(f"/api/v1/materials/usage/?job={self.job.id}")
        self.assertEqual(filtered.status_code, status.HTTP_200_OK)
        self.assertEqual([item["id"] for item in filtered.data], [usage.data["id"]])

    def test_pdf_endpoints_return_pdf(self):
        lot = self.lot(
            code="S-40",
            lot="PDF",
            qty=1,
            expiry=timezone.localdate() + timedelta(days=30),
        )
        usage_response = self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.job.id, "lines": [{"lot": lot.id, "qty": "1.000"}]},
            format="json",
        )
        usage_id = usage_response.data["id"]
        second_lot = self.lot(
            code="S-41",
            lot="PDF-SECOND",
            qty=1,
            expiry=timezone.localdate() + timedelta(days=40),
        )
        self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.job.id, "lines": [{"lot": second_lot.id, "qty": "1.000"}]},
            format="json",
        )
        for url in (
            f"/api/v1/materials/lots/{lot.id}/label-pdf/",
            f"/api/v1/materials/lots/{lot.id}/conformity-pdf/",
            f"/api/v1/materials/usage/{usage_id}/conformity-pdf/",
            f"/api/v1/materials/usage/job-conformity-pdf/?job={self.job.id}",
        ):
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_200_OK, url)
            self.assertEqual(response["Content-Type"], "application/pdf")
            self.assertTrue(response.content.startswith(b"%PDF"))
            if "job-conformity-pdf" in url:
                self.assertEqual(response["X-Material-Usage-Count"], "2")
