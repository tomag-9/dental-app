FDI_UPPER = [
    "18",
    "17",
    "16",
    "15",
    "14",
    "13",
    "12",
    "11",
    "21",
    "22",
    "23",
    "24",
    "25",
    "26",
    "27",
    "28",
]
FDI_LOWER = [
    "48",
    "47",
    "46",
    "45",
    "44",
    "43",
    "42",
    "41",
    "31",
    "32",
    "33",
    "34",
    "35",
    "36",
    "37",
    "38",
]
FDI_ALL = set(FDI_UPPER + FDI_LOWER)
TOOTH_SCOPE_CODES = {"A", "U", "L", "Q1", "Q2", "Q3", "Q4"}

CANONICAL_FDI_STORAGE_NOTE = (
    "Store tooth identifiers as canonical FDI strings: a single tooth like "
    "'26' or a same-arch range like '45-47'. Palmer/Universal labels should "
    "be converted at the UI boundary before reaching the API."
)


def expand_fdi_range(value):
    raw = str(value or "").strip().replace("–", "-").replace("—", "-")
    if not raw:
        return []
    if "-" not in raw:
        return [raw] if raw in FDI_ALL else []

    start, end, *_ = raw.split("-") + [None]
    arch = None
    if start in FDI_UPPER and end in FDI_UPPER:
        arch = FDI_UPPER
    elif start in FDI_LOWER and end in FDI_LOWER:
        arch = FDI_LOWER
    if not arch:
        return []

    first = arch.index(start)
    last = arch.index(end)
    low, high = sorted((first, last))
    return arch[low : high + 1]


def validate_tooth_range(value):
    if not value:
        return True
    return bool(expand_fdi_range(value))


def validate_bridge_span(value):
    teeth = expand_fdi_range(value)
    return len(teeth) >= 2


def normalize_tooth_scope(value):
    raw = str(value or "").strip().upper()
    return raw if raw in TOOTH_SCOPE_CODES else ""
