from decimal import ROUND_HALF_UP, Decimal

MONEY = Decimal("0.01")
ONE_HUNDRED = Decimal("100")


def money(value):
    return Decimal(str(value or 0)).quantize(MONEY, rounding=ROUND_HALF_UP)


def calculate_invoice_amounts(subtotal, vat_rate=0, discount_percent=0):
    subtotal = money(subtotal)
    vat_rate = Decimal(str(vat_rate or 0))
    discount_percent = Decimal(str(discount_percent or 0))

    discount_amount = (subtotal * discount_percent / ONE_HUNDRED).quantize(MONEY, rounding=ROUND_HALF_UP)
    taxable_amount = subtotal - discount_amount
    vat_amount = (taxable_amount * vat_rate / ONE_HUNDRED).quantize(MONEY, rounding=ROUND_HALF_UP)
    total_amount = taxable_amount + vat_amount

    return {
        "subtotal_amount": subtotal,
        "discount_amount": discount_amount,
        "taxable_amount": taxable_amount,
        "vat_amount": vat_amount,
        "total_amount": total_amount,
    }


def reverse_invoice_subtotal(total, vat_rate=0, discount_percent=0):
    total = money(total)
    vat_rate = Decimal(str(vat_rate or 0))
    discount_percent = Decimal(str(discount_percent or 0))
    divisor = (Decimal("1") - discount_percent / ONE_HUNDRED) * (Decimal("1") + vat_rate / ONE_HUNDRED)
    if divisor <= 0:
        return total
    return (total / divisor).quantize(MONEY, rounding=ROUND_HALF_UP)
