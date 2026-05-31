from django.test import TestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic
from apps.finance.models import Invoice, PriceList
from apps.finance.selectors import invoices_for_user, price_list_for_user


class FinanceSelectorTests(TestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Finance Selector Lab A")
        self.lab_b = Lab.objects.create(name="Finance Selector Lab B")
        self.user_a = User.objects.create_user(
            username="finance_selector_a",
            email="finance_selector_a@example.com",
            password="pw",
            lab=self.lab_a,
        )
        self.user_without_lab = User.objects.create_user(
            username="finance_selector_no_lab",
            email="finance_selector_no_lab@example.com",
            password="pw",
        )
        self.superadmin = User.objects.create_user(
            username="finance_selector_superadmin",
            email="finance_selector_superadmin@example.com",
            password="pw",
            role="superadmin",
            is_superuser=True,
        )
        self.clinic_a = Clinic.objects.create(lab=self.lab_a, name="Clinic A")
        self.clinic_b = Clinic.objects.create(lab=self.lab_b, name="Clinic B")
        self.invoice_a = Invoice.objects.create(
            lab=self.lab_a,
            clinic=self.clinic_a,
            number="SEL-A",
        )
        self.invoice_b = Invoice.objects.create(
            lab=self.lab_b,
            clinic=self.clinic_b,
            number="SEL-B",
        )
        self.price_a = PriceList.objects.create(
            lab=self.lab_a,
            code="SEL-A",
            description="A",
            price=10,
        )
        self.price_b = PriceList.objects.create(
            lab=self.lab_b,
            code="SEL-B",
            description="B",
            price=20,
        )

    def test_selectors_scope_to_users_lab(self):
        self.assertEqual(list(invoices_for_user(self.user_a)), [self.invoice_a])
        self.assertEqual(list(price_list_for_user(self.user_a)), [self.price_a])

    def test_selectors_return_all_for_superadmin_and_none_without_lab(self):
        self.assertCountEqual(
            invoices_for_user(self.superadmin),
            [self.invoice_a, self.invoice_b],
        )
        self.assertCountEqual(
            price_list_for_user(self.superadmin),
            [self.price_a, self.price_b],
        )
        self.assertFalse(invoices_for_user(self.user_without_lab).exists())
        self.assertFalse(price_list_for_user(self.user_without_lab).exists())
