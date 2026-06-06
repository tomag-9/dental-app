from decimal import Decimal, InvalidOperation

SK_DATE_FORMAT = "%d.%m.%Y"

JOB_STATUS_LABELS = {
    "new": "Nová",
    "in_progress": "V riešení",
    "completed": "Dokončená",
    "cancelled": "Zrušená",
    "finished_factured": "Dokončená/fakturovaná",
    "finished_unfactured": "Dokončená/nevyfakturovaná",
    "closed": "Uzavretá",
}

INVOICE_STATUS_LABELS = {
    "draft": "Koncept",
    "issued": "Vystavená",
    "paid": "Zaplatená",
    "cancelled": "Zrušená",
}

PRIORITY_LABELS = {
    "low": "Nízka",
    "normal": "Bežná",
    "high": "Vysoká",
    "urgent": "Urgentná",
}


def format_sk_date(value):
    if not value:
        return ""
    if hasattr(value, "date"):
        value = value.date()
    return value.strftime(SK_DATE_FORMAT)


def format_sk_currency(value, *, include_currency=True):
    if value in (None, ""):
        return ""
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError):
        return str(value)
    formatted = f"{amount:,.2f}".replace(",", " ").replace(".", ",")
    return f"{formatted} EUR" if include_currency else formatted
