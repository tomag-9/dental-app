from decimal import Decimal

from django.db import migrations, models


def snapshot_existing_invoices(apps, schema_editor):
    Invoice = apps.get_model("finance", "Invoice")
    InvoiceItem = apps.get_model("finance", "InvoiceItem")
    MaterialUsage = apps.get_model("materials", "MaterialUsage")
    MaterialUsageLine = apps.get_model("materials", "MaterialUsageLine")

    for invoice in Invoice.objects.all().iterator(chunk_size=200):
        items = list(
            InvoiceItem.objects.filter(invoice_id=invoice.id)
            .select_related("job__patient")
            .order_by("job_id", "id")
        )
        grouped = {}
        for item in items:
            job = item.job
            key = f"job:{job.id}" if job else f"item:{item.id}"
            if key not in grouped:
                patient = getattr(job, "patient", None) if job else None
                grouped[key] = {
                    "job_id": job.id if job else None,
                    "patient_id": patient.id if patient else None,
                    "patient_name": (
                        f"{patient.first_name} {patient.last_name}".strip()
                        if patient
                        else "Bez pacienta"
                    ),
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
                    "unit_price": f"{Decimal(str(item.unit_price or 0)):.2f}",
                    "line_total": f"{line_total:.2f}",
                }
            )
            row["total"] += line_total

        job_ids = [row["job_id"] for row in grouped.values() if row["job_id"]]
        usages_by_job = {}
        usages = (
            MaterialUsage.objects.filter(job_id__in=job_ids)
            .select_related("recipe_source")
            .order_by("date", "id")
        )
        usage_ids = [usage.id for usage in usages]
        lines_by_usage = {}
        for line in MaterialUsageLine.objects.filter(usage_id__in=usage_ids).order_by("id"):
            lines_by_usage.setdefault(line.usage_id, []).append(
                {
                    "name": line.name,
                    "code": line.code,
                    "manufacturer": line.manufacturer,
                    "lot": line.lot,
                    "quantity": str(line.qty),
                    "unit": line.unit,
                }
            )
        for usage in usages:
            usages_by_job.setdefault(usage.job_id, []).append(
                {
                    "name": usage.recipe
                    or (usage.recipe_source.name if usage.recipe_source else "")
                    or "Individuálny materiálový záznam",
                    "date": usage.date.isoformat() if usage.date else None,
                    "materials": lines_by_usage.get(usage.id, []),
                }
            )

        snapshot = []
        for row in grouped.values():
            row["total"] = f"{row['total']:.2f}"
            row["recipes"] = usages_by_job.get(row["job_id"], [])
            snapshot.append(row)
        invoice.breakdown_snapshot = snapshot
        invoice.save(update_fields=["breakdown_snapshot"])


def clear_snapshots(apps, schema_editor):
    apps.get_model("finance", "Invoice").objects.update(breakdown_snapshot=[])


class Migration(migrations.Migration):

    dependencies = [
        ("finance", "0011_invoice_description_options"),
        ("materials", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="invoice",
            name="breakdown_snapshot",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(snapshot_existing_invoices, clear_snapshots),
    ]
