"""Tenant isolation across every materials endpoint."""

from rest_framework import status
from rest_framework.test import APITestCase

from apps.materials.models import MaterialLot, MaterialUsage

from .base import MaterialsFixtureMixin


class MaterialsTenantIsolationTests(MaterialsFixtureMixin, APITestCase):
    def setUp(self):
        self.build_materials_fixture()
        self.my_lot = self.make_lot(short_code="T-1", lot="MINE", qty="5.000", expiry=self.days(30))
        self.their_lot = self.make_lot(
            short_code="T-2",
            lot="THEIRS",
            qty="5.000",
            expiry=self.days(30),
            catalog=self.other_catalog,
        )
        self.my_recipe = self.make_recipe(name="Mine")
        self.their_recipe = self.make_recipe(name="Theirs", catalog=self.other_catalog)
        self.client.force_authenticate(self.admin)
        response = self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.job.id, "lines": [{"lot": self.my_lot.id, "qty": "1.000"}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.my_usage = MaterialUsage.objects.get(pk=response.data["id"])
        self.client.force_authenticate(self.other_admin)
        response = self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.other_job.id, "lines": [{"lot": self.their_lot.id, "qty": "1.000"}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.their_usage = MaterialUsage.objects.get(pk=response.data["id"])
        self.client.force_authenticate(self.admin)

    def ids(self, response):
        payload = response.data.get("results", response.data) if isinstance(response.data, dict) else response.data
        return {item["id"] for item in payload}

    def test_list_endpoints_only_return_own_lab_records(self):
        for url, mine, theirs in (
            ("/api/v1/materials/manufacturers/", self.manufacturer.id, self.other_manufacturer.id),
            ("/api/v1/materials/catalog/", self.catalog.id, self.other_catalog.id),
            ("/api/v1/materials/lots/", self.my_lot.id, self.their_lot.id),
            ("/api/v1/materials/recipes/", self.my_recipe.id, self.their_recipe.id),
            ("/api/v1/materials/usage/", self.my_usage.id, self.their_usage.id),
        ):
            with self.subTest(url=url):
                ids = self.ids(self.client.get(url))
                self.assertIn(mine, ids)
                self.assertNotIn(theirs, ids)

    def test_detail_endpoints_hide_foreign_records(self):
        for url in (
            f"/api/v1/materials/manufacturers/{self.other_manufacturer.id}/",
            f"/api/v1/materials/catalog/{self.other_catalog.id}/",
            f"/api/v1/materials/lots/{self.their_lot.id}/",
            f"/api/v1/materials/recipes/{self.their_recipe.id}/",
            f"/api/v1/materials/usage/{self.their_usage.id}/",
        ):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_foreign_records_cannot_be_modified_or_deleted(self):
        url = f"/api/v1/materials/lots/{self.their_lot.id}/"

        self.assertEqual(self.client.patch(url, {"location": "hacked"}, format="json").status_code, 404)
        self.assertEqual(self.client.delete(url).status_code, status.HTTP_404_NOT_FOUND)
        self.their_lot.refresh_from_db()
        self.assertEqual(self.their_lot.location, "")

    def test_foreign_pdf_endpoints_are_hidden(self):
        for url in (
            f"/api/v1/materials/lots/{self.their_lot.id}/label-pdf/",
            f"/api/v1/materials/lots/{self.their_lot.id}/conformity-pdf/",
            f"/api/v1/materials/usage/{self.their_usage.id}/conformity-pdf/",
        ):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, status.HTTP_404_NOT_FOUND)

    def test_job_conformity_pdf_ignores_foreign_jobs(self):
        response = self.client.get(f"/api/v1/materials/usage/job-conformity-pdf/?job={self.other_job.id}")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_usage_filter_by_foreign_job_returns_nothing(self):
        response = self.client.get(f"/api/v1/materials/usage/?job={self.other_job.id}")

        self.assertEqual(self.ids(response), set())

    def test_lot_cannot_be_created_against_a_foreign_catalog(self):
        response = self.client.post(
            "/api/v1/materials/lots/",
            {
                "catalog": self.other_catalog.id,
                "short_code": "T-9",
                "lot": "CROSS",
                "received": self.today.isoformat(),
                "qty_received": "1.000",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertFalse(MaterialLot.objects.filter(short_code="T-9").exists())

    def test_catalog_cannot_be_created_against_a_foreign_manufacturer(self):
        response = self.client.post(
            "/api/v1/materials/catalog/",
            {"code": "X-1", "name": "Cross", "manufacturer": self.other_manufacturer.id},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_recipe_cannot_reference_a_foreign_catalog(self):
        response = self.client.post(
            "/api/v1/materials/recipes/",
            {"name": "Cross recipe", "lines": [{"catalog": self.other_catalog.id, "qty": "1.000"}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_usage_cannot_consume_a_foreign_lot(self):
        response = self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.job.id, "lines": [{"lot": self.their_lot.id, "qty": "1.000"}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.their_lot.refresh_from_db()
        self.assertEqual(str(self.their_lot.qty_remaining), "4.000")

    def test_usage_cannot_be_booked_on_a_foreign_job(self):
        response = self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.other_job.id, "lines": [{"lot": self.my_lot.id, "qty": "1.000"}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.my_lot.refresh_from_db()
        self.assertEqual(str(self.my_lot.qty_remaining), "4.000")

    def test_stock_code_of_a_foreign_warehouse_item_is_refused(self):
        from apps.inventory.models import WarehouseItem

        WarehouseItem.objects.create(lab=self.other_lab, name="Foreign stock", sku="FOR-1", quantity=5)

        response = self.client.patch(
            f"/api/v1/materials/catalog/{self.catalog.id}/",
            {"stock_code": "FOR-1"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.catalog.refresh_from_db()
        self.assertIsNone(self.catalog.stock_item)

    def test_non_admin_member_can_read_but_not_write(self):
        self.client.force_authenticate(self.member)

        self.assertEqual(self.client.get("/api/v1/materials/lots/").status_code, status.HTTP_200_OK)
        response = self.client.post(
            "/api/v1/materials/lots/",
            {
                "catalog": self.catalog.id,
                "short_code": "T-20",
                "lot": "MEMBER",
                "received": self.today.isoformat(),
                "qty_received": "1.000",
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_superadmin_sees_every_lab(self):
        self.client.force_authenticate(self.superadmin)

        ids = self.ids(self.client.get("/api/v1/materials/lots/"))

        self.assertEqual({self.my_lot.id, self.their_lot.id}, ids)

    def test_anonymous_access_is_rejected(self):
        self.client.force_authenticate(None)

        for url in (
            "/api/v1/materials/catalog/",
            "/api/v1/materials/lots/",
            "/api/v1/materials/usage/",
            "/api/v1/materials/recipes/",
            "/api/v1/materials/manufacturers/",
        ):
            with self.subTest(url=url):
                self.assertEqual(self.client.get(url).status_code, status.HTTP_401_UNAUTHORIZED)
