"""FEFO selection: ordering, exclusions and availability reporting."""

from decimal import Decimal

from rest_framework import status
from rest_framework.test import APITestCase

from apps.materials.models import MaterialLot
from apps.materials.services import available_lots

from .base import MaterialsFixtureMixin


class FefoOrderingTests(MaterialsFixtureMixin, APITestCase):
    def setUp(self):
        self.build_materials_fixture()
        self.client.force_authenticate(self.admin)

    def test_order_follows_expiry_not_received_date(self):
        """The oldest receipt must not win when a newer lot expires sooner."""
        old_receipt_late_expiry = self.make_lot(
            short_code="S-1",
            lot="OLD-RECEIPT",
            qty=5,
            expiry=self.days(120),
            received_days_ago=90,
        )
        new_receipt_early_expiry = self.make_lot(
            short_code="S-2",
            lot="NEW-RECEIPT",
            qty=5,
            expiry=self.days(10),
            received_days_ago=1,
        )

        self.assertEqual(
            [lot.id for lot in available_lots(self.catalog)],
            [new_receipt_early_expiry.id, old_receipt_late_expiry.id],
        )

    def test_equal_expiry_falls_back_to_received_then_id(self):
        later_receipt = self.make_lot(
            short_code="S-3",
            lot="LATER",
            qty=1,
            expiry=self.days(30),
            received_days_ago=1,
        )
        earlier_receipt = self.make_lot(
            short_code="S-4",
            lot="EARLIER",
            qty=1,
            expiry=self.days(30),
            received_days_ago=20,
        )

        self.assertEqual(
            [lot.id for lot in available_lots(self.catalog)],
            [earlier_receipt.id, later_receipt.id],
        )

    def test_lot_without_expiry_is_sorted_last(self):
        dated = self.make_lot(short_code="S-5", lot="DATED", qty=1, expiry=self.days(365))
        undated = self.make_lot(short_code="S-6", lot="UNDATED", qty=1, received_days_ago=100)

        self.assertEqual([lot.id for lot in available_lots(self.catalog)], [dated.id, undated.id])

    def test_lot_without_expiry_is_still_usable(self):
        undated = self.make_lot(short_code="S-7", lot="UNDATED", qty=3)

        self.assertEqual([lot.id for lot in available_lots(self.catalog)], [undated.id])

    def test_expired_lot_is_excluded_but_lot_expiring_today_is_usable(self):
        expiring_today = self.make_lot(short_code="S-8", lot="TODAY", qty=1, expiry=self.days(0))
        self.make_lot(short_code="S-9", lot="YESTERDAY", qty=1, expiry=self.days(-1), received_days_ago=40)

        self.assertEqual([lot.id for lot in available_lots(self.catalog)], [expiring_today.id])

    def test_discarded_and_depleted_lots_are_excluded(self):
        usable = self.make_lot(short_code="S-10", lot="USABLE", qty=2, expiry=self.days(30))
        self.make_lot(
            short_code="S-11",
            lot="DISCARDED",
            qty=5,
            expiry=self.days(30),
            status=MaterialLot.Status.DISCARDED,
        )
        self.make_lot(
            short_code="S-12",
            lot="DEPLETED",
            qty=5,
            qty_remaining=0,
            expiry=self.days(30),
            status=MaterialLot.Status.DEPLETED,
        )

        self.assertEqual([lot.id for lot in available_lots(self.catalog)], [usable.id])

    def test_zero_balance_lot_is_excluded_even_when_status_is_active(self):
        self.make_lot(short_code="S-13", lot="EMPTY", qty=5, qty_remaining=0, expiry=self.days(30))

        self.assertEqual(list(available_lots(self.catalog)), [])

    def test_open_lot_is_still_selectable(self):
        opened = self.make_lot(
            short_code="S-14",
            lot="OPEN",
            qty=5,
            qty_remaining=2,
            expiry=self.days(30),
            status=MaterialLot.Status.OPEN,
        )

        self.assertEqual([lot.id for lot in available_lots(self.catalog)], [opened.id])

    def test_lots_of_other_catalog_are_not_offered(self):
        second_catalog = self.catalog.__class__.objects.create(
            lab=self.lab,
            code="VIT-0002",
            name="Zircon",
            manufacturer=self.manufacturer,
            unit="g",
        )
        mine = self.make_lot(short_code="S-15", lot="MINE", qty=1, expiry=self.days(30))
        self.make_lot(short_code="S-16", lot="OTHER", qty=1, expiry=self.days(5), catalog=second_catalog)

        self.assertEqual([lot.id for lot in available_lots(self.catalog)], [mine.id])

    def test_available_lots_does_not_leak_a_foreign_lab_lot(self):
        """Defence in depth: a mislabelled lot row must never be FEFO-selectable."""
        self.make_lot(
            short_code="S-17",
            lot="FOREIGN",
            qty=9,
            expiry=self.days(1),
            catalog=self.catalog,
            lab=self.other_lab,
        )
        mine = self.make_lot(short_code="S-18", lot="MINE", qty=1, expiry=self.days(30))

        self.assertEqual([lot.id for lot in available_lots(self.catalog)], [mine.id])


class FefoEndpointTests(MaterialsFixtureMixin, APITestCase):
    def setUp(self):
        self.build_materials_fixture()
        self.client.force_authenticate(self.admin)
        self.recipe = self.make_recipe(name="Crown", qty="5.000")

    def fefo(self, **params):
        query = "&".join(f"{key}={value}" for key, value in params.items())
        return self.client.get(f"/api/v1/materials/fefo/?{query}")

    def test_endpoint_returns_lots_in_expiry_order(self):
        late = self.make_lot(short_code="F-1", lot="LATE", qty=4, expiry=self.days(100), received_days_ago=60)
        early = self.make_lot(short_code="F-2", lot="EARLY", qty=3, expiry=self.days(10), received_days_ago=1)

        response = self.fefo(recipe=self.recipe.id)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        line = response.data["lines"][0]
        self.assertEqual([item["id"] for item in line["lots"]], [early.id, late.id])
        self.assertEqual(Decimal(line["available_qty"]), Decimal("7"))
        self.assertEqual(Decimal(line["required_qty"]), Decimal("5.000"))

    def test_endpoint_reports_shortage_without_failing(self):
        self.make_lot(short_code="F-3", lot="SMALL", qty=1, expiry=self.days(30))

        response = self.fefo(recipe=self.recipe.id)

        line = response.data["lines"][0]
        self.assertEqual(Decimal(line["available_qty"]), Decimal("1"))
        self.assertLess(Decimal(line["available_qty"]), Decimal(line["required_qty"]))

    def test_endpoint_returns_zero_availability_when_nothing_is_usable(self):
        self.make_lot(short_code="F-4", lot="EXPIRED", qty=8, expiry=self.days(-1), received_days_ago=90)

        response = self.fefo(recipe=self.recipe.id)

        line = response.data["lines"][0]
        self.assertEqual(line["lots"], [])
        self.assertEqual(Decimal(line["available_qty"]), Decimal("0"))

    def test_endpoint_rejects_recipe_of_another_lab(self):
        foreign_recipe = self.make_recipe(name="Foreign", catalog=self.other_catalog)

        response = self.fefo(recipe=foreign_recipe.id)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_endpoint_rejects_job_of_another_lab(self):
        response = self.fefo(recipe=self.recipe.id, job=self.other_job.id)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_endpoint_requires_recipe_parameter(self):
        response = self.client.get("/api/v1/materials/fefo/")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_endpoint_rejects_non_positive_recipe_parameter(self):
        self.assertEqual(self.fefo(recipe=0).status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(self.fefo(recipe=-3).status_code, status.HTTP_400_BAD_REQUEST)

    def test_endpoint_requires_authentication(self):
        self.client.force_authenticate(None)

        self.assertEqual(self.fefo(recipe=self.recipe.id).status_code, status.HTTP_401_UNAUTHORIZED)

    def test_user_without_lab_is_rejected(self):
        no_lab = self.admin.__class__.objects.create_user(
            username="no-lab",
            email="no-lab@example.test",
            password="test",
            role="user",
        )
        self.client.force_authenticate(no_lab)

        self.assertEqual(self.fefo(recipe=self.recipe.id).status_code, status.HTTP_400_BAD_REQUEST)

    def test_superadmin_must_pass_a_lab(self):
        self.client.force_authenticate(self.superadmin)
        self.make_lot(short_code="F-5", lot="SA", qty=5, expiry=self.days(30))

        self.assertEqual(self.fefo(recipe=self.recipe.id).status_code, status.HTTP_400_BAD_REQUEST)
        scoped = self.fefo(recipe=self.recipe.id, lab=self.lab.id)
        self.assertEqual(scoped.status_code, status.HTTP_200_OK)
        self.assertEqual(len(scoped.data["lines"][0]["lots"]), 1)

    def test_multi_line_recipe_reports_each_material(self):
        second_catalog = self.catalog.__class__.objects.create(
            lab=self.lab,
            code="VIT-0003",
            name="Alloy",
            manufacturer=self.manufacturer,
            unit="g",
        )
        self.recipe.lines.create(catalog=second_catalog, qty="2.000")
        self.make_lot(short_code="F-6", lot="A", qty=5, expiry=self.days(30))
        self.make_lot(short_code="F-7", lot="B", qty=6, expiry=self.days(30), catalog=second_catalog)

        response = self.fefo(recipe=self.recipe.id)

        self.assertEqual(len(response.data["lines"]), 2)
        self.assertEqual(
            {line["catalog"]["code"]: Decimal(line["available_qty"]) for line in response.data["lines"]},
            {"VIT-0001": Decimal("5"), "VIT-0003": Decimal("6")},
        )
