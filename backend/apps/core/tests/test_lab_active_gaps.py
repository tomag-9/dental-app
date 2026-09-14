"""Regression tests for gaps found in code review of #111 and #126.

TDD: written before the fixes, so each test fails against the pre-fix
codebase for the reason noted in its docstring.

1. Google sign-in never checked the caller's lab.is_active, only
   User.is_active — a suspended lab's user could still authenticate via
   Google and obtain valid JWT cookies.
2. TechnicianViewSet (jobs), PriceListViewSet (finance), WarehouseItemViewSet
   (inventory), and the shared MaterialTenantViewSet (materials) all declare
   an explicit permission_classes list that includes SubscriptionWriteAllowed
   but omits LabActiveRequired — DRF's explicit permission_classes fully
   replaces the default, so these views bypassed the lab-suspension lock
   entirely.
3. Refreshing an impersonation access token near its capped expiry produced
   a normal-lifetime access token with none of the impersonation claims,
   letting API access continue past the stated 30-minute window and
   silently dropping the audit-trail markers the frontend banner relies on.
4. Skonto amount used Decimal's implicit default (half-even) rounding
   instead of the project's ROUND_HALF_UP money convention (see
   apps.finance.calculations.money / calculate_invoice_amounts).
"""

from decimal import Decimal
from unittest.mock import patch

from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken, RefreshToken

from apps.core.models import Lab, User
from apps.core.views import IMPERSONATION_TOKEN_LIFETIME
from apps.crm.models import Clinic, Patient
from apps.finance import invoice_service
from apps.jobs.models import Job


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
            f"/api/core/users/superadmin/{self.target.id}/impersonate/",
            {"reason": "support ticket #1"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.refresh_token = resp.data["refresh_token"]

    def test_refreshed_access_token_still_carries_impersonation_claims(self):
        resp = self.client.post("/api/token/refresh/", {"refresh": self.refresh_token}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        token = AccessToken(resp.data["access"])
        self.assertTrue(token.get("impersonation"))
        self.assertEqual(token["impersonated_by"], self.superadmin.id)

    def test_refreshed_access_token_never_outlives_the_refresh_token(self):
        resp = self.client.post("/api/token/refresh/", {"refresh": self.refresh_token}, format="json")
        self.assertEqual(resp.status_code, 200, resp.data)
        access_token = AccessToken(resp.data["access"])
        refresh_token = RefreshToken(self.refresh_token)
        self.assertLessEqual(access_token["exp"], refresh_token["exp"])

    def test_refresh_token_itself_is_capped_to_impersonation_lifetime(self):
        refresh_token = RefreshToken(self.refresh_token)
        max_allowed = timezone.now().timestamp() + IMPERSONATION_TOKEN_LIFETIME.total_seconds() + 5
        self.assertLessEqual(refresh_token["exp"], max_allowed)


class SkontoRoundingTests(APITestCase):
    """48.50 * 1% = 0.485 exactly: HALF_UP -> 0.49, the wrong default
    (HALF_EVEN, since the preceding digit 8 is already even) -> 0.48."""

    def setUp(self):
        self.lab = Lab.objects.create(
            name="Skonto Rounding Lab",
            vat_rate=Decimal("0"),
            is_vat_payer=False,
            skonto_enabled=True,
            skonto_percent=Decimal("1.00"),
            skonto_days=10,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Skonto Clinic")
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="Skonto",
            last_name="Patient",
            birth_number="900101/1234",
        )
        self.job = Job.objects.create(
            lab=self.lab,
            patient=self.patient,
            clinic=self.clinic,
            status="completed",
            price="48.50",
            description="Skonto rounding job",
        )

    def test_half_cent_skonto_rounds_half_up(self):
        invoice = invoice_service.create_invoice(actor=None, clinic=self.clinic, jobs=[self.job])
        self.assertEqual(invoice.total_amount, Decimal("48.50"))
        self.assertEqual(invoice.skonto_amount, Decimal("0.49"))
