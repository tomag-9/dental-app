"""MDR 2017/745 traceability: the usage snapshot must stay frozen forever."""

import unittest
from decimal import Decimal

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.test import APITestCase

from apps.materials.models import MaterialCatalog, MaterialLot, MaterialUsage, MaterialUsageLine

from .base import MaterialsFixtureMixin


class SnapshotImmutabilityTests(MaterialsFixtureMixin, APITestCase):
    def setUp(self):
        self.build_materials_fixture()
        self.client.force_authenticate(self.admin)
        self.lot = self.make_lot(short_code="M-1", lot="LOT-A", qty="5.000", expiry=self.days(30))
        response = self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.job.id, "lines": [{"lot": self.lot.id, "qty": "2.000"}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.usage = MaterialUsage.objects.get(pk=response.data["id"])
        self.line = self.usage.lines.get()

    def test_renaming_catalog_does_not_change_the_snapshot(self):
        self.catalog.name = "Renamed ceramic"
        self.catalog.code = "VIT-9999"
        self.catalog.unit = "kg"
        self.catalog.mdr_class = "III"
        self.catalog.save()

        self.line.refresh_from_db()
        self.assertEqual(self.line.name, "Ceramic")
        self.assertEqual(self.line.code, "VIT-0001")
        self.assertEqual(self.line.unit, "g")
        self.assertEqual(self.line.mdr_class, "IIa")

    def test_renaming_manufacturer_does_not_change_the_snapshot(self):
        self.manufacturer.name = "Renamed manufacturer"
        self.manufacturer.save()

        self.line.refresh_from_db()
        self.assertEqual(self.line.manufacturer, "Vita")

    def test_changing_the_lot_does_not_change_the_snapshot(self):
        self.lot.lot = "TAMPERED"
        self.lot.expiry = self.days(900)
        self.lot.save()

        self.line.refresh_from_db()
        self.assertEqual(self.line.lot, "LOT-A")
        self.assertEqual(self.line.expiry, self.days(30))

    def test_catalog_rename_through_the_api_does_not_change_the_snapshot(self):
        response = self.client.patch(
            f"/api/v1/materials/catalog/{self.catalog.id}/",
            {"name": "API rename"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.line.refresh_from_db()
        self.assertEqual(self.line.name, "Ceramic")

    def test_snapshot_line_cannot_be_saved_again(self):
        self.line.name = "Tampered"

        with self.assertRaises(DjangoValidationError):
            self.line.save()

        self.line.refresh_from_db()
        self.assertEqual(self.line.name, "Ceramic")

    def test_snapshot_line_cannot_be_deleted(self):
        with self.assertRaises(DjangoValidationError):
            self.line.delete()

        self.assertTrue(MaterialUsageLine.objects.filter(pk=self.line.pk).exists())

    def test_usage_cannot_be_deleted_while_snapshot_lines_exist(self):
        with self.assertRaises(ProtectedError):
            self.usage.delete()

        self.assertTrue(MaterialUsage.objects.filter(pk=self.usage.pk).exists())

    def test_lab_cannot_be_deleted_while_usage_exists(self):
        with self.assertRaises(ProtectedError):
            self.lab.delete()

    def test_job_cannot_be_deleted_while_usage_exists(self):
        with self.assertRaises(ProtectedError):
            self.job.delete()

    def test_usage_endpoint_is_read_only(self):
        url = f"/api/v1/materials/usage/{self.usage.id}/"

        for method, payload in (
            ("put", {"patient_label": "Tampered"}),
            ("patch", {"patient_label": "Tampered"}),
            ("delete", None),
        ):
            with self.subTest(method=method):
                response = getattr(self.client, method)(url, payload, format="json")
                self.assertEqual(response.status_code, status.HTTP_405_METHOD_NOT_ALLOWED)

        self.usage.refresh_from_db()
        self.assertEqual(self.usage.patient_label, str(self.patient))

    def test_usage_line_quantity_matches_the_decrement(self):
        self.lot.refresh_from_db()
        self.assertEqual(self.line.qty, Decimal("2.000"))
        self.assertEqual(self.lot.qty_received - self.lot.qty_remaining, self.line.qty)

    def test_catalog_with_lots_cannot_be_deleted(self):
        with self.assertRaises(ProtectedError):
            self.catalog.delete()

    def test_manufacturer_with_catalog_cannot_be_deleted(self):
        with self.assertRaises(ProtectedError):
            self.manufacturer.delete()


class SnapshotReferentialIntegrityTests(MaterialsFixtureMixin, APITestCase):
    """`source_lot_id`/`source_catalog_id` are plain integers, not foreign keys.

    Nothing at the database level therefore stops a consumed lot (or its catalog
    entry) from being deleted, which orphans the MDR traceability chain: the
    snapshot line still names the LOT but the lot record is gone.
    """

    def setUp(self):
        self.build_materials_fixture()
        self.client.force_authenticate(self.admin)
        self.lot = self.make_lot(short_code="M-2", lot="LOT-B", qty="5.000", expiry=self.days(30))
        response = self.client.post(
            "/api/v1/materials/usage/",
            {"job": self.job.id, "lines": [{"lot": self.lot.id, "qty": "5.000"}]},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        self.line = MaterialUsageLine.objects.get()

    @unittest.expectedFailure
    def test_lot_with_recorded_usage_is_protected_from_deletion(self):
        """FINDING: a consumed lot can be deleted, orphaning the MDR snapshot.

        `MaterialUsageLine.source_lot_id` is a `PositiveBigIntegerField`, so the
        `PROTECT` semantics the MDR chain relies on do not exist. Fixing this
        needs a real FK plus a migration, so it is tracked separately.
        """
        with self.assertRaises(ProtectedError):
            self.lot.delete()

    @unittest.expectedFailure
    def test_lot_deletion_through_the_api_is_refused(self):
        """FINDING: DELETE /lots/<id>/ succeeds even after the lot was consumed."""
        response = self.client.delete(f"/api/v1/materials/lots/{self.lot.id}/")

        self.assertNotEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    @unittest.expectedFailure
    def test_catalog_referenced_only_by_a_snapshot_is_protected(self):
        """FINDING: same root cause — `source_catalog_id` is not a foreign key."""
        self.lot.delete()

        with self.assertRaises(ProtectedError):
            self.catalog.delete()

    def test_snapshot_survives_lot_deletion_with_its_own_data(self):
        """Documented consequence: only the denormalised copy remains."""
        lot_id = self.lot.id
        self.lot.delete()

        self.line.refresh_from_db()
        self.assertEqual(self.line.lot, "LOT-B")
        self.assertEqual(self.line.source_lot_id, lot_id)
        self.assertFalse(MaterialLot.objects.filter(pk=lot_id).exists())

    @unittest.expectedFailure
    def test_queryset_update_cannot_rewrite_a_snapshot_line(self):
        """FINDING: the immutability guard lives in `save()`/`delete()` only.

        `MaterialUsageLine.objects.update()` (and `.delete()`) bypasses it, so
        the snapshot is only immutable against well-behaved callers; there is no
        database-level protection.
        """
        MaterialUsageLine.objects.filter(pk=self.line.pk).update(name="Tampered")

        self.line.refresh_from_db()
        self.assertEqual(self.line.name, "Ceramic")

    def test_snapshot_is_taken_from_the_state_at_consumption_time(self):
        replacement = MaterialCatalog.objects.create(
            lab=self.lab,
            code="VIT-0001-NEW",
            name="Successor",
            manufacturer=self.manufacturer,
            unit="g",
        )
        self.catalog.name = "Withdrawn"
        self.catalog.save()

        self.line.refresh_from_db()
        self.assertEqual(self.line.name, "Ceramic")
        self.assertNotEqual(self.line.source_catalog_id, replacement.id)
