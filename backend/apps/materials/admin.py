from django.contrib import admin

from .models import (
    Manufacturer,
    MaterialCatalog,
    MaterialLot,
    MaterialRecipe,
    MaterialUsage,
)

admin.site.register(Manufacturer)
admin.site.register(MaterialCatalog)
admin.site.register(MaterialLot)
admin.site.register(MaterialRecipe)
admin.site.register(MaterialUsage)
