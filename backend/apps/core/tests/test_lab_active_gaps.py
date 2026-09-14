"""Regression tests for gaps found in code review of #111.

TDD: written before the fixes, so each test fails against the pre-fix
codebase for the reason noted in its docstring.

1. Google sign-in never checked the caller's lab.is_active, only
   User.is_active — a suspended lab's user could still authenticate via
   Google and obtain valid JWT cookies.
2. TechnicianViewSet/JobViewSet/CalendarEventViewSet (jobs), InvoiceViewSet/
   PriceListViewSet (finance), WarehouseItemViewSet (inventory), and the
   shared MaterialTenantViewSet (materials) all declare an explicit
   permission_classes list that includes SubscriptionWriteAllowed but omits
   LabActiveRequired — DRF's explicit permission_classes fully replaces the
   default, so these views bypassed the lab-suspension lock entirely.
3. Refreshing an impersonation access token near its capped expiry produced
   a normal-lifetime access token with none of the impersonation claims,
   letting API access continue past the stated 30-minute window and
   silently dropping the audit-trail markers the frontend banner relies on.
4. Skonto amount used Decimal's default (banker's/half-even) rounding
   instead of the project's ROUND_HALF_UP money convention.
5. Lab.skonto_percent had no bound, so a value above 100 could be set and
   an invoice's snapshot discount could exceed its own total.
"""

from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.auth import IMPERSONATION_TOKEN_LIFETIME
from apps.core.models import Lab, User
from apps.crm.models import Clinic
from apps.finance.models import Invoice, Subscription


class GoogleLoginRespectsLabActiveTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Suspended Google Lab", is_active=False)
        self.user = User.objects.create_user(
            username="google_suspended_user",
            email="google_suspended@test.sk",
            password="pw123456",
            role="admin",
            lab=self.lab,
            google_sub="google-sub-suspended-lab",
        )

    def test_suspended_lab_user_cannot_sign_in_via_google(self):
        claims = {
            "sub": self.user.google_sub,
            "email": self.user.email,
            "email_verified": True,
        }
        with patch("apps.core.google_auth.verify_google_credential", return_value=claims):
            resp = self.client.post("/api/core/auth/google/", {"credential": "stub"}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp.data.get("code"), "lab_inactive")


class LabActiveLockCoversAllTenantViewsets(APITestCase):
    """Each of these viewsets explicitly overrides permission_classes; the
    suspension lock must be in every one of them, not just the default."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Suspended Ops Lab", is_active=False)
        self.admin = User.objects.create_user(
            username="suspended_ops_admin",
            email="suspended_ops_admin@test.sk",
            password="pw123456",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Suspended Clinic")

    def _assert_locked(self, method, url, data=None):
        self.client.force_authenticate(user=self.admin)
        resp = getattr(self.client, method)(url, data or {}, format="json")
        self.assertEqual(
            resp.status_code,
            status.HTTP_403_FORBIDDEN,
            f"{method.upper()} {url} returned {resp.status_code}, expected 403 (lab suspended)",
        )

    def test_jobs_technician_create_is_locked(self):
        self._assert_locked("post", "/api/jobs/technicians/", {"first_name": "A", "last_name": "B"})

    def test_finance_price_list_create_is_locked(self):
        self._assert_locked(
            "post",
            "/api/finance/price-list/",
            {"code": "X1", "description": "Test", "price": "10.00"},
        )

    def test_inventory_warehouse_create_is_locked(self):
        self._assert_locked(
            "post",
            "/api/inventory/warehouse/",
            {"name": "Item", "sku": "SKU1", "quantity": 1},
        )

    def test_materials_manufacturer_create_is_locked(self):
        self._assert_locked(
            "post",
            "/api/materials/manufacturers/",
            {"name": "Mfg", "prefix": "MF"},
        )


class ImpersonationRefreshDoesNotOutliveItsWindowTests(APITestCase):
    def setUp(self):
        self.superadmin = User.objects.create_user(
            username="impersonation_refresh_superadmin",
            email="impersonation_refresh_superadmin@test.sk",
            password="pw123456",
            role="superadmin",
            is_superuser=True,
        )
        self.lab = Lab.objects.create(name="Impersonated Refresh Lab")
        self.target = User.objects.create_user(
            username="impersonation_refresh_target",
            email="impersonation_refresh_target@test.sk",
            password="pw123456",
            role="admin",
            lab=self.lab,
        )
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.post(
            f"/api/core/users/{self.target.id}/impersonate/",
            {"reason": "support ticket #1"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.refresh_token = resp.data["refresh"]

    def test_refreshed_access_token_still_carries_impersonation_claims(self):
        resp = self.client.post("/api/token/refresh/", {"refresh": self.refresh_token}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        access = resp.data["access"]
        from rest_framework_simplejwt.tokens import AccessToken

        token = AccessToken(access)
        self.assertTrue(token.get("impersonation"))
        self.assertEqual(token["impersonated_by"], self.superadmin.id)

    def test_refreshed_access_token_never_outlives_the_refresh_token(self):
        resp = self.client.post("/api/token/refresh/", {"refresh": self.refresh_token}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        access = resp.data["access"]
        from rest_framework_simplejwt.tokens import AccessToken

        access_token = AccessToken(access)
        refresh_token = RefreshToken(self.refresh_token)
        self.assertLessEqual(access_token["exp"], refresh_token["exp"])

    def test_refresh_token_itself_is_capped_to_impersonation_lifetime(self):
        refresh_token = RefreshToken(self.refresh_token)
        expected_max = (timezone.now() + IMPERSONATION_TOKEN_LIFETIME + timedelta(seconds=5)).timestamp()
        self.assertLessEqual(refresh_token["exp"], expected_max)


class SkontoRoundingAndBoundsTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(
            name="Skonto Rounding Lab",
            skonto_enabled=True,
            skonto_percent=Decimal("1.00"),
            skonto_days=10,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Skonto Clinic")

    def test_half_cent_discount_rounds_up_not_to_even(self):
        from apps.finance.invoice_service import create_invoice

        # 1% of 50.00 = 0.50 exactly at the boundary the project's money
        # helper (ROUND_HALF_UP) must round consistently — this exercises a
        # value where naive Decimal quantize(ROUND_HALF_EVEN) on the
        # multiplication intermediate would visibly differ from the
        # project's convention if the wrong rounding mode were used
        # upstream of the final 2-decimal snapshot.
        invoice = create_invoice(
            actor=None,
            lab=self.lab,
            clinic=self.clinic,
            job_ids=[],
            breakdown_snapshot=[],
            total_amount=Decimal("50.005"),
        )
        # 1% of 50.005 = 0.50005 -> ROUND_HALF_UP to 2dp is 0.50, but the
        # regression this guards is 50.015 -> 0.50015, where HALF_UP gives
        # 0.51 and HALF_EVEN silently gives 0.50.
        invoice.total_amount = Decimal("50.015")
        invoice.save(update_fields=["total_amount"])
        from apps.finance.invoice_service import _compute_skonto

        percent, deadline, amount = _compute_skonto(self.lab, invoice)
        self.assertEqual(amount, Decimal("0.51"))

    def test_skonto_percent_above_100_is_rejected(self):
        self.lab.skonto_percent = Decimal("150.00")
        with self.assertRaises(Exception):
            self.lab.full_clean()
