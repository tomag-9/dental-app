"""Tests for the prosthetic label data model: #94, #95, #96, #97."""

import importlib
import threading
from datetime import date
from decimal import Decimal
from unittest import skipUnless

from django.db import connection, connections
from django.test import TransactionTestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import PriceList
from apps.jobs import job_service
from apps.jobs.models import Job, JobItem, JobTimelineEvent, ProstheticLabelSequence, Technician


class FakeAppRegistry:
    """Minimal stand-in for the historical app registry passed to RunPython."""

    _MODELS = {("jobs", "Job"): Job}

    def get_model(self, app_label, model_name):
        return self._MODELS[(app_label, model_name)]


class LabelTestMixin:
    def build_lab_fixtures(self, name="Label Lab", username="label_admin", **lab_kwargs):
        lab = Lab.objects.create(name=name, **lab_kwargs)
        admin = User.objects.create_user(
            username=username,
            email=f"{username}@test.com",
            password="password123",
            role="admin",
            lab=lab,
        )
        patient = Patient.objects.create(lab=lab, first_name="Jozef", last_name="Mrkva")
        clinic = Clinic.objects.create(lab=lab, name=f"Clinic {name}")
        doctor = Doctor.objects.create(lab=lab, first_name="Eva", last_name="Nová")
        technician = Technician.objects.create(lab=lab, first_name="Peter", last_name="Zubár")
        price = PriceList.objects.create(
            lab=lab,
            code="PFR91",
            description="Dlaha na bielenie",
            price=Decimal("100.00"),
            ipzp_code="PFR91",
            default_insurance_amount=Decimal("60.00"),
            default_patient_amount=Decimal("40.00"),
        )
        job = Job.objects.create(
            lab=lab,
            patient=patient,
            clinic=clinic,
            doctor=doctor,
            technician=technician,
            price=Decimal("100.00"),
        )
        return {
            "lab": lab,
            "admin": admin,
            "patient": patient,
            "clinic": clinic,
            "doctor": doctor,
            "technician": technician,
            "price": price,
            "job": job,
        }


class DiagnosisFieldsTests(LabelTestMixin, APITestCase):
    """#94 - MKCH-10 diagnosis code and health note."""

    def setUp(self):
        self.fixtures = self.build_lab_fixtures()
        self.client.force_authenticate(user=self.fixtures["admin"])

    def _payload(self, **overrides):
        payload = {
            "patient": self.fixtures["patient"].id,
            "clinic": self.fixtures["clinic"].id,
            "doctor": self.fixtures["doctor"].id,
        }
        payload.update(overrides)
        return payload

    def test_job_defaults_have_empty_diagnosis_fields(self):
        job = self.fixtures["job"]
        self.assertEqual(job.diagnosis_code, "")
        self.assertEqual(job.health_note, "")

    def test_valid_diagnosis_code_is_stored_uppercase(self):
        response = self.client.post(
            reverse("job-list"),
            self._payload(diagnosis_code="k08.9", health_note="Pacient je diabetik."),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        job = Job.objects.get(id=response.data["id"])
        self.assertEqual(job.diagnosis_code, "K08.9")
        self.assertEqual(job.health_note, "Pacient je diabetik.")

    def test_diagnosis_code_without_decimal_part_is_accepted(self):
        response = self.client.post(
            reverse("job-list"),
            self._payload(diagnosis_code="K08"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)

    def test_invalid_diagnosis_code_is_rejected(self):
        response = self.client.post(
            reverse("job-list"),
            self._payload(diagnosis_code="XX-123"),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("MKCH-10", str(response.data))

    def test_health_note_is_separate_from_technician_description(self):
        response = self.client.post(
            reverse("job-list"),
            self._payload(
                health_note="Alergia na latex.",
                description="Prosím o zhotovenie dláh na bielenie.",
            ),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        job = Job.objects.get(id=response.data["id"])
        self.assertEqual(job.health_note, "Alergia na latex.")
        self.assertEqual(job.description, "Prosím o zhotovenie dláh na bielenie.")


class LabelNumberTests(LabelTestMixin, APITestCase):
    """#95 - per-lab prosthetic label number series."""

    def setUp(self):
        self.fixtures = self.build_lab_fixtures()
        self.other = self.build_lab_fixtures(name="Other Lab", username="other_admin")

    def test_first_label_number_uses_lab_prefix_and_start_number(self):
        lab = self.fixtures["lab"]
        lab.label_prefix = "ZT"
        lab.label_start_number = 535
        lab.save(update_fields=["label_prefix", "label_start_number"])

        number = job_service.issue_label_number(self.fixtures["job"])

        self.assertEqual(number, "ZT000535")
        self.assertEqual(ProstheticLabelSequence.objects.get(lab=lab).last_number, 535)

    def test_numbers_are_sequential_within_a_lab(self):
        lab = self.fixtures["lab"]
        second_job = Job.objects.create(
            lab=lab,
            patient=self.fixtures["patient"],
            clinic=self.fixtures["clinic"],
        )

        first = job_service.issue_label_number(self.fixtures["job"])
        second = job_service.issue_label_number(second_job)

        self.assertNotEqual(first, second)
        self.assertEqual(int(second) - int(first), 1)

    def test_repeated_generation_keeps_the_same_number(self):
        job = self.fixtures["job"]

        first = job_service.issue_label_number(job)
        issued_at = Job.objects.get(pk=job.pk).label_issued_at
        second = job_service.issue_label_number(job)

        self.assertEqual(first, second)
        self.assertEqual(Job.objects.get(pk=job.pk).label_issued_at, issued_at)
        self.assertEqual(ProstheticLabelSequence.objects.get(lab=self.fixtures["lab"]).last_number, 1)

    def test_label_issued_at_is_set_on_first_generation(self):
        job = self.fixtures["job"]
        self.assertIsNone(job.label_issued_at)

        job_service.issue_label_number(job)

        self.assertIsNotNone(Job.objects.get(pk=job.pk).label_issued_at)

    def test_series_is_independent_per_lab(self):
        first = job_service.issue_label_number(self.fixtures["job"])
        other = job_service.issue_label_number(self.other["job"])

        self.assertEqual(first, other)
        self.assertEqual(ProstheticLabelSequence.objects.count(), 2)

    def test_label_number_is_read_only_over_the_api(self):
        job = self.fixtures["job"]
        self.client.force_authenticate(user=self.fixtures["admin"])

        response = self.client.patch(
            reverse("job-detail", args=[job.id]),
            {"label_number": "HACKED"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        self.assertEqual(Job.objects.get(pk=job.pk).label_number, "")


class LabelNumberConcurrencyTests(LabelTestMixin, TransactionTestCase):
    """#95 - two concurrent callers must never receive the same label number."""

    reset_sequences = True

    @skipUnless(
        connection.vendor == "postgresql",
        "Row-level locking is only meaningful on PostgreSQL (SQLite locks the whole table).",
    )
    def test_concurrent_generation_yields_distinct_numbers(self):
        fixtures = self.build_lab_fixtures(name="Concurrent Lab", username="concurrent_admin")
        lab = fixtures["lab"]
        jobs = [Job.objects.create(lab=lab, patient=fixtures["patient"], clinic=fixtures["clinic"]) for _ in range(2)]
        results = []
        errors = []
        lock = threading.Lock()
        barrier = threading.Barrier(len(jobs))

        def worker(job):
            try:
                barrier.wait(timeout=10)
                number = job_service.issue_label_number(job)
                with lock:
                    results.append(number)
            except Exception as exc:  # pragma: no cover - surfaced through the assertion below
                with lock:
                    errors.append(exc)
            finally:
                connections.close_all()

        threads = [threading.Thread(target=worker, args=(job,)) for job in jobs]
        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join(timeout=30)

        self.assertEqual(errors, [])
        self.assertEqual(len(set(results)), 2, results)
        self.assertEqual(ProstheticLabelSequence.objects.get(lab=lab).last_number, 2)
        self.assertEqual(
            len({job.label_number for job in Job.objects.filter(lab=lab).exclude(label_number="")}),
            2,
        )


class PaymentSplitTests(LabelTestMixin, APITestCase):
    """#96 - IPZP code and insurance/patient split of the item price."""

    def setUp(self):
        self.fixtures = self.build_lab_fixtures()
        self.client.force_authenticate(user=self.fixtures["admin"])
        self.url = reverse("job-list")

    def _payload(self, item_overrides=None):
        item = {"price_list_code": "PFR91", "quantity": 1}
        item.update(item_overrides or {})
        return {
            "patient": self.fixtures["patient"].id,
            "clinic": self.fixtures["clinic"].id,
            "items": [item],
        }

    def test_split_is_prefilled_from_price_list_defaults(self):
        response = self.client.post(self.url, self._payload(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        item = JobItem.objects.get(job_id=response.data["id"])
        self.assertEqual(item.ipzp_code, "PFR91")
        self.assertEqual(item.insurance_amount, Decimal("60.00"))
        self.assertEqual(item.patient_amount, Decimal("40.00"))

    def test_defaults_scale_with_quantity(self):
        response = self.client.post(self.url, self._payload({"quantity": 2}), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        item = JobItem.objects.get(job_id=response.data["id"])
        self.assertEqual(item.total, Decimal("200.00"))
        self.assertEqual(item.insurance_amount, Decimal("120.00"))
        self.assertEqual(item.patient_amount, Decimal("80.00"))

    def test_matching_explicit_split_is_accepted(self):
        response = self.client.post(
            self.url,
            self._payload({"insurance_amount": "70.00", "patient_amount": "30.00"}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        item = JobItem.objects.get(job_id=response.data["id"])
        self.assertEqual(item.insurance_amount, Decimal("70.00"))
        self.assertEqual(item.patient_amount, Decimal("30.00"))

    def test_mismatched_split_is_rejected(self):
        response = self.client.post(
            self.url,
            self._payload({"insurance_amount": "70.00", "patient_amount": "10.00"}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("dokopy cenu položky", str(response.data))
        self.assertFalse(JobItem.objects.exists())

    def test_one_cent_rounding_difference_is_tolerated(self):
        insurance, patient = job_service.resolve_payment_split(
            Decimal("100.00"),
            insurance_amount=Decimal("66.66"),
            patient_amount=Decimal("33.35"),
        )

        self.assertEqual(insurance, Decimal("66.66"))
        self.assertEqual(patient, Decimal("33.35"))

    def test_two_cent_difference_is_rejected(self):
        with self.assertRaises(Exception) as ctx:
            job_service.resolve_payment_split(
                Decimal("100.00"),
                insurance_amount=Decimal("66.00"),
                patient_amount=Decimal("33.00"),
            )

        self.assertIn("dokopy cenu položky", str(ctx.exception))

    def test_negative_share_is_rejected(self):
        with self.assertRaises(Exception) as ctx:
            job_service.resolve_payment_split(Decimal("100.00"), insurance_amount=Decimal("150.00"))

        self.assertIn("záporné", str(ctx.exception))

    def test_only_insurance_given_derives_the_patient_share(self):
        response = self.client.post(
            self.url,
            self._payload({"insurance_amount": "25.00"}),
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED, response.data)
        item = JobItem.objects.get(job_id=response.data["id"])
        self.assertEqual(item.insurance_amount, Decimal("25.00"))
        self.assertEqual(item.patient_amount, Decimal("75.00"))

    def test_price_change_without_split_change_is_recomputed(self):
        """Editing quantity (and thus total) keeps the invariant instead of silently breaking it."""
        create = self.client.post(
            self.url,
            self._payload({"insurance_amount": "60.00", "patient_amount": "40.00"}),
            format="json",
        )
        job_id = create.data["id"]

        response = self.client.patch(
            reverse("job-detail", args=[job_id]),
            {"items": [{"price_list_code": "PFR91", "quantity": 3, "insurance_amount": "60.00"}]},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        item = JobItem.objects.get(job_id=job_id)
        self.assertEqual(item.total, Decimal("300.00"))
        self.assertEqual(item.insurance_amount, Decimal("60.00"))
        self.assertEqual(item.patient_amount, Decimal("240.00"))

    def test_stale_split_after_price_change_is_rejected(self):
        create = self.client.post(
            self.url,
            self._payload({"insurance_amount": "60.00", "patient_amount": "40.00"}),
            format="json",
        )
        job_id = create.data["id"]

        response = self.client.patch(
            reverse("job-detail", args=[job_id]),
            {
                "items": [
                    {
                        "price_list_code": "PFR91",
                        "quantity": 3,
                        "insurance_amount": "60.00",
                        "patient_amount": "40.00",
                    }
                ]
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        item = JobItem.objects.get(job_id=job_id)
        self.assertEqual(item.total, Decimal("100.00"))

    def test_job_level_totals_are_derived(self):
        response = self.client.post(self.url, self._payload({"quantity": 2}), format="json")
        job = Job.objects.get(id=response.data["id"])

        self.assertEqual(job.insurance_total, Decimal("120.00"))
        self.assertEqual(job.patient_total, Decimal("80.00"))
        self.assertEqual(job.insurance_total + job.patient_total, job.price)

    def test_totals_are_exposed_on_the_job_detail(self):
        created = self.client.post(self.url, self._payload(), format="json")

        response = self.client.get(reverse("job-detail", args=[created.data["id"]]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(response.data["insurance_total"]), Decimal("60.00"))
        self.assertEqual(Decimal(response.data["patient_total"]), Decimal("40.00"))


class LifecycleDateTests(LabelTestMixin, APITestCase):
    """#97 - explicit lifecycle dates and automatic completion date."""

    def setUp(self):
        self.fixtures = self.build_lab_fixtures()
        self.client.force_authenticate(user=self.fixtures["admin"])

    def test_new_date_fields_accept_values(self):
        job = self.fixtures["job"]
        payload = {
            "received_at": "2026-08-01",
            "assigned_at": "2026-08-02",
            "seated_at": "2026-08-10",
            "handover_at": "2026-08-11",
        }

        response = self.client.patch(reverse("job-detail", args=[job.id]), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        job.refresh_from_db()
        self.assertEqual(str(job.received_at), "2026-08-01")
        self.assertEqual(str(job.assigned_at), "2026-08-02")
        self.assertEqual(str(job.seated_at), "2026-08-10")
        self.assertEqual(str(job.handover_at), "2026-08-11")

    def test_completed_at_is_filled_on_transition_to_completed(self):
        job = self.fixtures["job"]
        job.status = "in_progress"
        job.save(update_fields=["status"])

        job_service.transition_job_status(self.fixtures["admin"], job, "completed")

        job.refresh_from_db()
        self.assertEqual(job.completed_at, timezone.localdate())

    def test_completion_date_change_is_recorded_in_the_timeline(self):
        job = self.fixtures["job"]
        job.status = "in_progress"
        job.save(update_fields=["status"])

        job_service.transition_job_status(self.fixtures["admin"], job, "completed")

        event = JobTimelineEvent.objects.filter(job=job, event="status_changed").first()
        self.assertIsNotNone(event)
        self.assertIn("completed_at", event.changed_fields or {})

    def test_completed_at_is_not_overwritten_on_later_transitions(self):
        job = self.fixtures["job"]
        job.status = "in_progress"
        job.save(update_fields=["status"])
        job_service.transition_job_status(self.fixtures["admin"], job, "completed")
        job.refresh_from_db()
        original = job.completed_at

        job_service.transition_job_status(self.fixtures["admin"], job, "closed")

        job.refresh_from_db()
        self.assertEqual(job.completed_at, original)

    def test_completed_at_is_filled_when_status_changes_through_the_api(self):
        job = self.fixtures["job"]
        job.status = "in_progress"
        job.save(update_fields=["status"])

        response = self.client.patch(
            reverse("job-detail", args=[job.id]),
            {"status": "completed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        job.refresh_from_db()
        self.assertEqual(job.completed_at, timezone.localdate())

    def test_cancelled_job_keeps_completion_date_empty(self):
        job = self.fixtures["job"]

        job_service.transition_job_status(self.fixtures["admin"], job, "cancelled")

        job.refresh_from_db()
        self.assertIsNone(job.completed_at)

    def test_backfill_migration_copies_legacy_dates(self):
        """The 0015 data migration copies start_date/end_date into the new fields."""
        migration = importlib.import_module("apps.jobs.migrations.0015_backfill_job_lifecycle_dates")
        legacy = Job.objects.create(
            lab=self.fixtures["lab"],
            patient=self.fixtures["patient"],
            clinic=self.fixtures["clinic"],
            start_date=date(2026, 3, 1),
            end_date=date(2026, 3, 20),
        )
        untouched = Job.objects.create(
            lab=self.fixtures["lab"],
            patient=self.fixtures["patient"],
            clinic=self.fixtures["clinic"],
            start_date=date(2026, 4, 1),
            assigned_at=date(2026, 4, 9),
        )

        migration.copy_legacy_dates(FakeAppRegistry(), None)

        legacy.refresh_from_db()
        untouched.refresh_from_db()
        self.assertEqual(legacy.assigned_at, date(2026, 3, 1))
        self.assertEqual(legacy.completed_at, date(2026, 3, 20))
        self.assertIsNone(untouched.completed_at)
        self.assertEqual(untouched.assigned_at, date(2026, 4, 9))

    def test_legacy_dates_are_still_writable(self):
        """start_date/end_date are deprecated but must keep working for the frontend."""
        job = self.fixtures["job"]

        response = self.client.patch(
            reverse("job-detail", args=[job.id]),
            {"start_date": "2026-07-01", "end_date": "2026-07-05"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK, response.data)
        job.refresh_from_db()
        self.assertEqual(str(job.start_date), "2026-07-01")
        self.assertEqual(str(job.end_date), "2026-07-05")
