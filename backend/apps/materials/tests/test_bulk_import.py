"""Bulk import of catalog entries and lots: atomicity and duplicate handling."""

from decimal import Decimal
from io import BytesIO

from rest_framework import status
from rest_framework.test import APITestCase

from apps.inventory.models import WarehouseItem
from apps.materials.models import MaterialCatalog, MaterialLot

from .base import MaterialsFixtureMixin

CATALOG_URL = "/api/v1/materials/catalog/import/"
LOT_URL = "/api/v1/materials/lots/import/"


def csv_upload(text, name="import.csv"):
    upload = BytesIO(text.encode("utf-8"))
    upload.name = name
    return upload


class CatalogImportTests(MaterialsFixtureMixin, APITestCase):
    def setUp(self):
        self.build_materials_fixture()
        self.client.force_authenticate(self.admin)

    def test_csv_import_creates_rows(self):
        csv_text = "code,name,manufacturer_prefix,unit,mdr_class\nVIT-1000,Zircon,VIT,g,IIa\nVIT-1001,Alloy,VIT,g,\n"

        response = self.client.post(CATALOG_URL, {"file": csv_upload(csv_text)}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(response.data["imported"], 2)
        created = MaterialCatalog.objects.get(code="VIT-1001")
        self.assertEqual(created.lab, self.lab)
        self.assertIsNone(created.mdr_class)

    def test_single_invalid_csv_row_saves_nothing(self):
        csv_text = "code,name,manufacturer_prefix,unit\nVIT-2000,Good,VIT,g\nVIT-2001,,VIT,g\n"

        response = self.client.post(CATALOG_URL, {"file": csv_upload(csv_text)}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("errors", response.data)
        self.assertEqual(MaterialCatalog.objects.filter(code__startswith="VIT-2").count(), 0)

    def test_unknown_manufacturer_prefix_saves_nothing(self):
        payload = [
            {"code": "VIT-3000", "name": "Good", "manufacturer_prefix": "VIT"},
            {"code": "VIT-3001", "name": "Bad", "manufacturer_prefix": "NOPE"},
        ]

        response = self.client.post(CATALOG_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaterialCatalog.objects.filter(code__startswith="VIT-3").count(), 0)

    def test_duplicate_code_inside_the_file_is_refused(self):
        payload = [
            {"code": "VIT-4000", "name": "First", "manufacturer_prefix": "VIT"},
            {"code": "VIT-4000", "name": "Second", "manufacturer_prefix": "VIT"},
        ]

        response = self.client.post(CATALOG_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(MaterialCatalog.objects.filter(code="VIT-4000").exists())

    def test_code_already_present_in_the_lab_is_refused(self):
        payload = [{"code": self.catalog.code, "name": "Clash", "manufacturer_prefix": "VIT"}]

        response = self.client.post(CATALOG_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaterialCatalog.objects.filter(lab=self.lab, code=self.catalog.code).count(), 1)

    def test_same_code_in_another_lab_does_not_block_the_import(self):
        payload = [{"code": self.other_catalog.code, "name": "Reused code", "manufacturer_prefix": "VIT"}]

        response = self.client.post(CATALOG_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertTrue(MaterialCatalog.objects.filter(lab=self.lab, code=self.other_catalog.code).exists())

    def test_unknown_stock_code_saves_nothing(self):
        payload = [{"code": "VIT-5000", "name": "Stocked", "manufacturer_prefix": "VIT", "stock_code": "MISSING"}]

        response = self.client.post(CATALOG_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(MaterialCatalog.objects.filter(code="VIT-5000").exists())

    def test_stock_code_from_another_lab_is_not_linked(self):
        WarehouseItem.objects.create(lab=self.other_lab, name="Foreign", sku="FOR-9", quantity=1)
        payload = [{"code": "VIT-5001", "name": "Stocked", "manufacturer_prefix": "VIT", "stock_code": "FOR-9"}]

        response = self.client.post(CATALOG_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(MaterialCatalog.objects.filter(code="VIT-5001").exists())

    def test_known_stock_code_is_linked(self):
        item = WarehouseItem.objects.create(lab=self.lab, name="Mine", sku="SKU-1", quantity=1)
        payload = [{"code": "VIT-5002", "name": "Stocked", "manufacturer_prefix": "VIT", "stock_code": "SKU-1"}]

        response = self.client.post(CATALOG_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(MaterialCatalog.objects.get(code="VIT-5002").stock_item, item)

    def test_non_utf8_file_is_refused(self):
        upload = BytesIO("code,name\nVIT-6000,Čerešňa\n".encode("cp1250"))
        upload.name = "latin.csv"

        response = self.client.post(CATALOG_URL, {"file": upload}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_payload_that_is_not_a_list_is_refused(self):
        response = self.client.post(CATALOG_URL, {"code": "VIT-7000"}, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_member_cannot_import(self):
        self.client.force_authenticate(self.member)

        response = self.client.post(
            CATALOG_URL,
            [{"code": "VIT-8000", "name": "Nope", "manufacturer_prefix": "VIT"}],
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(MaterialCatalog.objects.filter(code="VIT-8000").exists())

    def test_superadmin_must_name_a_lab(self):
        self.client.force_authenticate(self.superadmin)
        payload = [{"code": "VIT-8100", "name": "SA", "manufacturer_prefix": "VIT"}]

        self.assertEqual(self.client.post(CATALOG_URL, payload, format="json").status_code, 400)

        scoped = self.client.post(f"{CATALOG_URL}?lab={self.lab.id}", payload, format="json")
        self.assertEqual(scoped.status_code, status.HTTP_201_CREATED, scoped.data)
        self.assertEqual(MaterialCatalog.objects.get(code="VIT-8100").lab, self.lab)


class LotImportTests(MaterialsFixtureMixin, APITestCase):
    def setUp(self):
        self.build_materials_fixture()
        self.client.force_authenticate(self.admin)

    def row(self, **overrides):
        data = {
            "catalog_code": self.catalog.code,
            "short_code": "L-1",
            "lot": "LOT-1",
            "received": self.today.isoformat(),
            "expiry": self.days(90).isoformat(),
            "qty_received": "10.000",
        }
        data.update(overrides)
        return data

    def test_csv_import_creates_lots_and_defaults_the_balance(self):
        csv_text = (
            "catalog_code,short_code,lot,received,expiry,qty_received,qty_remaining\n"
            f"{self.catalog.code},L-10,LOT-10,{self.today.isoformat()},{self.days(30).isoformat()},5.000,\n"
        )

        response = self.client.post(LOT_URL, {"file": csv_upload(csv_text)}, format="multipart")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        lot = MaterialLot.objects.get(short_code="L-10")
        self.assertEqual(lot.qty_remaining, Decimal("5.000"))
        self.assertEqual(lot.status, MaterialLot.Status.ACTIVE)
        self.assertEqual(lot.lab, self.lab)

    def test_duplicate_lot_inside_the_file_is_refused(self):
        payload = [self.row(short_code="L-11"), self.row(short_code="L-12")]

        response = self.client.post(LOT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaterialLot.objects.count(), 0)

    def test_lot_already_present_for_the_material_is_refused(self):
        self.make_lot(short_code="L-13", lot="EXISTING", qty="1.000", expiry=self.days(10))
        payload = [self.row(short_code="L-14", lot="EXISTING")]

        response = self.client.post(LOT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaterialLot.objects.count(), 1)

    def test_duplicate_short_code_is_refused(self):
        self.make_lot(short_code="L-15", lot="OTHER", qty="1.000", expiry=self.days(10))
        payload = [self.row(short_code="L-15")]

        response = self.client.post(LOT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaterialLot.objects.count(), 1)

    def test_same_lot_number_under_a_different_material_is_allowed(self):
        second = MaterialCatalog.objects.create(
            lab=self.lab,
            code="VIT-0500",
            name="Alloy",
            manufacturer=self.manufacturer,
            unit="g",
        )
        payload = [self.row(short_code="L-16"), self.row(short_code="L-17", catalog_code=second.code)]

        response = self.client.post(LOT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(MaterialLot.objects.filter(lot="LOT-1").count(), 2)

    def test_unknown_catalog_code_saves_nothing(self):
        payload = [self.row(short_code="L-18"), self.row(short_code="L-19", catalog_code="NOPE")]

        response = self.client.post(LOT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaterialLot.objects.count(), 0)

    def test_catalog_of_another_lab_is_not_reachable(self):
        payload = [self.row(short_code="L-20", catalog_code=self.other_catalog.code)]

        response = self.client.post(LOT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaterialLot.objects.count(), 0)

    def test_invalid_row_saves_nothing(self):
        payload = [self.row(short_code="L-21"), self.row(short_code="L-22", qty_received="-5.000")]

        response = self.client.post(LOT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaterialLot.objects.count(), 0)

    def test_balance_above_received_saves_nothing(self):
        payload = [self.row(short_code="L-23"), self.row(short_code="L-24", lot="LOT-2", qty_remaining="99.000")]

        response = self.client.post(LOT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaterialLot.objects.count(), 0)

    def test_expiry_before_receipt_saves_nothing(self):
        payload = [self.row(short_code="L-25", expiry=self.days(-10).isoformat())]

        response = self.client.post(LOT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaterialLot.objects.count(), 0)

    def test_zero_balance_is_imported_as_depleted(self):
        payload = [self.row(short_code="L-26", qty_remaining="0")]

        response = self.client.post(LOT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.assertEqual(MaterialLot.objects.get(short_code="L-26").status, MaterialLot.Status.DEPLETED)

    def test_depleted_status_with_a_positive_balance_is_refused(self):
        """The single-record API refuses this combination; the import must too."""
        payload = [self.row(short_code="L-27", status=MaterialLot.Status.DEPLETED)]

        response = self.client.post(LOT_URL, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(MaterialLot.objects.count(), 0)

    def test_imported_lot_is_immediately_fefo_selectable(self):
        self.client.post(LOT_URL, [self.row(short_code="L-28")], format="json")
        recipe = self.make_recipe(name="Crown", qty="2.000")

        response = self.client.get(f"/api/v1/materials/fefo/?recipe={recipe.id}")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item["lot"] for item in response.data["lines"][0]["lots"]], ["LOT-1"])

    def test_member_cannot_import_lots(self):
        self.client.force_authenticate(self.member)

        response = self.client.post(LOT_URL, [self.row(short_code="L-29")], format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(MaterialLot.objects.count(), 0)
