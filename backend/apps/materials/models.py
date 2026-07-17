from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone
from django.utils.translation import gettext_lazy as _

from apps.core.models import Lab
from apps.inventory.models import WarehouseItem
from apps.jobs.models import Job


class Manufacturer(models.Model):
    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="material_manufacturers")
    name = models.CharField(max_length=255)
    prefix = models.CharField(max_length=20)
    country = models.CharField(max_length=100, blank=True, default="")
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(fields=["lab", "prefix"], name="materials_unique_manufacturer_prefix"),
        ]

    def __str__(self):
        return self.name


class MaterialCatalog(models.Model):
    class MDRClass(models.TextChoices):
        CLASS_I = "I", _("Trieda I")
        IIA = "IIa", _("Trieda IIa")
        IIB = "IIb", _("Trieda IIb")
        III = "III", _("Trieda III")

    class Mode(models.TextChoices):
        REPEAT = "repeat", _("Opakované použitie")
        SINGLE = "single", _("Jednorazové použitie")

    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="material_catalog")
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    manufacturer = models.ForeignKey(Manufacturer, on_delete=models.PROTECT, related_name="materials")
    category = models.CharField(max_length=100, blank=True, default="")
    unit = models.CharField(max_length=20, default="pcs")
    mdr_class = models.CharField(max_length=10, choices=MDRClass.choices, null=True, blank=True)
    mode = models.CharField(max_length=10, choices=Mode.choices, default=Mode.REPEAT)
    allow_in_job = models.BooleanField(default=True)
    stock_item = models.ForeignKey(
        WarehouseItem,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="material_catalog_entries",
    )
    note = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["code", "id"]
        constraints = [
            models.UniqueConstraint(fields=["lab", "code"], name="materials_unique_catalog_code"),
        ]

    @property
    def stock_code(self):
        return self.stock_item.sku if self.stock_item else None

    def clean(self):
        if self.manufacturer_id and self.lab_id and self.manufacturer.lab_id != self.lab_id:
            raise ValidationError({"manufacturer": _("Výrobca musí patriť do rovnakého laboratória.")})
        if self.stock_item_id and self.lab_id and self.stock_item.lab_id != self.lab_id:
            raise ValidationError({"stock_item": _("Skladová položka musí patriť do rovnakého laboratória.")})

    def __str__(self):
        return f"{self.code} – {self.name}"


class MaterialLot(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", _("Aktívna")
        OPEN = "open", _("Otvorená")
        DEPLETED = "depleted", _("Spotrebovaná")
        DISCARDED = "discarded", _("Vyradená")

    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="material_lots")
    catalog = models.ForeignKey(MaterialCatalog, on_delete=models.PROTECT, related_name="lots")
    short_code = models.CharField(max_length=50)
    lot = models.CharField(max_length=100)
    received = models.DateField(default=timezone.localdate)
    expiry = models.DateField(null=True, blank=True)
    opened = models.DateField(null=True, blank=True)
    qty_received = models.DecimalField(max_digits=12, decimal_places=3)
    qty_remaining = models.DecimalField(max_digits=12, decimal_places=3)
    status = models.CharField(max_length=12, choices=Status.choices, default=Status.ACTIVE)
    location = models.CharField(max_length=100, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = [models.F("expiry").asc(nulls_last=True), "received", "id"]
        constraints = [
            models.UniqueConstraint(fields=["lab", "short_code"], name="materials_unique_lot_short_code"),
            models.UniqueConstraint(fields=["catalog", "lot"], name="materials_unique_catalog_lot"),
            models.CheckConstraint(
                condition=models.Q(qty_received__gt=0),
                name="materials_lot_received_positive",
            ),
            models.CheckConstraint(
                condition=models.Q(qty_remaining__gte=0),
                name="materials_lot_remaining_nonnegative",
            ),
            models.CheckConstraint(
                condition=models.Q(qty_remaining__lte=models.F("qty_received")),
                name="materials_lot_remaining_lte_received",
            ),
        ]
        indexes = [
            models.Index(fields=["lab", "status", "expiry"], name="materials_lot_fefo_idx"),
        ]

    @property
    def expiry_state(self):
        if not self.expiry:
            return "none"
        days = (self.expiry - timezone.localdate()).days
        if days < 0:
            return "expired"
        if days <= 60:
            return "soon"
        return "ok"

    def clean(self):
        if self.catalog_id and self.lab_id and self.catalog.lab_id != self.lab_id:
            raise ValidationError({"catalog": _("Materiál musí patriť do rovnakého laboratória.")})
        if self.expiry and self.expiry < self.received:
            raise ValidationError({"expiry": _("Expirácia nemôže byť pred dátumom príjmu.")})

    def __str__(self):
        return f"{self.catalog.code} / {self.lot}"


class MaterialRecipe(models.Model):
    class ProductType(models.TextChoices):
        SINGLE = "single", _("Samostatná práca")
        BRIDGE = "bridge", _("Mostík")
        ARCH = "arch", _("Oblúk")
        OTHER = "other", _("Iné")

    lab = models.ForeignKey(Lab, on_delete=models.CASCADE, related_name="material_recipes")
    name = models.CharField(max_length=255)
    product_type = models.CharField(max_length=10, choices=ProductType.choices, default=ProductType.OTHER)
    mdr = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name", "id"]
        constraints = [
            models.UniqueConstraint(fields=["lab", "name"], name="materials_unique_recipe_name"),
        ]

    def __str__(self):
        return self.name


class RecipeLine(models.Model):
    recipe = models.ForeignKey(MaterialRecipe, on_delete=models.CASCADE, related_name="lines")
    catalog = models.ForeignKey(MaterialCatalog, on_delete=models.PROTECT, related_name="recipe_lines")
    qty = models.DecimalField(max_digits=12, decimal_places=3)
    note = models.TextField(blank=True, default="")

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["recipe", "catalog"], name="materials_unique_recipe_catalog"),
            models.CheckConstraint(condition=models.Q(qty__gt=0), name="materials_recipe_qty_positive"),
        ]

    def clean(self):
        if self.recipe_id and self.catalog_id and self.recipe.lab_id != self.catalog.lab_id:
            raise ValidationError({"catalog": _("Materiál musí patriť do rovnakého laboratória ako recept.")})


class MaterialUsage(models.Model):
    lab = models.ForeignKey(Lab, on_delete=models.PROTECT, related_name="material_usages")
    job = models.ForeignKey(Job, on_delete=models.PROTECT, related_name="material_usages")
    patient_label = models.CharField(max_length=255)
    technician = models.CharField(max_length=255, blank=True, default="")
    date = models.DateField(default=timezone.localdate)
    recipe = models.CharField(max_length=255, blank=True, default="")
    recipe_source = models.ForeignKey(
        MaterialRecipe,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="usages",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]
        indexes = [models.Index(fields=["lab", "job"], name="materials_usage_job_idx")]

    def __str__(self):
        return f"Job {self.job_id} – {self.date}"


class MaterialUsageLine(models.Model):
    usage = models.ForeignKey(MaterialUsage, on_delete=models.PROTECT, related_name="lines")
    source_catalog_id = models.PositiveBigIntegerField(null=True, blank=True)
    source_lot_id = models.PositiveBigIntegerField(null=True, blank=True)
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    manufacturer = models.CharField(max_length=255)
    mdr_class = models.CharField(max_length=10, null=True, blank=True)
    lot = models.CharField(max_length=100)
    expiry = models.DateField(null=True, blank=True)
    qty = models.DecimalField(max_digits=12, decimal_places=3)
    unit = models.CharField(max_length=20)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.CheckConstraint(condition=models.Q(qty__gt=0), name="materials_usage_qty_positive"),
        ]

    def save(self, *args, **kwargs):
        if self.pk:
            raise ValidationError(_("MDR snapshot riadok je nemenný."))
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError(_("MDR snapshot riadok nemožno odstrániť."))
