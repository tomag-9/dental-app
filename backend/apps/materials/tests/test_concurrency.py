"""Concurrent consumption of the same lot must not overdraw the balance."""

import threading
import unittest
from datetime import timedelta
from decimal import Decimal

from django.db import connection, connections, transaction
from django.test import TransactionTestCase
from django.utils import timezone
from rest_framework.exceptions import ValidationError as DRFValidationError

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Patient
from apps.jobs.models import Job
from apps.materials.models import Manufacturer, MaterialCatalog, MaterialLot, MaterialUsageLine
from apps.materials.services import available_lots, create_usage


class FefoLockingTests(TransactionTestCase):
    """Backend-independent check that FEFO selection asks for a row lock."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Lock Lab")
        self.manufacturer = Manufacturer.objects.create(lab=self.lab, name="Vita", prefix="VIT")
        self.catalog = MaterialCatalog.objects.create(
            lab=self.lab,
            code="LOCK-1",
            name="Ceramic",
            manufacturer=self.manufacturer,
            unit="g",
        )

    def test_locked_queryset_emits_select_for_update(self):
        with transaction.atomic():
            query = available_lots(self.catalog, lock=True).query

            self.assertTrue(query.select_for_update)
            if connection.features.has_select_for_update:
                self.assertIn("FOR UPDATE", str(query).upper())

    def test_unlocked_queryset_does_not_lock(self):
        self.assertFalse(available_lots(self.catalog).query.select_for_update)


@unittest.skipUnless(
    connection.vendor == "postgresql",
    "Row-level locking is only meaningful on PostgreSQL; SQLite serialises writes.",
)
class ConcurrentUsageTests(TransactionTestCase):
    """Two writers consume the same lot at the same time."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Race Lab")
        self.user = User.objects.create_user(username="race-admin", email="race@example.test", role="admin")
        self.user.lab = self.lab
        self.user.save(update_fields=["lab"])
        self.manufacturer = Manufacturer.objects.create(lab=self.lab, name="Vita", prefix="VIT")
        self.catalog = MaterialCatalog.objects.create(
            lab=self.lab,
            code="RACE-1",
            name="Ceramic",
            manufacturer=self.manufacturer,
            unit="g",
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Clinic")
        self.patient = Patient.objects.create(
            lab=self.lab, first_name="Eva", last_name="Race", birth_number="900101/1234"
        )
        self.job = Job.objects.create(lab=self.lab, clinic=self.clinic, patient=self.patient)
        self.lot = MaterialLot.objects.create(
            lab=self.lab,
            catalog=self.catalog,
            short_code="R-1",
            lot="RACE-LOT",
            received=timezone.localdate(),
            expiry=timezone.localdate() + timedelta(days=30),
            qty_received=Decimal("10.000"),
            qty_remaining=Decimal("10.000"),
        )

    def _consume(self, qty, results, index, barrier):
        try:
            barrier.wait(timeout=10)
            with transaction.atomic():
                create_usage(
                    actor=self.user,
                    lab=self.lab,
                    validated_data={
                        "job": self.job.id,
                        "lines": [{"catalog": self.catalog, "qty": Decimal(qty)}],
                    },
                )
            results[index] = "ok"
        except DRFValidationError as exc:
            results[index] = f"rejected: {exc.detail}"
        except Exception as exc:  # pragma: no cover - surfaced through the assertion
            results[index] = f"error: {exc!r}"
        finally:
            connections.close_all()

    def _run_parallel(self, quantities):
        results = [None] * len(quantities)
        barrier = threading.Barrier(len(quantities))
        threads = [
            threading.Thread(target=self._consume, args=(qty, results, index, barrier))
            for index, qty in enumerate(quantities)
        ]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)
        return results

    def test_parallel_usage_never_overdraws_the_lot(self):
        results = self._run_parallel(["7.000", "7.000"])

        self.lot.refresh_from_db()
        self.assertGreaterEqual(self.lot.qty_remaining, Decimal("0.000"), results)
        self.assertEqual(sum(line.qty for line in MaterialUsageLine.objects.all()), Decimal("7.000"), results)
        self.assertEqual(self.lot.qty_remaining, Decimal("3.000"), results)
        self.assertEqual(sorted(result.split(":")[0] for result in results), ["ok", "rejected"])

    def test_parallel_usage_that_fits_is_fully_recorded(self):
        results = self._run_parallel(["4.000", "6.000"])

        self.lot.refresh_from_db()
        self.assertEqual(results, ["ok", "ok"])
        self.assertEqual(self.lot.qty_remaining, Decimal("0.000"))
        self.assertEqual(self.lot.status, MaterialLot.Status.DEPLETED)
        self.assertEqual(sum(line.qty for line in MaterialUsageLine.objects.all()), Decimal("10.000"))
