from apps.core.access import tenant_scoped_queryset

from .models import Invoice, PriceList


def invoices_for_user(user):
    return tenant_scoped_queryset(Invoice.objects.all(), user)


def price_list_for_user(user):
    return tenant_scoped_queryset(PriceList.objects.all(), user)
