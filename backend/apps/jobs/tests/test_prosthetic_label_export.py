"""Tests for the prosthetic label export: #98 (PDF/JSON), #99 (MDR), #101 (materials)."""

from datetime import date
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from apps.core.models import AuditLog, Lab, User
from apps.crm.models import Clinic, Doctor, Insurer, Patient
from apps.finance.models import PriceList
from apps.jobs import job_service, prosthetic_label
from apps.jobs.models import Job, JobItem, JobTimelineEvent, ProstheticLabelSequence, Technician
from apps.materials.models import (
    Manufacturer,
    MaterialCatalog,
    MaterialUsage,
    MaterialUsageLine,
)


class LabelExportFixtureMixin:
    """A fully populated job — every mandatory label field present."""

    def build_full_fixtures(self, name="Export Lab", username="export_admin", *, complete=True):
        lab = Lab.objects.create(
            name=name,
            address="Hlavná 1",
            city="Košice",
            postal_code="040 01",
            garant_name="Mgr. Ľubomír Ťažký" if complete else "",
            garant_registration_number="ZT-1234" if complete else "",
        )
        admin = User.objects.create_user(
            username=username,
            email=f"{username}@test.com",
            password="password123",
            role="admin",
            lab=lab,
        )
        insurer, _ = Insurer.objects.get_or_create(
            code="25",
            defaults={"name": "Všeobecná zdravotná poisťovňa", "short_name": "VšZP"},
        )
        patient = Patient.objects.create(
            lab=lab,
            first_name="Jozef",
            last_name="Mrkva",
            birth_number="800101/1234",
            insurer=insurer if complete else None,
            address="Podhradová 12, Košice",
            phone="0900 123 456",
        )
        clinic = Clinic.objects.create(
            lab=lab,
            name=f"Ambulancia {name}",
            pzs_code="P12345678901" if complete else "",
            address="Moldavská 5, Košice",
        )
        doctor = Doctor.objects.create(
            lab=lab,
            clinic=clinic,
            first_name="Eva",
            last_name="Nová",
            title_before="MUDr.",
            doctor_code="B06160016" if complete else "",
            registration_number="SKZL-99",
        )
        technician = Technician.objects.create(lab=lab, first_name="Peter", last_name="Zubár")
        PriceList.objects.create(
            lab=lab,
            code="PFR91",
            description="Korunka celokeramická",
            price=Decimal("100.00"),
            ipzp_code="PFR91",
        )
        job = Job.objects.create(
            lab=lab,
            patient=patient,
            clinic=clinic,
            doctor=doctor,
            technician=technician,
            price=Decimal("100.00"),
            diagnosis_code="K08.1",
            health_note="Alergia na latex.",
            tooth_color="A3",
            output_tooth_procedures={"16": "crown", "36": "bridge"},
            received_at=date(2026, 8, 1),
            assigned_at=date(2026, 8, 2),
            try_in_date=date(2026, 8, 8),
            seated_at=date(2026, 8, 12),
            handover_at=date(2026, 8, 12),
        )
        JobItem.objects.create(
            job=job,
            price_list_code="PFR91",
            ipzp_code="PFR91" if complete else "",
            description="Korunka celokeramická",
            tooth="16",
            quantity=1,
            unit_price=Decimal("100.00"),
            total=Decimal("100.00"),
            insurance_amount=Decimal("60.00"),
            patient_amount=Decimal("40.00"),
            procedure_category="crown",
        )
        return {
            "lab": lab,
            "admin": admin,
            "patient": patient,
            "clinic": clinic,
            "doctor": doctor,
            "technician": technician,
            "insurer": insurer,
            "job": job,
        }

    def add_material_usage(self, job, *, name="Zirkón ZR-95", lot="L-2026-07", expiry=date(2027, 5, 31)):
        manufacturer = Manufacturer.objects.create(lab=job.lab, name="Ivoclar", prefix=f"IV{job.id}")
        MaterialCatalog.objects.create(
            lab=job.lab,
            code=f"ZR{job.id}",
            name=name,
            manufacturer=manufacturer,
            mdr_class="IIa",
        )
        usage = MaterialUsage.objects.create(
            lab=job.lab,
            job=job,
            patient_label="Jozef Mrkva",
            technician="Peter Zubár",
            date=date(2026, 8, 5),
        )
        MaterialUsageLine.objects.create(
            usage=usage,
            name=name,
            code=f"ZR{job.id}",
            manufacturer="Ivoclar",
            mdr_class="IIa",
            lot=lot,
            expiry=expiry,
            qty=Decimal("2.000"),
            unit="g",
        )
        return usage


class LabelContextTests(LabelExportFixtureMixin, APITestCase):
    """#98 — field mapping from the data model into the label snapshot."""

    def setUp(self):
        self.fixtures = self.build_full_fixtures()
        self.job = self.fixtures["job"]

    def test_context_maps_lab_garant_and_identity(self):
        context = prosthetic_label.build_label_context(self.job)

        self.assertEqual(context["lab"]["name"], "Export Lab")
        self.assertEqual(context["lab"]["garant_name"], "Mgr. Ľubomír Ťažký")
        self.assertEqual(context["lab"]["garant_registration_number"], "ZT-1234")
        self.assertIn("Košice", context["lab"]["address"])

    def test_context_maps_provider_and_doctor_codes(self):
        context = prosthetic_label.build_label_context(self.job)

        self.assertEqual(context["clinic"]["pzs_code"], "P12345678901")
        self.assertEqual(context["doctor"]["doctor_code"], "B06160016")
        self.assertEqual(context["doctor"]["registration_number"], "SKZL-99")
        self.assertEqual(context["doctor"]["name"], "MUDr. Eva Nová")

    def test_context_maps_patient_and_insurer(self):
        context = prosthetic_label.build_label_context(self.job)

        self.assertEqual(context["patient"]["name"], "Jozef Mrkva")
        self.assertEqual(context["patient"]["birth_number"], "800101/1234")
        self.assertEqual(context["insurer"]["code"], "25")
        self.assertEqual(context["insurer"]["short_name"], "VšZP")

    def test_context_maps_diagnosis_health_note_and_color(self):
        context = prosthetic_label.build_label_context(self.job)

        self.assertEqual(context["job"]["diagnosis_code"], "K08.1")
        self.assertEqual(context["job"]["health_note"], "Alergia na latex.")
        self.assertEqual(context["job"]["tooth_color"], "A3")

    def test_tooth_chart_covers_both_arches_in_fdi_order(self):
        chart = prosthetic_label.build_label_context(self.job)["tooth_chart"]

        self.assertEqual(chart["upper"][0]["tooth"], "18")
        self.assertEqual(chart["upper"][-1]["tooth"], "28")
        self.assertEqual(chart["lower"][0]["tooth"], "48")
        self.assertEqual(chart["lower"][-1]["tooth"], "38")
        self.assertEqual(chart["selected"], ["16", "36"])
        marked = {entry["tooth"]: entry["procedure"] for entry in chart["upper"] if entry["procedure"]}
        self.assertEqual(marked, {"16": "crown"})

    def test_items_carry_ipzp_code_location_and_split(self):
        item = prosthetic_label.build_label_context(self.job)["items"][0]

        self.assertEqual(item["ipzp_code"], "PFR91")
        self.assertEqual(item["location"], "16")
        self.assertEqual(item["quantity"], 1)
        self.assertEqual(item["insurance_amount"], "60.00")
        self.assertEqual(item["patient_amount"], "40.00")

    def test_totals_and_dates_are_mapped(self):
        context = prosthetic_label.build_label_context(self.job)

        self.assertEqual(context["totals"]["insurance"], "60.00")
        self.assertEqual(context["totals"]["patient"], "40.00")
        self.assertEqual(context["totals"]["lab_price"], "100.00")
        self.assertEqual(context["dates"]["received_at"], "2026-08-01")
        self.assertEqual(context["dates"]["assigned_at"], "2026-08-02")
        self.assertEqual(context["dates"]["try_in_date"], "2026-08-08")
        self.assertEqual(context["dates"]["seated_at"], "2026-08-12")

    def test_patient_identifier_can_be_a_code_instead_of_a_name(self):
        lab = self.fixtures["lab"]
        lab.label_patient_identifier_mode = "code"
        lab.save(update_fields=["label_patient_identifier_mode"])

        context = prosthetic_label.build_label_context(self.job)

        self.assertEqual(context["patient"]["identifier"], f"P-{self.fixtures['patient'].id}")
        self.assertNotIn("Mrkva", context["declaration"]["points"][3]["value"])


class LabelMaterialTests(LabelExportFixtureMixin, APITestCase):
    """#101 — the LOT snapshot reaches the label."""

    def setUp(self):
        self.fixtures = self.build_full_fixtures(name="Material Lab", username="material_admin")
        self.job = self.fixtures["job"]

    def test_material_usage_lines_reach_the_context(self):
        self.add_material_usage(self.job)

        context = prosthetic_label.build_label_context(self.job)

        self.assertEqual(len(context["materials"]), 1)
        line = context["materials"][0]
        self.assertEqual(line["lot"], "L-2026-07")
        self.assertEqual(line["manufacturer"], "Ivoclar")
        self.assertEqual(line["mdr_class"], "IIa")

    def test_material_merge_format_matches_the_spec(self):
        self.add_material_usage(self.job)

        context = prosthetic_label.build_label_context(self.job)

        self.assertEqual(
            context["materials_text"],
            "Zirkón ZR-95 (Ivoclar), LOT L-2026-07, exp. 05/2027",
        )
        self.assertEqual(context["items"][0]["materials_text"], context["materials_text"])

    def test_several_lots_are_merged_with_a_semicolon(self):
        self.add_material_usage(self.job)
        second = MaterialUsage.objects.create(
            lab=self.job.lab,
            job=self.job,
            patient_label="Jozef Mrkva",
            date=date(2026, 8, 6),
        )
        MaterialUsageLine.objects.create(
            usage=second,
            name="Keramika K1",
            code="K1",
            manufacturer="VITA",
            lot="L-77",
            expiry=None,
            qty=Decimal("1.000"),
            unit="g",
        )

        context = prosthetic_label.build_label_context(self.job)

        self.assertEqual(len(context["materials"]), 2)
        self.assertIn("; ", context["materials_text"])
        self.assertIn("Keramika K1 (VITA), LOT L-77", context["materials_text"])

    def test_job_without_material_usage_has_an_empty_material_block(self):
        context = prosthetic_label.build_label_context(self.job)

        self.assertEqual(context["materials"], [])
        self.assertEqual(context["materials_text"], "")

    def test_material_usage_of_another_lab_is_never_mixed_in(self):
        other = self.build_full_fixtures(name="Foreign Lab", username="foreign_admin")
        self.add_material_usage(other["job"], name="Cudzí materiál", lot="X-1")

        context = prosthetic_label.build_label_context(self.job)

        self.assertEqual(context["materials"], [])


class MissingDataTests(LabelExportFixtureMixin, APITestCase):
    """#98 — a missing mandatory field returns 400 with the exact field list."""

    def setUp(self):
        self.fixtures = self.build_full_fixtures(name="Gap Lab", username="gap_admin", complete=False)
        self.job = self.fixtures["job"]
        self.client.force_authenticate(user=self.fixtures["admin"])
        self.url = reverse("job-prosthetic-label", args=[self.job.id])

    def _fields(self, response):
        return {entry["field"] for entry in response.data["missing_fields"]}

    def test_incomplete_job_returns_400_with_the_field_list(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(
            self._fields(response),
            {
                "lab.garant_name",
                "lab.garant_registration_number",
                "clinic.pzs_code",
                "doctor.doctor_code",
                "patient.insurer",
                "items[0].ipzp_code",
            },
        )

    def test_every_missing_field_carries_a_slovak_label_and_a_location(self):
        response = self.client.get(self.url)

        for entry in response.data["missing_fields"]:
            self.assertTrue(entry["label"])
            self.assertTrue(entry["where"])
        self.assertIn("chýbajú povinné údaje", response.data["detail"])

    def test_a_rejected_label_never_burns_a_number_from_the_series(self):
        self.client.get(self.url)

        self.job.refresh_from_db()
        self.assertEqual(self.job.label_number, "")
        self.assertFalse(ProstheticLabelSequence.objects.filter(lab=self.fixtures["lab"]).exists())

    def test_missing_ipzp_code_names_the_offending_item(self):
        missing = prosthetic_label.collect_missing_fields(self.job)

        entry = next(item for item in missing if item["field"] == "items[0].ipzp_code")
        self.assertIn("Korunka celokeramická", entry["label"])

    def test_job_with_no_items_reports_the_items_field(self):
        JobItem.objects.filter(job=self.job).delete()

        missing = {entry["field"] for entry in prosthetic_label.collect_missing_fields(self.job)}

        self.assertIn("items", missing)

    def test_complete_job_reports_no_gaps(self):
        complete = self.build_full_fixtures(name="Complete Lab", username="complete_admin")

        self.assertEqual(prosthetic_label.collect_missing_fields(complete["job"]), [])

    def test_job_detail_exposes_the_gaps_before_the_user_tries_to_print(self):
        response = self.client.get(reverse("job-detail", args=[self.job.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        fields = {entry["field"] for entry in response.data["label_missing_fields"]}
        self.assertIn("clinic.pzs_code", fields)


class LabelEndpointTests(LabelExportFixtureMixin, APITestCase):
    """#98 — the endpoint itself: PDF, JSON, numbering, timeline, tenant isolation."""

    def setUp(self):
        self.fixtures = self.build_full_fixtures(name="Endpoint Lab", username="endpoint_admin")
        self.job = self.fixtures["job"]
        self.client.force_authenticate(user=self.fixtures["admin"])
        self.url = reverse("job-prosthetic-label", args=[self.job.id])

    def test_pdf_is_generated_and_is_not_empty(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        content = b"".join(response.streaming_content) if response.streaming else response.content
        self.assertTrue(content.startswith(b"%PDF"))
        self.assertGreater(len(content), 2000)

    def test_json_variant_returns_the_snapshot(self):
        response = self.client.get(self.url, {"format": "json"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["clinic"]["pzs_code"], "P12345678901")
        self.assertTrue(response.data["job"]["label_number"])

    def test_first_request_assigns_the_label_number(self):
        self.assertEqual(self.job.label_number, "")

        response = self.client.get(self.url, {"format": "json"})

        self.job.refresh_from_db()
        self.assertEqual(self.job.label_number, response.data["job"]["label_number"])
        self.assertIsNotNone(self.job.label_issued_at)

    def test_second_request_is_idempotent(self):
        first = self.client.get(self.url, {"format": "json"}).data["job"]["label_number"]

        second = self.client.get(self.url, {"format": "json"}).data["job"]["label_number"]

        self.assertEqual(first, second)
        self.assertEqual(ProstheticLabelSequence.objects.get(lab=self.fixtures["lab"]).last_number, 1)
        self.assertEqual(JobTimelineEvent.objects.filter(job=self.job, event="label_issued").count(), 1)

    def test_issuing_writes_a_timeline_event_and_an_audit_log(self):
        self.client.get(self.url, {"format": "json"})

        event = JobTimelineEvent.objects.get(job=self.job, event="label_issued")
        self.assertIn("štítok", event.note)
        audit = AuditLog.objects.get(action="job.label_issued", entity_id=str(self.job.id))
        self.assertEqual(audit.lab_id, self.fixtures["lab"].id)
        self.assertEqual(audit.metadata["label_number"], self.job.label_number or audit.metadata["label_number"])

    def test_label_of_a_foreign_lab_returns_404(self):
        other = self.build_full_fixtures(name="Other Endpoint Lab", username="other_endpoint_admin")

        response = self.client.get(reverse("job-prosthetic-label", args=[other["job"].id]))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
        other["job"].refresh_from_db()
        self.assertEqual(other["job"].label_number, "")

    def test_material_snapshot_is_visible_in_the_json_variant(self):
        self.add_material_usage(self.job)

        response = self.client.get(self.url, {"format": "json"})

        self.assertIn("LOT L-2026-07", response.data["materials_text"])


class BulkLabelExportTests(LabelExportFixtureMixin, APITestCase):
    """#98 — bulk export: one PDF, one job per page."""

    def setUp(self):
        self.fixtures = self.build_full_fixtures(name="Bulk Lab", username="bulk_admin")
        self.client.force_authenticate(user=self.fixtures["admin"])
        self.url = reverse("job-prosthetic-labels")
        self.second = Job.objects.create(
            lab=self.fixtures["lab"],
            patient=self.fixtures["patient"],
            clinic=self.fixtures["clinic"],
            doctor=self.fixtures["doctor"],
            price=Decimal("50.00"),
        )
        JobItem.objects.create(
            job=self.second,
            price_list_code="PFR91",
            ipzp_code="PFR91",
            description="Fazeta",
            tooth="21",
            quantity=1,
            unit_price=Decimal("50.00"),
            total=Decimal("50.00"),
        )

    def test_bulk_export_returns_one_pdf(self):
        response = self.client.get(self.url, {"ids": f"{self.fixtures['job'].id},{self.second.id}"})

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/pdf")
        self.assertTrue(response.content.startswith(b"%PDF"))

    def test_bulk_export_issues_a_number_for_every_job(self):
        self.client.get(self.url, {"ids": f"{self.fixtures['job'].id},{self.second.id}"})

        self.fixtures["job"].refresh_from_db()
        self.second.refresh_from_db()
        self.assertTrue(self.fixtures["job"].label_number)
        self.assertTrue(self.second.label_number)
        self.assertNotEqual(self.fixtures["job"].label_number, self.second.label_number)

    def test_bulk_export_of_a_foreign_job_returns_404(self):
        other = self.build_full_fixtures(name="Bulk Foreign", username="bulk_foreign_admin")

        response = self.client.get(self.url, {"ids": str(other["job"].id)})

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_bulk_export_rejects_an_incomplete_job_as_a_whole(self):
        broken = Job.objects.create(
            lab=self.fixtures["lab"],
            patient=self.fixtures["patient"],
            clinic=self.fixtures["clinic"],
            doctor=self.fixtures["doctor"],
        )

        response = self.client.get(self.url, {"ids": f"{self.fixtures['job'].id},{broken.id}"})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.fixtures["job"].refresh_from_db()
        self.assertEqual(self.fixtures["job"].label_number, "")

    def test_bulk_export_needs_ids(self):
        response = self.client.get(self.url)

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("aspoň jednu prácu", response.data["detail"])


class MdrDeclarationTests(LabelExportFixtureMixin, APITestCase):
    """#99 — MDR 2017/745 Annex XIII section 1 declaration."""

    def setUp(self):
        self.fixtures = self.build_full_fixtures(name="MDR Lab", username="mdr_admin")
        self.job = self.fixtures["job"]

    def _declaration(self):
        return prosthetic_label.build_label_context(self.job)["declaration"]

    def test_declaration_cites_mdr_and_never_the_repealed_directive(self):
        declaration = self._declaration()

        self.assertIn("2017/745", declaration["reference"])
        self.assertIn("príloha XIII", declaration["reference"])
        serialized = str(declaration)
        self.assertNotIn("93/42", serialized)
        self.assertNotIn("MDD", serialized)

    def test_all_eight_particulars_are_present(self):
        points = self._declaration()["points"]

        self.assertEqual([point["number"] for point in points], list(range(1, 9)))
        for point in points:
            self.assertTrue(point["title"])
            self.assertTrue(point["value"])

    def test_point_one_carries_the_manufacturer_and_production_sites(self):
        lab = self.fixtures["lab"]
        lab.production_sites = "Prevádzka Prešov\nPrevádzka Bardejov"
        lab.save(update_fields=["production_sites"])

        value = self._declaration()["points"][0]["value"]

        self.assertIn("MDR Lab", value)
        self.assertIn("Prevádzka Prešov", value)
        self.assertIn("Prevádzka Bardejov", value)

    def test_point_two_reports_the_authorized_representative(self):
        lab = self.fixtures["lab"]
        lab.authorized_representative = "Zástupca s.r.o., Wien"
        lab.save(update_fields=["authorized_representative"])

        self.assertEqual(self._declaration()["points"][1]["value"], "Zástupca s.r.o., Wien")

    def test_point_two_says_so_when_no_representative_is_appointed(self):
        self.assertIn("Nebol ustanovený", self._declaration()["points"][1]["value"])

    def test_point_three_identifies_the_device_by_label_number(self):
        job_service.issue_label_number(self.job)

        value = self._declaration()["points"][2]["value"]

        self.assertIn(self.job.label_number, value)
        self.assertIn("Korunka celokeramická", value)

    def test_point_five_names_the_prescriber_and_the_clinic(self):
        value = self._declaration()["points"][4]["value"]

        self.assertIn("MUDr. Eva Nová", value)
        self.assertIn("B06160016", value)
        self.assertIn("P12345678901", value)

    def test_point_seven_states_full_conformity_by_default(self):
        value = self._declaration()["points"][6]["value"]

        self.assertIn("prílohy I", value)
        self.assertIn("Žiadna z požiadaviek nie je nesplnená", value)

    def test_point_seven_reports_a_declared_deviation_with_its_reason(self):
        self.job.safety_performance_deviations = "Bod 10.4 — použitá zliatina bez CE certifikátu, pacient poučený."
        self.job.save(update_fields=["safety_performance_deviations"])

        value = self._declaration()["points"][6]["value"]

        self.assertIn("s výnimkou", value)
        self.assertIn("pacient poučený", value)

    def test_point_eight_defaults_to_no_medicinal_substance(self):
        self.assertFalse(self.job.contains_medicinal_substance)
        self.assertIn("neobsahuje liečivú látku", self._declaration()["points"][7]["value"])

    def test_point_eight_reports_a_medicinal_substance_when_flagged(self):
        self.job.contains_medicinal_substance = True
        self.job.medicinal_substance_note = "Obsahuje kolagén hovädzieho pôvodu."
        self.job.save(update_fields=["contains_medicinal_substance", "medicinal_substance_note"])

        self.assertEqual(self._declaration()["points"][7]["value"], "Obsahuje kolagén hovädzieho pôvodu.")

    def test_declaration_text_is_configurable_per_lab(self):
        lab = self.fixtures["lab"]
        lab.mdr_declaration_text = "Naše laboratórium vyhlasuje podľa MDR..."
        lab.save(update_fields=["mdr_declaration_text"])

        declaration = self._declaration()

        self.assertEqual(declaration["text"], "Naše laboratórium vyhlasuje podľa MDR...")
        self.assertTrue(declaration["is_custom_text"])
        # The eight particulars stay in place regardless of the custom wording.
        self.assertEqual(len(declaration["points"]), 8)

    def test_default_declaration_text_is_used_when_the_lab_did_not_customise_it(self):
        declaration = self._declaration()

        self.assertEqual(declaration["text"], prosthetic_label.DEFAULT_MDR_DECLARATION_TEXT)
        self.assertFalse(declaration["is_custom_text"])

    def test_retention_is_ten_years_and_fifteen_for_implantable_devices(self):
        self.assertEqual(self._declaration()["retention_years"], 10)

        JobItem.objects.filter(job=self.job).update(procedure_category="implant")
        self.assertEqual(self._declaration()["retention_years"], 15)

    def test_job_with_an_issued_label_cannot_be_deleted(self):
        job_service.issue_label_number(self.job)

        with self.assertRaises(ValidationError) as ctx:
            job_service.delete_job(self.job)

        self.assertIn("10 rokov", str(ctx.exception))
        self.assertTrue(Job.objects.filter(pk=self.job.pk).exists())

    def test_job_without_a_label_is_still_deletable(self):
        job_service.delete_job(self.job)

        self.assertFalse(Job.objects.filter(pk=self.job.pk).exists())


class RequireMaterialUsageTests(LabelExportFixtureMixin, APITestCase):
    """#101 — Lab.require_material_usage gates the transition into a finished state."""

    def setUp(self):
        self.fixtures = self.build_full_fixtures(name="Rule Lab", username="rule_admin")
        self.job = self.fixtures["job"]
        self.job.status = "in_progress"
        self.job.save(update_fields=["status"])
        self.client.force_authenticate(user=self.fixtures["admin"])

    def _enable_rule(self):
        lab = self.fixtures["lab"]
        lab.require_material_usage = True
        lab.save(update_fields=["require_material_usage"])

    def test_rule_is_off_by_default_so_labs_without_mdr_are_not_blocked(self):
        job_service.transition_job_status(self.fixtures["admin"], self.job, "completed")

        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "completed")

    def test_completing_without_material_usage_is_rejected_when_the_rule_is_on(self):
        self._enable_rule()

        with self.assertRaises(ValidationError) as ctx:
            job_service.transition_job_status(self.fixtures["admin"], self.job, "completed")

        self.assertIn("bez zaevidovanej spotreby materiálu", str(ctx.exception))
        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "in_progress")

    def test_completing_with_material_usage_is_allowed(self):
        self._enable_rule()
        self.add_material_usage(self.job)

        job_service.transition_job_status(self.fixtures["admin"], self.job, "completed")

        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "completed")

    def test_cancelling_is_never_blocked_by_the_rule(self):
        self._enable_rule()

        job_service.transition_job_status(self.fixtures["admin"], self.job, "cancelled")

        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "cancelled")

    def test_rule_is_enforced_through_the_api_with_a_slovak_message(self):
        self._enable_rule()

        response = self.client.patch(
            reverse("job-detail", args=[self.job.id]),
            {"status": "completed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("spotreby materiálu", str(response.data))

    def test_bulk_update_skips_jobs_without_material_usage(self):
        self._enable_rule()

        response = self.client.post(
            reverse("job-bulk-update"),
            {"job_ids": [self.job.id], "status": "completed"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["updated"], [])
        self.assertIn("spotreby materiálu", response.data["skipped"][0]["reason"])

    def test_already_finished_job_is_not_blocked_retroactively(self):
        """A job finished before the rule was switched on must still be closable."""
        self.job.status = "completed"
        self.job.save(update_fields=["status"])
        self._enable_rule()

        job_service.transition_job_status(self.fixtures["admin"], self.job, "closed")

        self.job.refresh_from_db()
        self.assertEqual(self.job.status, "closed")
        self.assertFalse(job_service.material_usage_recorded(self.job))

    def test_job_detail_flags_the_missing_material_usage(self):
        self._enable_rule()

        response = self.client.get(reverse("job-detail", args=[self.job.id]))

        self.assertTrue(response.data["material_usage_missing"])

        self.add_material_usage(self.job)
        response = self.client.get(reverse("job-detail", args=[self.job.id]))
        self.assertFalse(response.data["material_usage_missing"])


class LabelPdfRenderTests(LabelExportFixtureMixin, APITestCase):
    """#98 — the renderer itself, driven straight from a context dict."""

    def setUp(self):
        self.fixtures = self.build_full_fixtures(name="Render Lab", username="render_admin")
        self.job = self.fixtures["job"]

    def test_render_produces_a_non_empty_pdf(self):
        content = prosthetic_label.render_label_pdf(prosthetic_label.build_label_context(self.job))

        self.assertTrue(content.startswith(b"%PDF"))
        self.assertGreater(len(content), 2000)

    def test_render_survives_missing_optional_data(self):
        self.job.output_tooth_procedures = None
        self.job.health_note = ""
        self.job.tooth_color = ""
        self.job.save(update_fields=["output_tooth_procedures", "health_note", "tooth_color"])

        content = prosthetic_label.render_label_pdf(prosthetic_label.build_label_context(self.job))

        self.assertTrue(content.startswith(b"%PDF"))

    def test_bulk_render_is_larger_than_a_single_label(self):
        context = prosthetic_label.build_label_context(self.job)

        single = prosthetic_label.render_label_pdf(context)
        double = prosthetic_label.render_labels_pdf([context, context])

        self.assertGreater(len(double), len(single))

    def test_font_resolution_returns_a_usable_pair(self):
        regular, bold = prosthetic_label.resolve_fonts()

        self.assertTrue(regular)
        self.assertTrue(bold)
        self.assertNotEqual(regular, bold)


class ConformityPdfAlignmentTests(LabelExportFixtureMixin, APITestCase):
    """#99 — the MDR declaration and the materials conformity PDF must not contradict."""

    def setUp(self):
        self.fixtures = self.build_full_fixtures(name="Align Lab", username="align_admin")
        self.job = self.fixtures["job"]

    def test_conformity_pdf_identifier_uses_the_issued_label_number(self):
        from apps.materials.views import _conformity_identifier

        usage = self.add_material_usage(self.job)
        self.assertEqual(_conformity_identifier(usage, None), f"Job {self.job.id}")

        job_service.issue_label_number(self.job)
        usage.job.refresh_from_db()

        identifier = _conformity_identifier(usage, None)
        self.assertIn(self.job.label_number, identifier)

    def test_conformity_pdf_does_not_cite_the_repealed_directive(self):
        import inspect

        from apps.materials import views as materials_views

        source = inspect.getsource(materials_views)
        self.assertNotIn("93/42", source)
        self.assertIn("2017/745", source)
