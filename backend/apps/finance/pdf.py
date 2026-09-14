"""
Invoice PDF — data mapping and PDF rendering (#118).

The module is deliberately split in two halves, the same pattern used for the
prosthetic label (``apps.jobs.prosthetic_label``):

* :func:`build_invoice_context` turns an :class:`~apps.finance.models.Invoice`
  into a plain ``dict`` snapshot. No reportlab, no HTTP — it is unit-testable
  on its own.
* :func:`render_invoice_pdf` turns such a snapshot into PDF bytes.

Extracted from ``InvoiceViewSet._render_invoice_pdf``, a 310-line method that
lived directly inside the ViewSet and could only be exercised over HTTP.
``invoice_service.build_invoice_breakdown()`` / ``build_invoice_patient_summaries()``
already prepared similar data for the JSON appendix; this module reuses them
rather than duplicating the grouping logic.
"""

from decimal import Decimal

from django.utils import timezone
from reportlab.graphics import renderPDF
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

from apps.core.localization import format_sk_currency

from . import invoice_service
from .calculations import calculate_invoice_amounts, reverse_invoice_subtotal
from .pay_by_square import PayBySquareError

PAYMENT_METHOD_LABELS = {
    "bank_transfer": "Bankový prevod",
    "cash": "Hotovosť",
    "card": "Karta",
}


def _money(value):
    return str(Decimal(str(value or "0.00")).quantize(Decimal("0.01")))


# ---------------------------------------------------------------------------
# Context building
# ---------------------------------------------------------------------------


def build_invoice_context(invoice):
    """
    Build the complete invoice PDF snapshot for *invoice* as plain data.

    Pure data mapping — no reportlab, no HTTP — so it can be unit tested
    without generating a PDF. Builds on ``invoice_service.build_invoice_breakdown()``
    and ``build_invoice_patient_summaries()`` instead of re-deriving the same
    patient/job/procedure/recipe grouping a second time.
    """
    items = list(invoice.items.select_related("job__patient").all())
    breakdown = invoice_service.build_invoice_breakdown(invoice)
    patient_summaries = invoice_service.build_invoice_patient_summaries(invoice, breakdown)
    lab = invoice.lab
    clinic = invoice.clinic

    vat_rate = Decimal(str(invoice.vat_rate or 0))
    discount = Decimal(str(invoice.discount_percent or 0))
    total = Decimal(str(invoice.total_amount or 0))
    line_totals = [Decimal(str(item.line_total or 0)) for item in items]
    subtotal = sum(line_totals, Decimal("0.00")) if line_totals else reverse_invoice_subtotal(total, vat_rate, discount)
    amounts = calculate_invoice_amounts(subtotal, vat_rate, discount)

    # Only a valid Pay by Square code goes on the invoice. If the lab has QR
    # payments disabled or its banking data is unusable, no QR is printed at
    # all rather than a code no banking app can read (issue #125).
    try:
        payment_payload = invoice_service.build_invoice_payment_payload(invoice)
    except PayBySquareError:
        payment_payload = None

    issued_at = invoice.issued_at or timezone.now()

    return {
        "doc_label": "FAKTÚRA" if invoice.document_type == "invoice" else "PROFORMA FAKTÚRA",
        "number": invoice.number,
        "issued_at": issued_at,
        "due_date": invoice.due_date,
        "description_mode": invoice.description_mode,
        "custom_description": invoice.custom_description or "Protetické práce",
        "show_patient_list": invoice.show_patient_list,
        "payment_payload": payment_payload,
        "lab": {
            "name": lab.name or "",
            "address": lab.address or "",
            "city_line": " ".join(filter(None, [lab.postal_code, lab.city])),
            "tax_id": lab.tax_id or "",
            "vat_id": lab.vat_id or "",
            "bank_account": lab.bank_account or "",
            "bank_bic": lab.bank_bic or "",
            "payment_method_label": PAYMENT_METHOD_LABELS.get(lab.payment_method, lab.payment_method or ""),
            "invoice_default_note": lab.invoice_default_note or "",
        },
        "clinic": {
            "name": (clinic.name if clinic else "") or "",
            "address": (clinic.address if clinic else "") or "",
            "ico": (getattr(clinic, "ico", None) if clinic else "") or "",
        },
        "patient_summaries": [
            {"patient_name": summary["patient_name"], "total": _money(summary["total"])}
            for summary in patient_summaries
        ],
        "breakdown": breakdown,
        "totals": {
            "subtotal": _money(subtotal),
            "discount_percent": f"{discount:.0f}",
            "discount_amount": _money(amounts["discount_amount"]),
            "taxable_amount": _money(amounts["taxable_amount"]),
            "vat_rate": f"{vat_rate:.0f}",
            "vat_amount": _money(amounts["vat_amount"]),
            "total": _money(total),
            "has_discount": discount > 0,
        },
    }


# ---------------------------------------------------------------------------
# PDF rendering
# ---------------------------------------------------------------------------

_L = 15 * mm


def _qr_drawing(payload, size=72):
    widget = qr.QrCodeWidget(payload)
    x0, y0, x1, y1 = widget.getBounds()
    width = x1 - x0
    height = y1 - y0
    drawing = Drawing(size, size, transform=[size / width, 0, 0, size / height, 0, 0])
    drawing.add(widget)
    return drawing


def _wrapped_lines(value, font_name, font_size, max_width):
    return simpleSplit(str(value or ""), font_name, font_size, max_width) or [""]


class _InvoiceCanvas:
    """Thin wrapper carrying the reportlab canvas plus page geometry and the
    continuation/appendix page builders — mirrors ``_Sheet`` in
    ``apps.jobs.prosthetic_label`` but keeps the invoice's original free-form
    layout rather than a cursor-based one, to preserve today's rendering."""

    def __init__(self, buffer, context):
        self.context = context
        self.pdf = canvas.Canvas(buffer, pagesize=A4)
        self.width, self.height = A4
        self.L = _L
        self.R = self.width - 15 * mm

    def hline(self, y, x1=None, x2=None):
        self.pdf.setLineWidth(0.3)
        self.pdf.line(x1 or self.L, y, x2 or self.R, y)

    def continuation_page(self):
        pdf = self.pdf
        context = self.context
        pdf.showPage()
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(self.L, self.height - 18 * mm, context["doc_label"])
        pdf.setFont("Helvetica", 9)
        pdf.drawString(self.L, self.height - 24 * mm, f"Číslo: {context['number']} — pokračovanie")
        self.hline(self.height - 30 * mm)
        page_y = self.height - 38 * mm
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(self.L, page_y, "Pacient")
        pdf.drawRightString(self.R, page_y, "Spolu")
        self.hline(page_y - 2 * mm)
        return page_y - 8 * mm

    def appendix_page(self):
        pdf = self.pdf
        context = self.context
        pdf.showPage()
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(self.L, self.height - 18 * mm, "Príloha k faktúre")
        pdf.setFont("Helvetica", 10)
        pdf.drawString(self.L, self.height - 25 * mm, f"Faktúra: {context['number']}")
        self.hline(self.height - 31 * mm)
        page_y = self.height - 40 * mm
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(self.L, page_y, "Pacient")
        pdf.drawString(58 * mm, page_y, "Úkon / recept")
        pdf.drawRightString(148 * mm, page_y, "Množstvo")
        pdf.drawRightString(self.R, page_y, "Spolu")
        self.hline(page_y - 2 * mm)
        return page_y - 7 * mm


def _draw_header(sheet):
    pdf, context = sheet.pdf, sheet.context
    L, width, height = sheet.L, sheet.width, sheet.height

    if context["payment_payload"]:
        qr_drawing = _qr_drawing(context["payment_payload"], size=72)
        renderPDF.draw(qr_drawing, pdf, width - 47 * mm, height - 47 * mm)

    pdf.setFont("Helvetica-Bold", 18)
    pdf.drawString(L, height - 18 * mm, context["doc_label"])
    pdf.setFont("Helvetica", 10)
    pdf.drawString(L, height - 25 * mm, f"Číslo: {context['number']}")
    pdf.drawString(L, height - 31 * mm, f"Dátum vystavenia: {context['issued_at'].strftime('%d.%m.%Y')}")
    if context["due_date"]:
        pdf.drawString(L, height - 37 * mm, f"Dátum splatnosti: {context['due_date'].strftime('%d.%m.%Y')}")

    sheet.hline(height - 42 * mm)


def _draw_parties(sheet):
    pdf, context = sheet.pdf, sheet.context
    L, height = sheet.L, sheet.height
    lab = context["lab"]
    clinic = context["clinic"]

    y = height - 49 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(L, y, "Dodávateľ")
    y -= 5 * mm
    pdf.setFont("Helvetica", 9)
    pdf.drawString(L, y, lab["name"])
    for value in (lab["address"], lab["city_line"]):
        if value:
            y -= 4 * mm
            pdf.drawString(L, y, value)
    if lab["tax_id"]:
        y -= 4 * mm
        pdf.drawString(L, y, f"IČO: {lab['tax_id']}")
    if lab["vat_id"]:
        y -= 4 * mm
        pdf.drawString(L, y, f"IČ DPH: {lab['vat_id']}")
    if lab["bank_account"]:
        y -= 4 * mm
        pdf.drawString(L, y, f"IBAN: {lab['bank_account']}")
    if lab["bank_bic"]:
        y -= 4 * mm
        pdf.drawString(L, y, f"BIC: {lab['bank_bic']}")

    col2 = sheet.width / 2 + 5 * mm
    yc = height - 49 * mm
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(col2, yc, "Odberateľ")
    yc -= 5 * mm
    pdf.setFont("Helvetica", 9)
    pdf.drawString(col2, yc, clinic["name"])
    if clinic["address"]:
        yc -= 4 * mm
        pdf.drawString(col2, yc, clinic["address"])
    if clinic["ico"]:
        yc -= 4 * mm
        pdf.drawString(col2, yc, f"IČO: {clinic['ico']}")

    return min(y, yc)


def _draw_items(sheet, parties_bottom):
    pdf, context = sheet.pdf, sheet.context
    L, R = sheet.L, sheet.R

    table_top = parties_bottom - 8 * mm
    sheet.hline(table_top)
    th = table_top - 6 * mm

    if context["description_mode"] == "custom":
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(L, th, "Popis")
        pdf.drawRightString(R, th, "Spolu")
        sheet.hline(th - 2 * mm)

        ty = th - 8 * mm
        pdf.setFont("Helvetica", 9)
        description_lines = _wrapped_lines(context["custom_description"], "Helvetica", 9, 145 * mm)
        for line_index, line in enumerate(description_lines):
            pdf.drawString(L, ty, line)
            if line_index == 0:
                pdf.drawRightString(R, ty, format_sk_currency(context["totals"]["subtotal"]))
            ty -= 4.5 * mm
        ty -= 1.5 * mm
        return ty

    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawString(L, th, "Pacient")
    pdf.drawRightString(R, th, "Spolu")
    sheet.hline(th - 2 * mm)

    ty = th - 8 * mm
    for summary in context["patient_summaries"]:
        name_lines = _wrapped_lines(summary["patient_name"], "Helvetica", 9, 145 * mm)
        row_height = max(5, len(name_lines) * 4.5) * mm
        if ty - row_height < 55 * mm:
            ty = sheet.continuation_page()
        pdf.setFont("Helvetica", 9)
        for line_index, line in enumerate(name_lines):
            pdf.drawString(L, ty - line_index * 4.5 * mm, line)
        pdf.drawRightString(R, ty, format_sk_currency(summary["total"]))
        ty -= row_height
    return ty


def _draw_totals(sheet, ty):
    pdf, context = sheet.pdf, sheet.context
    R = sheet.R
    totals = context["totals"]

    sheet.hline(ty)
    if ty < 52 * mm:
        ty = sheet.continuation_page()
        sheet.hline(ty)

    ty -= 6 * mm
    pdf.setFont("Helvetica", 9)
    pdf.drawRightString(160 * mm, ty, "Medzisúčet:")
    pdf.drawRightString(R, ty, format_sk_currency(totals["subtotal"]))
    if totals["has_discount"]:
        ty -= 5 * mm
        pdf.drawRightString(160 * mm, ty, f"Zľava ({totals['discount_percent']}%):")
        pdf.drawRightString(R, ty, f"-{format_sk_currency(totals['discount_amount'])}")
        ty -= 5 * mm
        pdf.drawRightString(160 * mm, ty, "Základ DPH:")
        pdf.drawRightString(R, ty, format_sk_currency(totals["taxable_amount"]))
    ty -= 5 * mm
    pdf.drawRightString(160 * mm, ty, f"DPH ({totals['vat_rate']}%):")
    pdf.drawRightString(R, ty, format_sk_currency(totals["vat_amount"]))
    ty -= 7 * mm
    pdf.setFont("Helvetica-Bold", 11)
    pdf.drawRightString(160 * mm, ty, "CELKOM:")
    pdf.drawRightString(R, ty, format_sk_currency(totals["total"]))
    return ty


def _draw_footer_note(sheet, ty):
    pdf, context = sheet.pdf, sheet.context
    L, R = sheet.L, sheet.R
    lab = context["lab"]

    if lab["payment_method_label"]:
        ty -= 8 * mm
        pdf.setFont("Helvetica", 8)
        pdf.drawString(L, ty, f"Spôsob úhrady: {lab['payment_method_label']}")
    if lab["invoice_default_note"]:
        ty -= 6 * mm
        pdf.setFont("Helvetica", 8)
        for note_line in _wrapped_lines(lab["invoice_default_note"], "Helvetica", 8, R - L):
            pdf.drawString(L, ty, note_line)
            ty -= 4 * mm
    return ty


def _draw_appendix(sheet):
    pdf, context = sheet.pdf, sheet.context
    L, R = sheet.L, sheet.R

    py = sheet.appendix_page()
    for row in context["breakdown"]:
        first_procedure = True
        for procedure in row["procedures"]:
            patient_lines = _wrapped_lines(row["patient_name"] if first_procedure else "", "Helvetica", 8, 38 * mm)
            procedure_lines = _wrapped_lines(procedure["description"], "Helvetica", 8, 82 * mm)
            line_count = max(len(patient_lines), len(procedure_lines))
            row_height = max(5, line_count * 4) * mm
            if py - row_height < 20 * mm:
                py = sheet.appendix_page()
            pdf.setFont("Helvetica", 8)
            for line_index, line in enumerate(patient_lines):
                pdf.drawString(L, py - line_index * 4 * mm, line)
            for line_index, line in enumerate(procedure_lines):
                pdf.drawString(58 * mm, py - line_index * 4 * mm, line)
            pdf.drawRightString(148 * mm, py, str(procedure["quantity"]))
            pdf.drawRightString(R, py, format_sk_currency(procedure["line_total"]))
            py -= row_height
            first_procedure = False

        for recipe in row["recipes"]:
            recipe_date = recipe["date"]
            if hasattr(recipe_date, "strftime"):
                recipe_date = recipe_date.strftime("%d.%m.%Y")
            recipe_lines = _wrapped_lines(
                f"Recept: {recipe['name']}" + (f" ({recipe_date})" if recipe_date else ""),
                "Helvetica-Bold",
                7.5,
                120 * mm,
            )
            recipe_height = len(recipe_lines) * 4 * mm
            if py - recipe_height < 20 * mm:
                py = sheet.appendix_page()
            pdf.setFont("Helvetica-Bold", 7.5)
            for line in recipe_lines:
                pdf.drawString(62 * mm, py, line)
                py -= 4 * mm
            pdf.setFont("Helvetica", 7)
            for material in recipe["materials"]:
                material_text = " · ".join(
                    filter(
                        None,
                        [
                            material["name"],
                            material["code"],
                            f"LOT {material['lot']}" if material["lot"] else "",
                            material["manufacturer"],
                        ],
                    )
                )
                material_lines = _wrapped_lines(material_text, "Helvetica", 7, 72 * mm)
                material_height = max(4, len(material_lines) * 3.5) * mm
                if py - material_height < 18 * mm:
                    py = sheet.appendix_page()
                    pdf.setFont("Helvetica", 7)
                for line_index, line in enumerate(material_lines):
                    pdf.drawString(66 * mm, py - line_index * 3.5 * mm, line)
                pdf.drawRightString(148 * mm, py, f"{material['quantity']} {material['unit']}")
                py -= material_height
        py -= 2 * mm


def render_invoice_pdf(context):
    """Render an invoice PDF snapshot (as built by ``build_invoice_context``) to PDF bytes."""
    from io import BytesIO

    buffer = BytesIO()
    sheet = _InvoiceCanvas(buffer, context)

    _draw_header(sheet)
    parties_bottom = _draw_parties(sheet)
    ty = _draw_items(sheet, parties_bottom)
    ty = _draw_totals(sheet, ty)
    _draw_footer_note(sheet, ty)

    if context["show_patient_list"]:
        _draw_appendix(sheet)

    sheet.pdf.showPage()
    sheet.pdf.save()

    data = buffer.getvalue()
    buffer.close()
    return data
