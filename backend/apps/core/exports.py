from django.conf import settings
from rest_framework.exceptions import ValidationError

DEFAULT_EXPORT_MAX_ROWS = 5000


def limited_export_queryset(queryset, label="export"):
    max_rows = int(getattr(settings, "EXPORT_MAX_ROWS", DEFAULT_EXPORT_MAX_ROWS) or DEFAULT_EXPORT_MAX_ROWS)
    rows = list(queryset[: max_rows + 1])
    if len(rows) > max_rows:
        raise ValidationError(
            {
                "detail": (
                    f"{label} export is limited to {max_rows} rows. "
                    "Please narrow filters or contact support for a bulk export."
                ),
                "code": "export_row_limit_exceeded",
                "max_rows": max_rows,
            }
        )
    return rows
