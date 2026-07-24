"""
Thin service layer for invoice business logic.

Extracted from InvoiceViewSet so the logic can be tested independently
and reused without going through the HTTP layer.
"""

from copy import deepcopy
from decimal import Decimal

from django.conf import settings as django_settings
from django.core.mail import EmailMessage
from django.db import transaction
from django.utils import timezone

from apps.core.services import write_audit_log
from apps.jobs import services as jobs_services

from .calculations import calculate_invoice_amounts
from .models import Invoice, InvoiceItem, InvoiceSequence, PriceList

# ---------------------------------------------------------------------------
# Pure helpers
# ---------------------------------------------------------------------------


def _serialize_invoice_breakdown(rows):
    """Convert breakdown values to stable JSON-compatible invoice snapshot data."""
    return [
        {
            **row,
            "total": f"{Decimal(str(row['total'])):.2f}",
            "procedures": [
                {
                    **procedure,
                    "unit_price": f"{Decimal(str(procedure['unit_price'])):.2f}",
                    "line_total": f"{Decimal(str(procedure['line_total'])):.2f}",
                }
                for procedure in row["procedures"]
            ],
            "recipes": [
                {
                    **recipe,
                    "date": recipe["date"].isoformat() if hasattr(recipe["date"], "isoformat") else recipe["date"],
                    "materials": [
                        {
                            **material,
                            "quantity": str(material["quantity"]),
                        }
                        for material in recipe["materials"]
                    ],
                }
                for recipe in row["recipes"]
            ],
        }
        for row in rows
    ]


def build_invoice_breakdown(invoice, *, force_dynamic=False):
    """Return the patient/job/procedure/recipe detail used by invoice appendices."""
    if not force_dynamic and invoice.breakdown_snapshot:
        return deepcopy(invoice.breakdown_snapshot)

    grouped = {}
    items = sorted(
        invoice.items.all(),
        key=lambda item: (item.job_id is None, item.job_id or 0, item.id),
    )

    for item in items:
        job = item.job
        key = f"job:{job.id}" if job else f"item:{item.id}"
        if key not in grouped:
            patient = getattr(job, "patient", None) if job else None
            patient_name = f"{patient.first_name} {patient.last_name}".strip() if patient else "Bez pacienta"
            grouped[key] = {
                "job_id": job.id if job else None,
                "patient_id": patient.id if patient else None,
                "patient_name": patient_name,
                "job_description": (job.description or "") if job else "",
                "procedures": [],
                "recipes": [],
                "total": Decimal("0.00"),
            }

        row = grouped[key]
        line_total = Decimal(str(item.line_total or 0))
        row["procedures"].append(
            {
                "description": item.description or row["job_description"] or "Dentálna práca",
                "quantity": item.quantity,
                "unit_price": Decimal(str(item.unit_price or 0)),
                "line_total": line_total,
            }
        )
        row["total"] += line_total

    jobs_by_id = {item.job_id: item.job for item in items if item.job_id and item.job is not None}
    for row in grouped.values():
        job = jobs_by_id.get(row["job_id"])
        if not job:
            continue
        usages = sorted(
            job.material_usages.all(),
            key=lambda usage: (usage.date, usage.id),
        )
        row["recipes"] = [
            {
                "name": usage.recipe
                or (usage.recipe_source.name if usage.recipe_source else "")
                or "Individuálny materiálový záznam",
                "date": usage.date,
                "materials": [
                    {
                        "name": line.name,
                        "code": line.code,
                        "manufacturer": line.manufacturer,
                        "lot": line.lot,
                        "quantity": line.qty,
                        "unit": line.unit,
                    }
                    for line in usage.lines.all()
                ],
            }
            for usage in usages
        ]

    return list(grouped.values())


def build_invoice_patient_summaries(invoice, breakdown=None):
    """Aggregate invoice totals by patient for the patient-based invoice mode."""
    summaries = {}
    rows = breakdown if breakdown is not None else build_invoice_breakdown(invoice)
    for row in rows:
        key = row["patient_id"] or row["patient_name"]
        if key not in summaries:
            summaries[key] = {
                "patient_id": row["patient_id"],
                "patient_name": row["patient_name"],
                "total": Decimal("0.00"),
            }
        summaries[key]["total"] += Decimal(str(row["total"]))
    return list(summaries.values())


def generate_invoice_number(lab):
    """Generate the next sequential invoice number for *lab* (must be called inside a transaction)."""
    seq, _ = InvoiceSequence.objects.select_for_update().get_or_create(lab=lab)
    seq.last_number += 1
    seq.save(update_fields=["last_number"])
    prefix = (getattr(lab, "invoice_prefix", None) or "INV").strip() or "INV"
    year = timezone.now().year
    return f"{prefix}-{year}-{seq.last_number:04d}"


def sync_jobs_for_invoice_status(invoice, new_status):
    """Sync the statuses of jobs linked to *invoice* when invoice status changes."""
    job_ids = list(
        InvoiceItem.objects.filter(invoice=invoice, job_id__isnull=False).values_list("job_id", flat=True).distinct()
    )
    if new_status == "cancelled":
        jobs_services.mark_jobs_invoice_cancelled(job_ids)
    else:
        jobs_services.mark_jobs_invoiced(job_ids, invoice_status=new_status)


def write_invoice_audit(actor, invoice, action, metadata=None, description=None):
    """Write an audit log entry for *invoice*. ``actor`` is the acting User (may be None)."""
    write_audit_log(
        actor=actor,
        lab=invoice.lab,
        action=action,
        entity_type="invoice",
        entity_id=invoice.id,
        description=description or f"Invoice {invoice.number}: {action}",
        metadata=metadata or {},
    )


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------


@transaction.atomic
def create_invoice(
    actor,
    clinic,
    jobs,
    document_type="invoice",
    discount_percent=None,
    description_mode="structured",
    custom_description="",
    show_patient_list=True,
):
    """
    Create an invoice for *clinic* covering *jobs*.

    The caller is responsible for validating that *clinic* and *jobs* are
    accessible to *actor* before calling this function.

    Returns the created ``Invoice`` instance.
    """
    if discount_percent is None:
        discount_percent = Decimal("0")
    description_mode = description_mode or "structured"
    custom_description = (custom_description or "").strip()

    now = timezone.now()
    due_date = timezone.localdate() + timezone.timedelta(days=clinic.lab.invoice_due_days)

    invoice = Invoice.objects.create(
        clinic=clinic,
        lab_id=clinic.lab_id,
        number=generate_invoice_number(clinic.lab),
        status="issued",
        document_type=document_type,
        vat_rate=clinic.lab.vat_rate if clinic.lab.is_vat_payer else Decimal("0"),
        discount_percent=discount_percent,
        description_mode=description_mode,
        custom_description=custom_description,
        show_patient_list=show_patient_list,
        issued_at=now,
        due_date=due_date,
    )

    price_map = {pl.code: pl for pl in PriceList.objects.filter(lab=clinic.lab)}
    subtotal = Decimal("0.00")

    for job in jobs:
        procedures = job.procedure_codes or []
        quantities = job.procedure_quantities or {}

        if not procedures:
            quantity = 1
            unit_price = Decimal(str(job.price or 0))
            item = InvoiceItem.objects.create(
                invoice=invoice,
                job=job,
                description=job.description or "Dental work",
                quantity=quantity,
                unit_price=unit_price,
                line_total=unit_price * quantity,
            )
            subtotal += item.line_total
            continue

        for code in procedures:
            quantity = int(quantities.get(code, 1))
            pl_entry = price_map.get(str(code))
            if len(procedures) == 1:
                unit_price = Decimal(str(job.price or 0))
            elif pl_entry:
                unit_price = Decimal(str(pl_entry.price))
            else:
                unit_price = Decimal("0")
            description = (pl_entry.description if pl_entry else None) or str(code)
            item = InvoiceItem.objects.create(
                invoice=invoice,
                job=job,
                description=description,
                quantity=quantity,
                unit_price=unit_price,
                line_total=unit_price * quantity,
            )
            subtotal += item.line_total

    amounts = calculate_invoice_amounts(subtotal, invoice.vat_rate, invoice.discount_percent)
    invoice.total_amount = amounts["total_amount"]
    invoice.breakdown_snapshot = _serialize_invoice_breakdown(build_invoice_breakdown(invoice, force_dynamic=True))
    invoice.save(update_fields=["total_amount", "breakdown_snapshot"])

    sync_jobs_for_invoice_status(invoice, "issued")

    return invoice


def update_invoice_status(actor, invoice, new_status):
    """
    Update *invoice* status to *new_status*, sync linked jobs, and write audit log.

    Returns the updated ``Invoice`` instance.
    """
    old_status = invoice.status
    invoice.status = new_status
    if new_status == "issued" and not invoice.issued_at:
        invoice.issued_at = timezone.now()
    if new_status == "paid" and not invoice.paid_at:
        invoice.paid_at = timezone.now()
    invoice.save(update_fields=["status", "issued_at", "paid_at"])

    sync_jobs_for_invoice_status(invoice, new_status)
    write_invoice_audit(
        actor,
        invoice,
        "invoice.status_changed",
        metadata={"from_status": old_status, "to_status": new_status},
    )
    return invoice


def delete_invoice(actor, invoice):
    """
    Sync linked job statuses to *cancelled*, write audit log, and delete *invoice*.
    """
    sync_jobs_for_invoice_status(invoice, "cancelled")
    write_invoice_audit(
        actor,
        invoice,
        "invoice.deleted",
        metadata={"number": invoice.number, "status": invoice.status},
    )
    invoice.delete()


def send_invoice_email(actor, invoice, pdf_bytes, recipient):
    """
    Send *invoice* PDF (pre-rendered bytes) to *recipient* and write audit log.

    Raises an exception from ``EmailMessage.send`` on delivery failure —
    callers should catch and convert to an appropriate HTTP response.
    """
    lab = invoice.lab
    doc_label = "Faktúra" if invoice.document_type == "invoice" else "Proforma faktúra"
    subject = f"{doc_label} č. {invoice.number}"
    body = (
        f"Dobrý deň,\n\n"
        f"V prílohe nájdete {doc_label.lower()} č. {invoice.number}.\n\n"
        f"S pozdravom,\n{lab.name if lab else 'Dentálne laboratórium'}"
    )
    msg = EmailMessage(
        subject=subject,
        body=body,
        from_email=getattr(django_settings, "DEFAULT_FROM_EMAIL", "noreply@dentalapp.sk"),
        to=[recipient],
    )
    msg.attach(f"faktura_{invoice.number}.pdf", pdf_bytes, "application/pdf")
    msg.send(fail_silently=False)

    write_invoice_audit(actor, invoice, "invoice.email_sent", metadata={"sent_to": recipient})
