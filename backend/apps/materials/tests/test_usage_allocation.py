"""Stock decrement, lot status transitions and allocation guards."""

from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import AuditLog
from apps.materials.models import MaterialLot, MaterialUsage, MaterialUsageLine

from .base import MaterialsFixtureMixin


class UsageAllocationTests(MaterialsFixtureMixin, APITestCase):
    def setUp(self):
        self.build_materials_fixture()
        self.client.force_authenticate(self.admin)

    def post_usage(self, payload):
        return self.client.post("/api/v1/materials/usage/", payload, format="json")

    def test_balance_is_reduced_by_the_exact_fractional_quantity(self):
        lot = self.make_lot(short_code="D-1", lot="FRACTION", qty="10.000", expiry=self.days(30))

        response = self.post_usage({"job": self.job.id, "lines": [{"lot": lot.id, "qty": "0.125"}]})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        lot.refresh_from_db()
        self.assertEqual(lot.qty_remaining, Decimal("9.875"))

    def test_repeated_usage_accumulates_exactly(self):
        lot = self.make_lot(short_code="D-2", lot="REPEAT", qty="1.000", expiry=self.days(30))

        for _ in range(3):
            response = self.post_usage({"job": self.job.id, "lines": [{"lot": lot.id, "qty": "0.333"}]})
            self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

        lot.refresh_from_db()
        self.assertEqual(lot.qty_remaining, Decimal("0.001"))
        self.assertEqual(lot.status, MaterialLot.Status.OPEN)

    def test_status_moves_active_to_open_to_depleted(self):
        lot = self.make_lot(short_code="D-3", lot="LIFECYCLE", qty="2.000", expiry=self.days(30))
        self.assertEqual(lot.status, MaterialLot.Status.ACTIVE)
        self.assertIsNone(lot.opened)

        self.post_usage({"job": self.job.id, "lines": [{"lot": lot.id, "qty": "1.000"}]})
        lot.refresh_from_db()
        self.assertEqual(lot.status, MaterialLot.Status.OPEN)
        self.assertEqual(lot.opened, self.today)

        self.post_usage({"job": self.job.id, "lines": [{"lot": lot.id, "qty": "1.000"}]})
        lot.refresh_from_db()
        self.assertEqual(lot.status, MaterialLot.Status.DEPLETED)
        self.assertEqual(lot.qty_remaining, Decimal("0.000"))

    def test_full_consumption_in_one_step_goes_straight_to_depleted(self):
        lot = self.make_lot(short_code="D-4", lot="ONE-SHOT", qty="4.000", expiry=self.days(30))

        self.post_usage({"job": self.job.id, "lines": [{"lot": lot.id, "qty": "4.000"}]})

        lot.refresh_from_db()
        self.assertEqual(lot.status, MaterialLot.Status.DEPLETED)
        self.assertIsNone(lot.opened)

    def test_opened_date_is_not_overwritten_by_later_usage(self):
        lot = self.make_lot(short_code="D-5", lot="OPENED", qty="5.000", expiry=self.days(30))
        first = self.post_usage(
            {
                "job": self.job.id,
                "date": (self.days(-3)).isoformat(),
                "lines": [{"lot": lot.id, "qty": "1.000"}],
            }
        )
        self.assertEqual(first.status_code, status.HTTP_201_CREATED, first.data)
        lot.refresh_from_db()
        self.assertEqual(lot.opened, self.days(-3))

        self.post_usage({"job": self.job.id, "lines": [{"lot": lot.id, "qty": "1.000"}]})

        lot.refresh_from_db()
        self.assertEqual(lot.opened, self.days(-3))

    def test_automatic_allocation_spans_lots_in_fefo_order(self):
        early = self.make_lot(short_code="D-6", lot="EARLY", qty="2.000", expiry=self.days(10))
        late = self.make_lot(short_code="D-7", lot="LATE", qty="5.000", expiry=self.days(60))

        response = self.post_usage({"job": self.job.id, "lines": [{"catalog": self.catalog.id, "qty": "3.000"}]})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        early.refresh_from_db()
        late.refresh_from_db()
        self.assertEqual(early.qty_remaining, Decimal("0.000"))
        self.assertEqual(early.status, MaterialLot.Status.DEPLETED)
        self.assertEqual(late.qty_remaining, Decimal("4.000"))
        self.assertEqual([line["lot"] for line in response.data["lines"]], ["EARLY", "LATE"])

    def test_shortage_rejects_the_whole_usage(self):
        first = self.make_lot(short_code="D-8", lot="A", qty="1.000", expiry=self.days(10))
        second = self.make_lot(short_code="D-9", lot="B", qty="1.000", expiry=self.days(20))

        response = self.post_usage({"job": self.job.id, "lines": [{"catalog": self.catalog.id, "qty": "5.000"}]})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.qty_remaining, Decimal("1.000"))
        self.assertEqual(second.qty_remaining, Decimal("1.000"))
        self.assertFalse(MaterialUsage.objects.exists())
        self.assertFalse(MaterialUsageLine.objects.exists())

    def test_partial_failure_rolls_back_earlier_successful_line(self):
        available = self.make_lot(short_code="D-10", lot="OK", qty="5.000", expiry=self.days(30))
        second_catalog = self.catalog.__class__.objects.create(
            lab=self.lab,
            code="VIT-0009",
            name="Alloy",
            manufacturer=self.manufacturer,
            unit="g",
        )

        response = self.post_usage(
            {
                "job": self.job.id,
                "lines": [
                    {"catalog": self.catalog.id, "qty": "1.000"},
                    {"catalog": second_catalog.id, "qty": "1.000"},
                ],
            }
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        available.refresh_from_db()
        self.assertEqual(available.qty_remaining, Decimal("5.000"))
        self.assertEqual(available.status, MaterialLot.Status.ACTIVE)
        self.assertFalse(MaterialUsage.objects.exists())

    def test_expired_lot_cannot_be_consumed_explicitly(self):
        expired = self.make_lot(short_code="D-11", lot="EXPIRED", qty="5.000", expiry=self.days(-1))

        response = self.post_usage({"job": self.job.id, "lines": [{"lot": expired.id, "qty": "1.000"}]})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        expired.refresh_from_db()
        self.assertEqual(expired.qty_remaining, Decimal("5.000"))

    def test_discarded_lot_cannot_be_consumed_explicitly(self):
        discarded = self.make_lot(
            short_code="D-12",
            lot="DISCARDED",
            qty="5.000",
            expiry=self.days(30),
            status=MaterialLot.Status.DISCARDED,
        )

        response = self.post_usage({"job": self.job.id, "lines": [{"lot": discarded.id, "qty": "1.000"}]})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        discarded.refresh_from_db()
        self.assertEqual(discarded.qty_remaining, Decimal("5.000"))

    def test_material_not_allowed_in_jobs_is_rejected(self):
        self.catalog.allow_in_job = False
        self.catalog.save(update_fields=["allow_in_job"])
        lot = self.make_lot(short_code="D-13", lot="BLOCKED", qty="5.000", expiry=self.days(30))

        response = self.post_usage({"job": self.job.id, "lines": [{"lot": lot.id, "qty": "1.000"}]})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        lot.refresh_from_db()
        self.assertEqual(lot.qty_remaining, Decimal("5.000"))

    def test_two_lines_of_the_same_catalog_are_summed_before_allocation(self):
        lot = self.make_lot(short_code="D-14", lot="SUM", qty="5.000", expiry=self.days(30))

        response = self.post_usage(
            {
                "job": self.job.id,
                "lines": [
                    {"catalog": self.catalog.id, "qty": "1.000"},
                    {"catalog": self.catalog.id, "qty": "2.000"},
                ],
            }
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        lot.refresh_from_db()
        self.assertEqual(lot.qty_remaining, Decimal("2.000"))
        self.assertEqual(len(response.data["lines"]), 1)
        self.assertEqual(Decimal(response.data["lines"][0]["qty"]), Decimal("3.000"))

    def test_explicit_lot_beyond_its_balance_is_rejected(self):
        small = self.make_lot(short_code="D-15", lot="SMALL", qty="1.000", expiry=self.days(10))
        big = self.make_lot(short_code="D-16", lot="BIG", qty="50.000", expiry=self.days(90))

        response = self.post_usage({"job": self.job.id, "lines": [{"lot": small.id, "qty": "2.000"}]})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        small.refresh_from_db()
        big.refresh_from_db()
        self.assertEqual(small.qty_remaining, Decimal("1.000"))
        self.assertEqual(big.qty_remaining, Decimal("50.000"))

    def test_recipe_quantities_drive_the_allocation(self):
        lot = self.make_lot(short_code="D-17", lot="RECIPE", qty="10.000", expiry=self.days(30))
        recipe = self.make_recipe(name="Bridge", qty="2.500")

        response = self.post_usage({"job": self.job.id, "recipe": recipe.id})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        lot.refresh_from_db()
        self.assertEqual(lot.qty_remaining, Decimal("7.500"))
        usage = MaterialUsage.objects.get()
        self.assertEqual(usage.recipe, "Bridge")
        self.assertEqual(usage.recipe_source_id, recipe.id)

    def test_explicit_lines_override_recipe_lines(self):
        lot = self.make_lot(short_code="D-18", lot="OVERRIDE", qty="10.000", expiry=self.days(30))
        recipe = self.make_recipe(name="Crown", qty="9.000")

        response = self.post_usage(
            {
                "job": self.job.id,
                "recipe": recipe.id,
                "lines": [{"lot": lot.id, "qty": "1.000"}],
            }
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        lot.refresh_from_db()
        self.assertEqual(lot.qty_remaining, Decimal("9.000"))

    def test_usage_snapshot_captures_job_context(self):
        lot = self.make_lot(short_code="D-19", lot="CONTEXT", qty="1.000", expiry=self.days(30))

        response = self.post_usage({"job": self.job.id, "lines": [{"lot": lot.id, "qty": "1.000"}]})

        usage = MaterialUsage.objects.get(pk=response.data["id"])
        self.assertEqual(usage.patient_label, str(self.patient))
        self.assertEqual(usage.technician, "Ján Technik")
        self.assertEqual(usage.date, self.today)
        line = usage.lines.get()
        self.assertEqual(
            (line.code, line.name, line.manufacturer, line.mdr_class, line.unit, line.lot),
            ("VIT-0001", "Ceramic", "Vita", "IIa", "g", "CONTEXT"),
        )
        self.assertEqual(line.source_lot_id, lot.id)
        self.assertEqual(line.source_catalog_id, self.catalog.id)

    def test_usage_creation_writes_an_audit_log(self):
        lot = self.make_lot(short_code="D-20", lot="AUDIT", qty="1.000", expiry=self.days(30))

        response = self.post_usage({"job": self.job.id, "lines": [{"lot": lot.id, "qty": "1.000"}]})

        entry = AuditLog.objects.get(action="material.usage_created", lab=self.lab)
        self.assertEqual(entry.entity_id, str(response.data["id"]))
        self.assertEqual(entry.metadata["job_id"], self.job.id)
        self.assertEqual(entry.metadata["line_count"], 1)

    def test_payload_without_recipe_or_lines_is_rejected(self):
        response = self.post_usage({"job": self.job.id})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_non_positive_quantity_is_rejected(self):
        lot = self.make_lot(short_code="D-21", lot="ZERO", qty="1.000", expiry=self.days(30))

        for qty in ("0.000", "-1.000"):
            with self.subTest(qty=qty):
                response = self.post_usage({"job": self.job.id, "lines": [{"lot": lot.id, "qty": qty}]})
                self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        lot.refresh_from_db()
        self.assertEqual(lot.qty_remaining, Decimal("1.000"))

    def test_lot_and_catalog_mismatch_in_one_line_is_rejected(self):
        second_catalog = self.catalog.__class__.objects.create(
            lab=self.lab,
            code="VIT-0010",
            name="Alloy",
            manufacturer=self.manufacturer,
            unit="g",
        )
        lot = self.make_lot(short_code="D-22", lot="MISMATCH", qty="5.000", expiry=self.days(30))

        response = self.post_usage(
            {"job": self.job.id, "lines": [{"lot": lot.id, "catalog": second_catalog.id, "qty": "1.000"}]}
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        lot.refresh_from_db()
        self.assertEqual(lot.qty_remaining, Decimal("5.000"))

    def test_unknown_job_is_rejected(self):
        lot = self.make_lot(short_code="D-23", lot="NOJOB", qty="1.000", expiry=self.days(30))

        response = self.post_usage({"job": self.job.id + 999, "lines": [{"lot": lot.id, "qty": "1.000"}]})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        lot.refresh_from_db()
        self.assertEqual(lot.qty_remaining, Decimal("1.000"))
