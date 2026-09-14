"""
Protetický štítok — data mapping and PDF rendering (#98, #99, #101).

The module is deliberately split in two halves:

* :func:`build_label_context` turns a :class:`~apps.jobs.models.Job` into a plain
  ``dict`` snapshot. No reportlab, no HTTP — it is unit-testable on its own.
* :func:`render_label_pdf` turns such a snapshot into PDF bytes.

Keeping them apart is the lesson from ``finance.views._render_invoice_pdf``,
which grew to 310 lines inside a ViewSet (#118).

The declaration block follows Regulation (EU) 2017/745 (MDR), Annex XIII,
section 1 — the eight particulars required for a custom-made device. Directive
93/42/EEC (MDD), quoted by the paper template still in use, was repealed on
26 May 2021 and must not appear anywhere in the output (#99).
"""

import os
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from apps.jobs.dental import FDI_LOWER, FDI_UPPER

# ---------------------------------------------------------------------------
# MDR declaration (#99)
# ---------------------------------------------------------------------------

MDR_REFERENCE = "Nariadenie (EÚ) 2017/745 (MDR), príloha XIII, oddiel 1"

#: Fallback wording used when ``Lab.mdr_declaration_text`` is empty.
#: Labs edit their own phrasing, but the eight particulars below are the
#: regulatory skeleton and are always rendered.
DEFAULT_MDR_DECLARATION_TEXT = (
    "Zubná technika vyhlasuje, že zdravotnícka pomôcka na mieru uvedená na tomto štítku "
    "je vyrobená na základe písomného predpisu oprávnenej osoby, má špecifické konštrukčné "
    "charakteristiky určené týmto predpisom a je určená výhradne pre nižšie identifikovaného "
    "pacienta. Pomôcka bola vyrobená v súlade s nariadením Európskeho parlamentu a Rady (EÚ) "
    "2017/745 o zdravotníckych pomôckach (MDR)."
)

#: Annex XIII section 1 retention period, in years.
DECLARATION_RETENTION_YEARS = 10
#: Implantable devices are retained longer.
DECLARATION_RETENTION_YEARS_IMPLANTABLE = 15

RETENTION_NOTE = (
    "Vyhlásenie a súvisiaca dokumentácia sa uchovávajú najmenej {years} rokov od sprístupnenia pomôcky na trh."
)

# ---------------------------------------------------------------------------
# Required data (#98) — the label cannot be issued without these.
# ---------------------------------------------------------------------------

#: ``field path -> (human label, where the user has to fix it)``
REQUIRED_FIELDS = {
    "lab.garant_name": ("Odborný garant zubnej techniky", "Nastavenia laboratória"),
    "lab.garant_registration_number": ("Registračné číslo odborného garanta", "Nastavenia laboratória"),
    "clinic": ("Ambulancia (PZS)", "Detail práce"),
    "clinic.pzs_code": ("Kód poskytovateľa zdravotnej starostlivosti (PZS)", "Detail ambulancie"),
    "doctor": ("Ošetrujúci lekár", "Detail práce"),
    "doctor.doctor_code": ("Kód lekára", "Detail lekára"),
    "patient.birth_number": ("Rodné číslo pacienta", "Detail pacienta"),
    "patient.insurer": ("Zdravotná poisťovňa pacienta", "Detail pacienta"),
    "items": ("Položky práce", "Detail práce"),
}

MISSING_DATA_MESSAGE = "Protetický štítok nie je možné vystaviť — chýbajú povinné údaje."


class LabelDataIncomplete(Exception):
    """Raised when mandatory label data is missing. Carries the exact field list."""

    def __init__(self, missing):
        self.missing = list(missing)
        super().__init__(MISSING_DATA_MESSAGE)

    def as_dict(self):
        return {"detail": MISSING_DATA_MESSAGE, "missing_fields": self.missing}


def _missing_entry(path):
    label, where = REQUIRED_FIELDS[path]
    return {"field": path, "label": label, "where": where}


def collect_missing_fields(job):
    """
    Return the list of mandatory label fields that *job* does not carry.

    Each entry is ``{"field": <path>, "label": <sk label>, "where": <where to fix>}``
    so the client can tell the user exactly what to fill in and where, instead of
    a generic "missing data" message.
    """
    missing = []
    lab = job.lab

    if not (getattr(lab, "garant_name", "") or "").strip():
        missing.append(_missing_entry("lab.garant_name"))
    if not (getattr(lab, "garant_registration_number", "") or "").strip():
        missing.append(_missing_entry("lab.garant_registration_number"))

    clinic = job.clinic
    if clinic is None:
        missing.append(_missing_entry("clinic"))
    elif not (clinic.pzs_code or "").strip():
        missing.append(_missing_entry("clinic.pzs_code"))

    doctor = job.doctor
    if doctor is None:
        missing.append(_missing_entry("doctor"))
    elif not (doctor.doctor_code or "").strip():
        missing.append(_missing_entry("doctor.doctor_code"))

    patient = job.patient
    if patient is not None:
        if not (patient.birth_number or "").strip():
            missing.append(_missing_entry("patient.birth_number"))
        if patient.insurer_id is None:
            missing.append(_missing_entry("patient.insurer"))

    items = list(job.items.all())
    if not items:
        missing.append(_missing_entry("items"))
    else:
        for index, item in enumerate(items):
            if not (item.ipzp_code or "").strip():
                entry = _missing_entry("items")
                entry["field"] = f"items[{index}].ipzp_code"
                entry["label"] = f"Kód IPZP položky „{item.description or item.price_list_code}“"
                missing.append(entry)

    return missing


def assert_label_data_complete(job):
    missing = collect_missing_fields(job)
    if missing:
        raise LabelDataIncomplete(missing)


# ---------------------------------------------------------------------------
# Context building
# ---------------------------------------------------------------------------


def _person_name(obj):
    if obj is None:
        return ""
    parts = (
        getattr(obj, "title_before", "") or "",
        getattr(obj, "first_name", "") or "",
        getattr(obj, "last_name", "") or "",
        getattr(obj, "title_after", "") or "",
    )
    return " ".join(part for part in parts if part).strip()


def _address(*parts):
    return ", ".join(str(part).strip() for part in parts if part and str(part).strip())


def _date(value):
    return value.isoformat() if value else None


def _money(value):
    return str(Decimal(str(value or "0.00")).quantize(Decimal("0.01")))


def _expiry_label(expiry):
    return f"{expiry.month:02d}/{expiry.year}" if expiry else None


def format_material_line(line):
    """``Názov (výrobca), LOT xxx, exp. MM/RRRR`` — the merge format from #101."""
    text = line["name"]
    if line.get("manufacturer"):
        text += f" ({line['manufacturer']})"
    if line.get("lot"):
        text += f", LOT {line['lot']}"
    if line.get("expiry_label"):
        text += f", exp. {line['expiry_label']}"
    return text


def build_material_lines(job):
    """
    Flatten the immutable ``MaterialUsageLine`` snapshots recorded for *job*.

    The snapshot is what MDR traceability rests on: it keeps name, manufacturer,
    LOT and expiry as they were at the moment of use, even if the catalog entry
    is later renamed or the lot is depleted.
    """
    # Local import: apps.materials imports apps.jobs.models, so a module-level
    # import here would close the cycle.
    from apps.materials.models import MaterialUsage

    usages = MaterialUsage.objects.filter(job=job, lab_id=job.lab_id).prefetch_related("lines").order_by("date", "id")
    lines = []
    for usage in usages:
        for line in usage.lines.all():
            entry = {
                "code": line.code,
                "name": line.name,
                "manufacturer": line.manufacturer,
                "mdr_class": line.mdr_class or None,
                "lot": line.lot,
                "expiry": _date(line.expiry),
                "expiry_label": _expiry_label(line.expiry),
                "qty": str(line.qty),
                "unit": line.unit,
                "usage_date": _date(usage.date),
            }
            entry["text"] = format_material_line(entry)
            lines.append(entry)
    return lines


def build_tooth_chart(job):
    """
    The 18–28 / 48–38 FDI cross, as two ordered rows of ``{tooth, procedure}``.

    Falls back to the job input map when no output map has been filled in yet.
    """
    source = job.output_tooth_procedures or job.input_tooth_procedures or {}
    if not isinstance(source, dict):
        source = {}

    def row(codes):
        return [{"tooth": code, "procedure": source.get(code) or None} for code in codes]

    return {
        "upper": row(FDI_UPPER),
        "lower": row(FDI_LOWER),
        "selected": sorted(code for code in source if code in set(FDI_UPPER + FDI_LOWER)),
    }


def _is_implantable(items):
    return any((item.get("procedure_category") or "") == "implant" for item in items)


def build_declaration(job, context):
    """
    Build the MDR 2017/745, Annex XIII section 1 declaration for *job*.

    Returns the lab-configurable intro text plus the eight particulars, each as
    ``{"number", "title", "value"}``. The wording of the intro comes from
    ``Lab.mdr_declaration_text``; the eight points are the regulatory skeleton
    and are always present.
    """
    lab = context["lab"]
    patient = context["patient"]
    doctor = context["doctor"]
    clinic = context["clinic"]
    items = context["items"]

    sites = [line.strip() for line in (job.lab.production_sites or "").splitlines() if line.strip()]
    manufacturer_value = _address(lab["name"], lab["address"])
    if sites:
        manufacturer_value += " | Výrobné miesta: " + "; ".join(sites)

    if job.contains_medicinal_substance:
        substance_value = job.medicinal_substance_note.strip() or (
            "Pomôcka obsahuje liečivú látku, resp. tkanivá alebo bunky ľudského alebo živočíšneho pôvodu."
        )
    else:
        substance_value = (
            "Pomôcka neobsahuje liečivú látku, derivát ľudskej krvi alebo plazmy, "
            "ani tkanivá či bunky ľudského alebo živočíšneho pôvodu."
        )

    if job.safety_performance_deviations.strip():
        conformity_value = (
            "Pomôcka spĺňa všeobecné požiadavky na bezpečnosť a výkon podľa prílohy I "
            "nariadenia (EÚ) 2017/745 s výnimkou: " + job.safety_performance_deviations.strip()
        )
    else:
        conformity_value = (
            "Pomôcka spĺňa všeobecné požiadavky na bezpečnosť a výkon podľa prílohy I "
            "nariadenia (EÚ) 2017/745. Žiadna z požiadaviek nie je nesplnená."
        )

    product_description = "; ".join(
        filter(
            None,
            [
                ", ".join(
                    f"{item['ipzp_code'] or item['code']} {item['description']}"
                    f" ({item['location'] or 'bez lokácie'}) × {item['quantity']}"
                    for item in items
                ),
                f"farebný odtieň {context['job']['tooth_color']}" if context["job"]["tooth_color"] else None,
            ],
        )
    )

    points = [
        {
            "number": 1,
            "title": "Meno a adresa výrobcu a výrobných miest",
            "value": manufacturer_value,
        },
        {
            "number": 2,
            "title": "Splnomocnený zástupca",
            "value": lab["authorized_representative"] or "Nebol ustanovený.",
        },
        {
            "number": 3,
            "title": "Údaje umožňujúce identifikáciu pomôcky",
            "value": _address(
                f"číslo štítku {context['job']['label_number']}" if context["job"]["label_number"] else None,
                f"práca č. {job.id}",
                product_description,
            ),
        },
        {
            "number": 4,
            "title": "Určenie pomôcky pre konkrétneho pacienta",
            "value": (f"Pomôcka je určená výhradne pre pacienta identifikovaného ako {patient['identifier']}."),
        },
        {
            "number": 5,
            "title": "Osoba, ktorá vystavila predpis, a zdravotnícke zariadenie",
            "value": _address(
                doctor["name"],
                f"kód lekára {doctor['doctor_code']}" if doctor["doctor_code"] else None,
                f"reg. č. {doctor['registration_number']}" if doctor["registration_number"] else None,
                clinic["name"],
                f"kód PZS {clinic['pzs_code']}" if clinic["pzs_code"] else None,
            ),
        },
        {
            "number": 6,
            "title": "Konkrétne charakteristiky výrobku podľa predpisu",
            "value": _address(
                product_description,
                f"Dg. {context['job']['diagnosis_code']}" if context["job"]["diagnosis_code"] else None,
                context["materials_text"] or None,
            ),
        },
        {
            "number": 7,
            "title": "Zhoda s prílohou I nariadenia (EÚ) 2017/745",
            "value": conformity_value,
        },
        {
            "number": 8,
            "title": "Liečivá látka / tkanivá a bunky",
            "value": substance_value,
        },
    ]

    retention_years = DECLARATION_RETENTION_YEARS_IMPLANTABLE if _is_implantable(items) else DECLARATION_RETENTION_YEARS

    return {
        "reference": MDR_REFERENCE,
        "text": (job.lab.mdr_declaration_text or "").strip() or DEFAULT_MDR_DECLARATION_TEXT,
        "is_custom_text": bool((job.lab.mdr_declaration_text or "").strip()),
        "points": points,
        "retention_years": retention_years,
        "retention_note": RETENTION_NOTE.format(years=retention_years),
    }


def build_label_context(job, *, validate=True):
    """
    Build the complete prosthetic label snapshot for *job* as plain data.

    Set ``validate=False`` to build a preview even when mandatory fields are
    still missing (the endpoint uses that for the JSON preview path only after
    reporting the gaps).
    """
    if validate:
        assert_label_data_complete(job)

    lab = job.lab
    patient = job.patient
    clinic = job.clinic
    doctor = job.doctor
    technician = job.technician
    insurer = getattr(patient, "insurer", None) if patient else None

    patient_name = _person_name(patient)
    identifier_mode = getattr(lab, "label_patient_identifier_mode", "name") or "name"
    patient_code = f"P-{patient.id}" if patient else ""
    patient_identifier = patient_code if identifier_mode == "code" else (patient_name or patient_code)

    items = []
    for item in job.items.all():
        items.append(
            {
                "code": item.price_list_code,
                "ipzp_code": item.ipzp_code or "",
                "location": item.tooth or item.bridge_span or item.tooth_scope or "",
                "description": item.description or "",
                "quantity": item.quantity,
                "unit_price": _money(item.unit_price),
                "total": _money(item.total),
                "insurance_amount": _money(item.insurance_amount),
                "patient_amount": _money(item.patient_amount),
                "procedure_category": item.procedure_category or "",
                "material": item.material or "",
                "color": item.color or "",
            }
        )

    materials = build_material_lines(job)
    materials_text = "; ".join(line["text"] for line in materials)
    # MaterialUsage is recorded per job, not per job item, so the merged text is
    # the same for every row — the label column is filled from the job snapshot.
    for item in items:
        item["materials_text"] = materials_text

    context = {
        "generated_at": timezone.now().isoformat(),
        "lab": {
            "id": lab.id,
            "name": lab.name,
            "address": _address(lab.address, lab.postal_code, lab.city, lab.country),
            "phone": lab.phone or "",
            "email": lab.email or "",
            "tax_id": lab.tax_id or "",
            "garant_name": lab.garant_name or "",
            "garant_registration_number": lab.garant_registration_number or "",
            "authorized_representative": getattr(lab, "authorized_representative", "") or "",
            "production_sites": [
                line.strip() for line in (getattr(lab, "production_sites", "") or "").splitlines() if line.strip()
            ],
        },
        "job": {
            "id": job.id,
            "label_number": job.label_number or "",
            "label_issued_at": job.label_issued_at.isoformat() if job.label_issued_at else None,
            "status": job.status,
            "diagnosis_code": job.diagnosis_code or "",
            "health_note": job.health_note or "",
            "tooth_color": job.tooth_color or "",
            "description": job.description or "",
        },
        "patient": {
            "id": getattr(patient, "id", None),
            "name": patient_name,
            "code": patient_code,
            "identifier": patient_identifier,
            "identifier_mode": identifier_mode,
            "birth_number": getattr(patient, "birth_number", "") or "",
            "phone": getattr(patient, "phone", "") or "",
            "address": getattr(patient, "address", "") or "",
        },
        "insurer": (
            {
                "code": insurer.code,
                "name": insurer.name,
                "short_name": insurer.short_name or "",
            }
            if insurer
            else None
        ),
        "clinic": {
            "id": getattr(clinic, "id", None),
            "name": getattr(clinic, "name", "") or "",
            "pzs_code": getattr(clinic, "pzs_code", "") or "",
            "address": getattr(clinic, "address", "") or "",
        },
        "doctor": {
            "id": getattr(doctor, "id", None),
            "name": _person_name(doctor),
            "doctor_code": getattr(doctor, "doctor_code", "") or "",
            "registration_number": getattr(doctor, "registration_number", "") or "",
        },
        "technician": {
            "id": getattr(technician, "id", None),
            "name": _person_name(technician),
        },
        "tooth_chart": build_tooth_chart(job),
        "items": items,
        "materials": materials,
        "materials_text": materials_text,
        "totals": {
            "insurance": _money(job.insurance_total),
            "patient": _money(job.patient_total),
            "lab_price": _money(job.price),
        },
        "dates": {
            "received_at": _date(job.received_at),
            "assigned_at": _date(job.assigned_at),
            "completed_at": _date(job.completed_at),
            "try_in_date": _date(job.try_in_date),
            "seated_at": _date(job.seated_at),
            "handover_at": _date(job.handover_at),
            "due_date": _date(job.due_date),
        },
    }
    context["declaration"] = build_declaration(job, context)
    return context


# ---------------------------------------------------------------------------
# PDF rendering
# ---------------------------------------------------------------------------

# Bitstream Vera, bundled with reportlab, is missing ľ/ť/ň/ŕ/ĺ, and the built-in
# Helvetica is limited to WinAnsi — neither can spell Slovak. DejaVu is installed
# in the backend image (see backend/Dockerfile); Helvetica stays as a last-resort
# fallback so a missing font degrades the glyphs, never the endpoint.
_DEJAVU_CANDIDATES = (
    ("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"),
    ("/usr/share/fonts/dejavu/DejaVuSans.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"),
)

_FONT_CACHE = {}


def resolve_fonts():
    """Return ``(regular, bold)`` font names registered with reportlab."""
    if _FONT_CACHE:
        return _FONT_CACHE["regular"], _FONT_CACHE["bold"]

    from reportlab.pdfbase import pdfmetrics
    from reportlab.pdfbase.ttfonts import TTFont

    regular, bold = "Helvetica", "Helvetica-Bold"
    for regular_path, bold_path in _DEJAVU_CANDIDATES:
        if os.path.exists(regular_path) and os.path.exists(bold_path):
            try:
                pdfmetrics.registerFont(TTFont("DejaVuSans", regular_path))
                pdfmetrics.registerFont(TTFont("DejaVuSans-Bold", bold_path))
                regular, bold = "DejaVuSans", "DejaVuSans-Bold"
            except Exception:  # pragma: no cover - corrupt font file
                pass
            break

    _FONT_CACHE["regular"], _FONT_CACHE["bold"] = regular, bold
    return regular, bold


class _Sheet:
    """Tiny cursor over a reportlab canvas: draws top-down and paginates itself."""

    MARGIN_X = 14
    TOP = 285
    BOTTOM = 16

    def __init__(self, pdf, regular, bold, width):
        self.pdf = pdf
        self.regular = regular
        self.bold = bold
        self.width = width
        self.y = self.TOP

    # -- geometry ---------------------------------------------------------
    @property
    def content_width(self):
        return self.width - 2 * self.MARGIN_X

    def space(self, amount):
        self.y -= amount

    def ensure(self, needed):
        from reportlab.lib.units import mm

        if (self.y - needed) * mm < self.BOTTOM * mm:
            self.new_page()

    def new_page(self):
        self.pdf.showPage()
        self.y = self.TOP

    # -- primitives -------------------------------------------------------
    def text(self, x, value, size=8, bold=False, y=None):
        from reportlab.lib.units import mm

        self.pdf.setFont(self.bold if bold else self.regular, size)
        self.pdf.drawString(x * mm, (self.y if y is None else y) * mm, str(value))

    def right_text(self, x, value, size=8, bold=False):
        from reportlab.lib.units import mm

        self.pdf.setFont(self.bold if bold else self.regular, size)
        self.pdf.drawRightString(x * mm, self.y * mm, str(value))

    def line(self, x1, x2, y=None):
        from reportlab.lib.units import mm

        at = (self.y if y is None else y) * mm
        self.pdf.setLineWidth(0.4)
        self.pdf.line(x1 * mm, at, x2 * mm, at)

    def rect(self, x, y, width, height):
        from reportlab.lib.units import mm

        self.pdf.setLineWidth(0.4)
        self.pdf.rect(x * mm, y * mm, width * mm, height * mm)

    def section(self, title):
        self.ensure(10)
        self.space(4)
        self.text(self.MARGIN_X, title, size=8.5, bold=True)
        self.space(1.5)
        self.line(self.MARGIN_X, self.width - self.MARGIN_X)
        self.space(4)

    def paragraph(self, value, size=7, x=None, width=None, bold=False, leading=3.2):
        from reportlab.lib.units import mm
        from reportlab.lib.utils import simpleSplit

        x = self.MARGIN_X if x is None else x
        width = (self.width - self.MARGIN_X - x) if width is None else width
        font = self.bold if bold else self.regular
        for chunk in simpleSplit(str(value), font, size, width * mm):
            self.ensure(leading + 2)
            self.text(x, chunk, size=size, bold=bold)
            self.space(leading)

    def field(self, x, label, value, size=7.5):
        self.text(x, label, size=6, bold=False)
        self.text(x, value if value not in (None, "") else "—", size=size, bold=True, y=self.y - 3.6)


def _tooth_cross(sheet, chart):
    """Draw the FDI cross: 18–28 on top, 48–38 below, marked teeth in bold."""
    cell = sheet.content_width / 16
    top = sheet.y
    height = 5

    for row_index, key in enumerate(("upper", "lower")):
        row = chart[key]
        base = top - row_index * (height * 2)
        for column, entry in enumerate(row):
            x = sheet.MARGIN_X + column * cell
            sheet.rect(x, base - height, cell, height)
            marked = bool(entry["procedure"])
            sheet.text(x + 0.8, entry["tooth"], size=6, bold=marked, y=base - height + 1.4)
            if marked:
                sheet.text(
                    x + 0.8,
                    str(entry["procedure"])[:6],
                    size=4.5,
                    y=base - height * 2 + 1.4,
                )
        # separator between the two quadrant halves
        sheet.pdf.setLineWidth(0.8)
        from reportlab.lib.units import mm

        middle = (sheet.MARGIN_X + 8 * cell) * mm
        sheet.pdf.line(middle, (base - height) * mm, middle, base * mm)

    sheet.y = top - 2 * (height * 2) - 1


_ITEM_COLUMNS = (
    ("Kód", 18),
    ("Lokácia", 16),
    ("Popis výrobku", 42),
    ("Počet", 10),
    ("Výrobný názov a šarža materiálu", 52),
    ("Dátum skúšky", 20),
    ("Dátum nasadenia", 24),
)


def _items_table(sheet, context):
    from reportlab.lib.utils import simpleSplit

    x_positions = []
    x = sheet.MARGIN_X
    for _, width in _ITEM_COLUMNS:
        x_positions.append(x)
        x += width

    sheet.ensure(14)
    for (title, width), x in zip(_ITEM_COLUMNS, x_positions, strict=True):
        for offset, chunk in enumerate(simpleSplit(title, sheet.bold, 6, width * 0.95 * 2.83)):
            sheet.text(x, chunk, size=6, bold=True, y=sheet.y - offset * 2.6)
    sheet.space(5)
    sheet.line(sheet.MARGIN_X, sheet.width - sheet.MARGIN_X)
    sheet.space(3.4)

    try_in = context["dates"]["try_in_date"] or ""
    seated = context["dates"]["seated_at"] or ""

    for index, item in enumerate(context["items"]):
        # The material snapshot is job-scoped, so it is printed once, on the first row.
        material = item["materials_text"] if index == 0 else ""
        cells = [
            item["ipzp_code"] or item["code"],
            item["location"],
            item["description"],
            str(item["quantity"]),
            material,
            try_in,
            seated,
        ]
        wrapped = [
            simpleSplit(str(value), sheet.regular, 6, _ITEM_COLUMNS[column][1] * 0.95 * 2.83) or [""]
            for column, value in enumerate(cells)
        ]
        rows = max(len(chunk) for chunk in wrapped)
        sheet.ensure(rows * 2.9 + 3)
        for column, chunks in enumerate(wrapped):
            for offset, chunk in enumerate(chunks):
                sheet.text(x_positions[column], chunk, size=6, y=sheet.y - offset * 2.9)
        sheet.space(rows * 2.9 + 1.2)
        sheet.line(sheet.MARGIN_X, sheet.width - sheet.MARGIN_X)
        sheet.space(2.6)


def _draw_label(sheet, context):
    lab = context["lab"]
    job = context["job"]
    patient = context["patient"]
    insurer = context["insurer"]
    clinic = context["clinic"]
    doctor = context["doctor"]
    dates = context["dates"]
    right = sheet.width - sheet.MARGIN_X

    # --- header ---------------------------------------------------------
    sheet.text(sheet.MARGIN_X, lab["name"], size=12, bold=True)
    sheet.right_text(right, "PROTETICKÝ ŠTÍTOK", size=12, bold=True)
    sheet.space(4.5)
    sheet.text(sheet.MARGIN_X, _address(lab["address"], lab["phone"], lab["email"]), size=6.5)
    sheet.right_text(right, f"Číslo štítku v ZT: {job['label_number'] or '—'}", size=8, bold=True)
    sheet.space(4)
    sheet.text(
        sheet.MARGIN_X,
        f"Odborný garant ZT: {lab['garant_name']} (reg. č. {lab['garant_registration_number']})",
        size=6.5,
    )
    sheet.right_text(right, f"Vystavené: {(job['label_issued_at'] or '')[:10] or '—'}", size=6.5)
    sheet.space(2.5)
    sheet.line(sheet.MARGIN_X, right)

    # --- provider / doctor ---------------------------------------------
    sheet.section("Poskytovateľ zdravotnej starostlivosti")
    sheet.field(sheet.MARGIN_X, "Názov PZS", clinic["name"])
    sheet.field(sheet.MARGIN_X + 70, "Kód PZS", clinic["pzs_code"])
    sheet.field(sheet.MARGIN_X + 105, "Lekár", doctor["name"])
    sheet.space(8)
    sheet.field(sheet.MARGIN_X, "Adresa PZS", clinic["address"])
    sheet.field(sheet.MARGIN_X + 70, "Kód lekára", doctor["doctor_code"])
    sheet.field(sheet.MARGIN_X + 105, "Reg. č. lekára", doctor["registration_number"])
    sheet.space(8)

    # --- patient --------------------------------------------------------
    sheet.section("Pacient")
    sheet.field(sheet.MARGIN_X, "Meno a priezvisko", patient["identifier"])
    sheet.field(sheet.MARGIN_X + 70, "Rodné číslo", patient["birth_number"])
    sheet.field(sheet.MARGIN_X + 105, "Kód poisťovne", insurer["code"] if insurer else "")
    sheet.field(sheet.MARGIN_X + 135, "Poisťovňa", (insurer["short_name"] or insurer["name"]) if insurer else "")
    sheet.space(8)
    sheet.field(sheet.MARGIN_X, "Bydlisko", patient["address"])
    sheet.field(sheet.MARGIN_X + 70, "Telefón", patient["phone"])
    sheet.field(sheet.MARGIN_X + 105, "Dg. (MKCH-10)", job["diagnosis_code"])
    sheet.field(sheet.MARGIN_X + 135, "Farebný odtieň", job["tooth_color"])
    sheet.space(8)
    if job["health_note"]:
        sheet.text(sheet.MARGIN_X, "Poznámka k zdravotnému stavu", size=6)
        sheet.space(3.2)
        sheet.paragraph(job["health_note"], size=7)

    # --- tooth cross ----------------------------------------------------
    sheet.section("Zubný kríž (FDI 18–28 / 48–38)")
    sheet.ensure(24)
    _tooth_cross(sheet, context["tooth_chart"])
    sheet.space(3)

    # --- items ----------------------------------------------------------
    sheet.section("Zhotovené výrobky")
    _items_table(sheet, context)

    # --- materials ------------------------------------------------------
    sheet.section("Použitý materiál (MDR — dohľadateľnosť šarží)")
    if context["materials"]:
        for line in context["materials"]:
            sheet.paragraph(
                f"• {line['text']} — {line['qty']} {line['unit']}"
                + (f", MDR trieda {line['mdr_class']}" if line["mdr_class"] else ""),
                size=6.5,
            )
    else:
        sheet.paragraph("Pre túto prácu nie je zaevidovaná spotreba materiálu.", size=6.5)

    # --- money ----------------------------------------------------------
    sheet.section("Úhrada")
    sheet.field(sheet.MARGIN_X, "Úhrada poisťovňou (EUR)", context["totals"]["insurance"])
    sheet.field(sheet.MARGIN_X + 55, "Doplatok pacienta (EUR)", context["totals"]["patient"])
    sheet.field(sheet.MARGIN_X + 110, "Cena v ZT (EUR)", context["totals"]["lab_price"])
    sheet.space(9)

    # --- dates ----------------------------------------------------------
    sheet.section("Dátumy")
    labels = (
        ("Prijatie v ZT", dates["received_at"]),
        ("Zadanie v ZT", dates["assigned_at"]),
        ("Ukončenie v ZT", dates["completed_at"]),
        ("Skúška v AMB", dates["try_in_date"]),
        ("Nasadenie v AMB", dates["seated_at"]),
        ("Prevzatie pacientom", dates["handover_at"]),
    )
    for column, (title, value) in enumerate(labels):
        sheet.field(sheet.MARGIN_X + column * 30, title, value)
    sheet.space(9)

    # --- declaration ----------------------------------------------------
    declaration = context["declaration"]
    sheet.section(f"Vyhlásenie zubnej techniky — {declaration['reference']}")
    sheet.paragraph(declaration["text"], size=7)
    sheet.space(1.5)
    for point in declaration["points"]:
        sheet.paragraph(f"{point['number']}. {point['title']}: {point['value']}", size=6.5)
    sheet.space(1.5)
    sheet.paragraph(declaration["retention_note"], size=6)

    # --- signatures -----------------------------------------------------
    sheet.ensure(20)
    sheet.space(8)
    for column, title in enumerate(("Zhotovil (technik)", "Odborný garant ZT", "Prevzal (lekár / pacient)")):
        x = sheet.MARGIN_X + column * 60
        sheet.line(x, x + 50)
        sheet.text(x, title, size=6, y=sheet.y - 3.5)
    sheet.space(6)
    technician_name = context["technician"]["name"]
    if technician_name:
        sheet.text(sheet.MARGIN_X, technician_name, size=6.5)


def render_label_pdf(context):
    """Render a single prosthetic label snapshot to PDF bytes (A4 portrait)."""
    return render_labels_pdf([context])


def render_labels_pdf(contexts):
    """Render one or more label snapshots, each starting on a new A4 page (#98)."""
    from io import BytesIO

    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    regular, bold = resolve_fonts()
    buffer = BytesIO()
    pdf = canvas.Canvas(buffer, pagesize=A4)
    pdf.setTitle("Protetický štítok")
    width = A4[0] / mm

    sheet = _Sheet(pdf, regular, bold, width)
    for index, context in enumerate(contexts):
        if index:
            sheet.new_page()
        _draw_label(sheet, context)
    pdf.showPage()
    pdf.save()

    data = buffer.getvalue()
    buffer.close()
    return data


# ---------------------------------------------------------------------------
# Service entry point
# ---------------------------------------------------------------------------


@transaction.atomic
def issue_prosthetic_label(actor, job):
    """
    Validate, assign the label number and return the label context for *job*.

    The label number is assigned here for the first time — ``issue_label_number``
    is idempotent, so re-issuing a label never burns a new number from the lab
    series. A timeline event and an audit log entry are written only on the first
    issue; re-printing an existing label is not a new regulatory event.

    Raises :class:`LabelDataIncomplete` when mandatory data is missing.
    """
    from apps.core.services import write_audit_log
    from apps.jobs import job_service

    assert_label_data_complete(job)

    already_issued = bool(job.label_number)
    number = job_service.issue_label_number(job)
    job.refresh_from_db(fields=["label_number", "label_issued_at"])

    if not already_issued:
        job_service.record_job_timeline(
            job,
            actor,
            "label_issued",
            note=f"Protetický štítok č. {number} bol vystavený.",
        )
        write_audit_log(
            actor=actor,
            lab=job.lab,
            action="job.label_issued",
            entity_type="job",
            entity_id=job.id,
            description=f"Protetický štítok {number} pre prácu #{job.id}",
            metadata={"label_number": number},
        )

    return build_label_context(job)


def build_label_contexts(actor, jobs):
    """
    Issue labels for every job in *jobs* and return their contexts (bulk export).

    Fails as a whole if any job is missing mandatory data — a partially valid
    batch would produce a PDF that silently omits jobs.
    """
    jobs = list(jobs)
    missing = {}
    for job in jobs:
        gaps = collect_missing_fields(job)
        if gaps:
            missing[str(job.id)] = gaps
    if missing:
        raise LabelDataIncomplete(
            [
                {"field": f"job[{job_id}]", "label": MISSING_DATA_MESSAGE, "where": gaps}
                for job_id, gaps in missing.items()
            ]
        )
    return [issue_prosthetic_label(actor, job) for job in jobs]
