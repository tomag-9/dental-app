from rest_framework.test import APITestCase

from apps.jobs.dental import (
    CANONICAL_FDI_STORAGE_NOTE,
    expand_fdi_range,
    normalize_tooth_scope,
    validate_bridge_span,
    validate_tooth_range,
)


class DentalNotationTests(APITestCase):
    def test_expand_fdi_range_accepts_single_tooth_and_same_arch_ranges(self):
        self.assertEqual(expand_fdi_range("26"), ["26"])
        self.assertCountEqual(expand_fdi_range("45-47"), ["45", "46", "47"])
        self.assertCountEqual(expand_fdi_range("47–45"), ["45", "46", "47"])

    def test_expand_fdi_range_rejects_invalid_or_cross_arch_ranges(self):
        self.assertEqual(expand_fdi_range("99"), [])
        self.assertEqual(expand_fdi_range("18-48"), [])
        self.assertFalse(validate_tooth_range("31-11"))

    def test_bridge_span_requires_at_least_two_same_arch_teeth(self):
        self.assertTrue(validate_bridge_span("45-47"))
        self.assertFalse(validate_bridge_span("45"))
        self.assertFalse(validate_bridge_span("18-48"))

    def test_canonical_fdi_storage_note_documents_api_contract(self):
        self.assertIn("canonical FDI", CANONICAL_FDI_STORAGE_NOTE)
        self.assertIn("45-47", CANONICAL_FDI_STORAGE_NOTE)

    def test_normalize_tooth_scope_accepts_supported_scope_codes(self):
        self.assertEqual(normalize_tooth_scope("a"), "A")
        self.assertEqual(normalize_tooth_scope("U"), "U")
        self.assertEqual(normalize_tooth_scope("q4"), "Q4")
        self.assertEqual(normalize_tooth_scope("Q5"), "")
