"""Tests for the Pay by Square encoder (issue #125).

The important property is not "a string was produced" but that the produced
string is a real Pay by Square payment order. Two independent checks give that
confidence:

1. ``test_decodes_reference_payload_from_another_implementation`` runs our
   decoder against a payload published by an unrelated third-party
   implementation (the PHP ``rikudou/pay-by-square-decoder`` README). If our
   understanding of the header/CRC/LZMA/base32hex pipeline were wrong, this
   would not decode with a valid CRC.
2. The round-trip tests then run our encoder through that validated decoder.
"""

from datetime import date
from decimal import Decimal

from django.test import SimpleTestCase

from apps.finance.pay_by_square import (
    NOTE_MAX_LENGTH,
    PayBySquareError,
    build_pay_by_square_payload,
    decode_pay_by_square_payload,
    normalize_iban,
    sanitize_note,
    sanitize_variable_symbol,
)

# Published by rikudou/pay-by-square-decoder (PHP), produced by an encoder we
# did not write. Encodes 100 EUR to CZ5530300000001325090010 / AIRACZPP,
# due 2020-03-16, VS 789, KS 123, SS 456, note "comment".
REFERENCE_PAYLOAD = (
    "0006Q0000UAT63HVES6GL5A5A0O9NSPEEHUHIEP70EG9LM6LU6EBNQ8KG6RB2N2LUIHMVTV51KQ77"
    "DGFC25KM2S9V46EQSN5GSD9J1N4BKT1L9ASVOOT1LPOMAO66IS2BHJDCNA4D9LFKG9MTFLISBD36O"
    "5CQQNJIBB2TJILQVVN684000"
)

VALID_IBAN = "SK3112000000198742637541"


class PayBySquareDecoderTests(SimpleTestCase):
    def test_decodes_reference_payload_from_another_implementation(self):
        decoded = decode_pay_by_square_payload(REFERENCE_PAYLOAD)

        self.assertTrue(decoded["crc_valid"])
        self.assertEqual(decoded["iban"], "CZ5530300000001325090010")
        self.assertEqual(decoded["swift"], "AIRACZPP")
        self.assertEqual(decoded["amount"], Decimal("100"))
        self.assertEqual(decoded["currency"], "EUR")
        self.assertEqual(decoded["due_date"], "20200316")
        self.assertEqual(decoded["variable_symbol"], "789")
        self.assertEqual(decoded["constant_symbol"], "123")
        self.assertEqual(decoded["specific_symbol"], "456")
        self.assertEqual(decoded["note"], "comment")

    def test_rejects_non_pay_by_square_text(self):
        # This is exactly the free-text payload the invoice used to encode.
        with self.assertRaises(PayBySquareError):
            decode_pay_by_square_payload("INVOICE|INV-2026-0001|120.00|issued")

    def test_rejects_truncated_payload(self):
        with self.assertRaises(PayBySquareError):
            decode_pay_by_square_payload(REFERENCE_PAYLOAD[:40])


class PayBySquareRoundTripTests(SimpleTestCase):
    def test_round_trip_preserves_amount_iban_and_variable_symbol(self):
        payload = build_pay_by_square_payload(
            iban=VALID_IBAN,
            amount=Decimal("1234.56"),
            variable_symbol="INV-2026-0042",
            note="Faktura INV-2026-0042",
            beneficiary_name="Zubne Laboratorium",
            swift="GIBASKBX",
            due_date=date(2026, 8, 31),
        )

        decoded = decode_pay_by_square_payload(payload)

        self.assertTrue(decoded["crc_valid"])
        self.assertEqual(decoded["header"], "0000")
        self.assertEqual(decoded["amount"], Decimal("1234.56"))
        self.assertEqual(decoded["currency"], "EUR")
        self.assertEqual(decoded["iban"], VALID_IBAN)
        self.assertEqual(decoded["swift"], "GIBASKBX")
        self.assertEqual(decoded["variable_symbol"], "20260042")
        self.assertEqual(decoded["due_date"], "20260831")
        self.assertEqual(decoded["note"], "Faktura INV-2026-0042")
        self.assertEqual(decoded["beneficiary_name"], "Zubne Laboratorium")
        # Single payment order to a single account.
        self.assertEqual(decoded["payment_count"], "1")
        self.assertEqual(decoded["payment_options"], "1")
        self.assertEqual(decoded["bank_account_count"], "1")

    def test_round_trip_normalizes_spaced_iban_and_rounds_amount(self):
        payload = build_pay_by_square_payload(
            iban="SK31 1200 0000 1987 4263 7541",
            amount=Decimal("10.005"),
            variable_symbol="7",
        )

        decoded = decode_pay_by_square_payload(payload)

        self.assertEqual(decoded["iban"], VALID_IBAN)
        self.assertEqual(decoded["amount"], Decimal("10.01"))
        self.assertEqual(decoded["variable_symbol"], "7")

    def test_round_trip_strips_diacritics_from_note(self):
        payload = build_pay_by_square_payload(
            iban=VALID_IBAN,
            amount=Decimal("5"),
            variable_symbol="1",
            note="Úhrada faktúry za zubnú náhradu",
            beneficiary_name="Zubné laboratórium Košice",
        )

        decoded = decode_pay_by_square_payload(payload)

        self.assertEqual(decoded["note"], "Uhrada faktury za zubnu nahradu")
        self.assertEqual(decoded["beneficiary_name"], "Zubne laboratorium Kosice")

    def test_round_trip_truncates_overlong_note(self):
        payload = build_pay_by_square_payload(
            iban=VALID_IBAN,
            amount=Decimal("5"),
            variable_symbol="1",
            note="x" * (NOTE_MAX_LENGTH + 50),
        )

        decoded = decode_pay_by_square_payload(payload)

        self.assertEqual(decoded["note"], "x" * NOTE_MAX_LENGTH)

    def test_zero_amount_is_encodable(self):
        payload = build_pay_by_square_payload(iban=VALID_IBAN, amount=Decimal("0"), variable_symbol="1")

        self.assertEqual(decode_pay_by_square_payload(payload)["amount"], Decimal("0"))


class PayBySquareValidationTests(SimpleTestCase):
    def test_normalize_iban_accepts_valid_iban(self):
        self.assertEqual(normalize_iban("sk31 1200 0000 1987 4263 7541"), VALID_IBAN)

    def test_normalize_iban_rejects_bad_checksum(self):
        with self.assertRaises(PayBySquareError) as ctx:
            normalize_iban("SK3212000000198742637541")
        self.assertIn("kontroln", str(ctx.exception))

    def test_normalize_iban_rejects_garbage(self):
        for bad in ("", "not-an-iban", "SK31", "1234567890123456"):
            with self.assertRaises(PayBySquareError):
                normalize_iban(bad)

    def test_negative_amount_is_rejected(self):
        with self.assertRaises(PayBySquareError) as ctx:
            build_pay_by_square_payload(iban=VALID_IBAN, amount=Decimal("-1"), variable_symbol="1")
        self.assertIn("záporná", str(ctx.exception))

    def test_invalid_swift_is_rejected(self):
        with self.assertRaises(PayBySquareError):
            build_pay_by_square_payload(iban=VALID_IBAN, amount=Decimal("1"), variable_symbol="1", swift="NOPE")

    def test_variable_symbol_keeps_last_ten_digits(self):
        self.assertEqual(sanitize_variable_symbol("INV-2026-0042"), "20260042")
        self.assertEqual(sanitize_variable_symbol("1234567890123"), "4567890123")
        self.assertEqual(sanitize_variable_symbol("ABC"), "")

    def test_sanitize_note_removes_tabs_and_newlines(self):
        # A stray tab would corrupt the field separator of the record.
        self.assertEqual(sanitize_note("Faktura\t123\nsplatna"), "Faktura 123 splatna")
