from collections import defaultdict
from decimal import Decimal

from django.db import transaction
from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.core.services import write_audit_log
from apps.jobs.models import Job

from .models import (
    MaterialLot,
    MaterialRecipe,
    MaterialUsage,
    MaterialUsageLine,
)


def available_lots(catalog, *, lock=False):
    queryset = MaterialLot.objects.filter(
        catalog=catalog,
        status__in=(MaterialLot.Status.ACTIVE, MaterialLot.Status.OPEN),
        qty_remaining__gt=0,
    ).filter(Q(expiry__isnull=True) | Q(expiry__gte=timezone.localdate()))
    if lock:
        queryset = queryset.select_for_update()
    return queryset.order_by(models_fefo_expiry(), "received", "id")


def models_fefo_expiry():
    from django.db.models import F

    return F("expiry").asc(nulls_last=True)


def _allocate(catalog, qty, explicit_lot=None):
    remaining = Decimal(qty)
    allocations = []
    lots = (
        MaterialLot.objects.select_for_update().filter(pk=explicit_lot.pk)
        if explicit_lot
        else available_lots(catalog, lock=True)
    )
    for lot in lots:
        if lot.catalog_id != catalog.id or lot.status not in (
            MaterialLot.Status.ACTIVE,
            MaterialLot.Status.OPEN,
        ):
            continue
        if lot.expiry and lot.expiry < timezone.localdate():
            continue
        take = min(remaining, lot.qty_remaining)
        if take > 0:
            allocations.append((lot, take))
            remaining -= take
        if remaining == 0:
            break
    if remaining:
        raise ValidationError(
            {
                "lines": f"Nedostatočné dostupné množstvo materiálu {catalog.code}; chýba {remaining} {catalog.unit}."
            }
        )
    return allocations


@transaction.atomic
def create_usage(*, actor, lab, validated_data):
    try:
        job = Job.objects.select_related("patient", "technician").get(
            pk=validated_data["job"], lab=lab
        )
    except Job.DoesNotExist as exc:
        raise ValidationError(
            {"job": "Zákazka neexistuje v tomto laboratóriu."}
        ) from exc

    recipe = None
    recipe_id = validated_data.get("recipe")
    if recipe_id:
        try:
            recipe = MaterialRecipe.objects.prefetch_related("lines__catalog").get(
                pk=recipe_id, lab=lab
            )
        except MaterialRecipe.DoesNotExist as exc:
            raise ValidationError(
                {"recipe": "Recept neexistuje v tomto laboratóriu."}
            ) from exc

    selections = validated_data.get("lines") or []
    if not selections and recipe:
        selections = [
            {"catalog": line.catalog, "qty": line.qty} for line in recipe.lines.all()
        ]

    grouped = defaultdict(lambda: {"qty": Decimal("0"), "lot": None})
    for selection in selections:
        lot = selection.get("lot")
        catalog = selection.get("catalog") or (lot.catalog if lot else None)
        if not catalog or catalog.lab_id != lab.id or not catalog.allow_in_job:
            raise ValidationError(
                {"lines": "Materiál nie je povolený pre zákazky tohto laboratória."}
            )
        if lot and lot.lab_id != lab.id:
            raise ValidationError({"lines": "Šarža patrí do iného laboratória."})
        key = (catalog.id, lot.id if lot else None)
        grouped[key]["catalog"] = catalog
        grouped[key]["lot"] = lot
        grouped[key]["qty"] += selection["qty"]

    technician = ""
    if job.technician:
        technician = f"{job.technician.first_name} {job.technician.last_name}".strip()
    usage = MaterialUsage.objects.create(
        lab=lab,
        job=job,
        patient_label=str(job.patient),
        technician=technician,
        date=validated_data.get("date") or timezone.localdate(),
        recipe=recipe.name if recipe else "",
        recipe_source=recipe,
    )

    # Persist each reservation while holding the row lock. This ensures that a
    # later automatic FEFO selection in the same request sees the reduced
    # balance even when an earlier line explicitly selected the same lot.
    all_allocations = []
    # Explicit LOT choices have priority; automatic FEFO consumes what remains.
    for selection in sorted(grouped.values(), key=lambda item: item["lot"] is None):
        allocations = _allocate(
            selection["catalog"], selection["qty"], selection["lot"]
        )
        for lot, qty in allocations:
            lot.qty_remaining -= qty
            if lot.qty_remaining == 0:
                lot.status = MaterialLot.Status.DEPLETED
            else:
                lot.status = MaterialLot.Status.OPEN
                lot.opened = lot.opened or usage.date
            lot.save(update_fields=("qty_remaining", "status", "opened", "updated_at"))
        all_allocations.extend(allocations)

    snapshot_lines = []
    for lot, qty in all_allocations:
        catalog = lot.catalog
        snapshot_lines.append(
            MaterialUsageLine(
                usage=usage,
                source_catalog_id=catalog.id,
                source_lot_id=lot.id,
                name=catalog.name,
                code=catalog.code,
                manufacturer=catalog.manufacturer.name,
                mdr_class=catalog.mdr_class,
                lot=lot.lot,
                expiry=lot.expiry,
                qty=qty,
                unit=catalog.unit,
            )
        )
    MaterialUsageLine.objects.bulk_create(snapshot_lines)
    write_audit_log(
        actor=actor,
        lab=lab,
        action="material.usage_created",
        entity_type="MaterialUsage",
        entity_id=usage.id,
        metadata={"job_id": job.id, "line_count": len(snapshot_lines)},
    )
    return usage
