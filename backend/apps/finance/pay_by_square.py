"""Pay by Square — slovenský štandard pre platobné QR kódy.

The QR payload is *not* free text: it is a tab-separated payment record that is
CRC32-checksummed, LZMA1-compressed, prefixed with a 4-byte header and finally
encoded with the base32hex alphabet. Bank apps reject anything else, so this
module wraps the third-party ``pay-by-square`` encoder (MIT, pure stdlib) and
adds the input validation the invoice flow needs.

``decode_pay_by_square_payload`` reverses the pipeline. It exists so the encoder
can be verified end-to-end (see ``tests/test_pay_by_square.py``), which also
lets us decode payloads produced by other implementations of the standard.
"""

import binascii
import lzma
import unicodedata
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

import pay_by_square as _pay_by_square_lib

__all__ = [
    "PayBySquareError",
    "build_pay_by_square_payload",
    "decode_pay_by_square_payload",
    "normalize_iban",
    "sanitize_note",
    "sanitize_variable_symbol",
]

# base32hex ("extended hex") alphabet used by the Pay by Square standard.
_BASE32HEX_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUV"

_LZMA_FILTERS = [
    {
        "id": lzma.FILTER_LZMA1,
        "lc": 3,
        "lp": 0,
        "pb": 2,
        "dict_size": 128 * 1024,
    }
]

# Field order of the tab-separated payment record (Pay by Square 1.1.0).
_FIELDS = (
    "invoice_id",
    "payment_count",
    "payment_options",
    "amount",
    "currency",
    "due_date",
    "variable_symbol",
    "constant_symbol",
    "specific_symbol",
    "reference",
    "note",
    "bank_account_count",
    "iban",
    "swift",
    "standing_order",
    "direct_debit",
    "beneficiary_name",
    "beneficiary_address_1",
    "beneficiary_address_2",
)

VARIABLE_SYMBOL_MAX_LENGTH = 10
CONSTANT_SYMBOL_MAX_LENGTH = 4
SPECIFIC_SYMBOL_MAX_LENGTH = 10
NOTE_MAX_LENGTH = 140
BENEFICIARY_NAME_MAX_LENGTH = 70
MAX_AMOUNT = Decimal("9999999999.99")


class PayBySquareError(ValueError):
    """Vstupné údaje sa nedajú zakódovať do platobného QR kódu."""


def _to_ascii(value):
    """Strip diacritics — payment fields must survive banks' ASCII pipelines."""
    normalized = unicodedata.normalize("NFKD", str(value or ""))
    return "".join(char for char in normalized if not unicodedata.combining(char))


def normalize_iban(value):
    """Validate an IBAN (ISO 13616 mod-97) and return it without spaces."""
    iban = "".join(str(value or "").split()).upper()
    if not iban:
        raise PayBySquareError("Chýba IBAN účtu laboratória.")
    if not iban.isalnum() or not (15 <= len(iban) <= 34):
        raise PayBySquareError(f"IBAN '{iban}' nemá platný formát.")
    if not iban[:2].isalpha() or not iban[2:4].isdigit():
        raise PayBySquareError(f"IBAN '{iban}' nemá platný formát.")

    rearranged = iban[4:] + iban[:4]
    digits = "".join(str(int(char, 36)) for char in rearranged)
    if int(digits) % 97 != 1:
        raise PayBySquareError(f"IBAN '{iban}' má neplatné kontrolné číslice.")
    return iban


def sanitize_variable_symbol(value, max_length=VARIABLE_SYMBOL_MAX_LENGTH):
    """Keep digits only; invoice numbers such as ``2026-0042`` become ``20260042``.

    Symbols longer than the standard allows are truncated from the left so the
    least significant (most distinguishing) digits survive.
    """
    digits = "".join(char for char in str(value or "") if char.isdigit())
    return digits[-max_length:]


def sanitize_note(value, max_length=NOTE_MAX_LENGTH):
    """Transliterate to ASCII, collapse whitespace and enforce the length limit."""
    text = " ".join(_to_ascii(value).split())
    text = text.replace("\t", " ")
    return text[:max_length]


def _normalize_amount(amount):
    try:
        value = Decimal(str(amount if amount is not None else "0"))
    except (InvalidOperation, ValueError) as exc:
        raise PayBySquareError(f"Suma '{amount}' nie je platné číslo.") from exc
    if value.is_nan() or value.is_infinite():
        raise PayBySquareError(f"Suma '{amount}' nie je platné číslo.")
    if value < 0:
        raise PayBySquareError("Suma platby nemôže byť záporná.")
    if value > MAX_AMOUNT:
        raise PayBySquareError("Suma platby presahuje limit platobného QR kódu.")
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def build_pay_by_square_payload(
    *,
    iban,
    amount,
    variable_symbol,
    note="",
    beneficiary_name="",
    swift="",
    due_date=None,
    currency="EUR",
    constant_symbol="",
    specific_symbol="",
):
    """Build the Pay by Square string that goes into the invoice QR code.

    Raises :class:`PayBySquareError` with a Slovak message when the payment data
    cannot produce a valid payment order — never a silently broken payload.
    """
    normalized_iban = normalize_iban(iban)
    normalized_amount = _normalize_amount(amount)

    currency_code = _to_ascii(currency).upper().strip() or "EUR"
    if len(currency_code) != 3 or not currency_code.isalpha():
        raise PayBySquareError(f"Mena '{currency}' nie je platný ISO 4217 kód.")

    swift_code = "".join(_to_ascii(swift).split()).upper()
    if swift_code and (not swift_code.isalnum() or len(swift_code) not in (8, 11)):
        raise PayBySquareError(f"BIC/SWIFT '{swift}' nemá platný formát.")

    return _pay_by_square_lib.generate(
        amount=float(normalized_amount),
        iban=normalized_iban,
        swift=swift_code,
        date=due_date,
        beneficiary_name=sanitize_note(beneficiary_name, BENEFICIARY_NAME_MAX_LENGTH),
        currency=currency_code,
        variable_symbol=sanitize_variable_symbol(variable_symbol),
        constant_symbol=sanitize_variable_symbol(constant_symbol, CONSTANT_SYMBOL_MAX_LENGTH),
        specific_symbol=sanitize_variable_symbol(specific_symbol, SPECIFIC_SYMBOL_MAX_LENGTH),
        note=sanitize_note(note),
    )


def decode_pay_by_square_payload(payload):
    """Decode a Pay by Square string back into its payment fields.

    Returns a dict with the record fields plus ``crc_valid`` and the raw
    ``header``. Raises :class:`PayBySquareError` on malformed input.
    """
    code = str(payload or "").strip().upper()
    if not code or any(char not in _BASE32HEX_ALPHABET for char in code):
        raise PayBySquareError("Reťazec nie je platný Pay by Square kód.")

    bits = "".join(bin(_BASE32HEX_ALPHABET.index(char))[2:].zfill(5) for char in code)
    raw = bytes(int(bits[index : index + 8], 2) for index in range(0, len(bits) // 8 * 8, 8))
    if len(raw) < 5:
        raise PayBySquareError("Reťazec nie je platný Pay by Square kód.")

    header = raw[:2]
    uncompressed_length = int.from_bytes(raw[2:4], "little")
    decompressor = lzma.LZMADecompressor(format=lzma.FORMAT_RAW, filters=_LZMA_FILTERS)
    try:
        body = decompressor.decompress(raw[4:], max_length=uncompressed_length)
    except lzma.LZMAError as exc:
        raise PayBySquareError("Pay by Square kód sa nepodarilo dekomprimovať.") from exc
    if len(body) != uncompressed_length:
        raise PayBySquareError("Pay by Square kód má nekonzistentnú dĺžku dát.")

    checksum, record = body[:4], body[4:]
    crc_valid = binascii.crc32(record).to_bytes(4, "little") == checksum

    values = record.decode("utf-8").split("\t")
    values += [""] * (len(_FIELDS) - len(values))
    decoded = dict(zip(_FIELDS, values, strict=False))
    decoded["header"] = header.hex()
    decoded["crc_valid"] = crc_valid
    decoded["amount"] = Decimal(decoded["amount"]) if decoded["amount"] else Decimal("0")
    return decoded
