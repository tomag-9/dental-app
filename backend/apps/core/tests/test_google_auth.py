"""Tests for Google (OAuth / OIDC) sign-in — issue #107.

The Google library is always mocked: no network calls are made.  ``fake_verify``
mirrors the real semantics of
``google.oauth2.id_token.verify_oauth2_token`` (signature, ``iss``, ``aud``,
``exp``) so that each rejection path is exercised distinctly instead of every
test asserting on the same generic exception.
"""

import base64
import json
import time
from datetime import timedelta
from unittest import mock

import pyotp
from django.core.cache import cache
from django.test import override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.cookie_auth import _ACCESS_COOKIE, _REFRESH_COOKIE
from apps.core.models import AuditLog, Lab, TeamInvitation, User, UserSession

CLIENT_ID = "test-client-id.apps.googleusercontent.com"
GOOGLE_ISSUER = "https://accounts.google.com"
GOOGLE_URL = "/api/v1/core/auth/google/"
LINK_URL = "/api/v1/core/auth/google/link/"


def make_credential(**overrides):
    """Build a fake ID token: base64url JSON, no real crypto involved."""
    payload = {
        "iss": GOOGLE_ISSUER,
        "aud": CLIENT_ID,
        "sub": "google-sub-1234567890",
        "email": "auth@test.sk",
        "email_verified": True,
        "exp": int(time.time()) + 3600,
        "signature_ok": True,
    }
    payload.update(overrides)
    raw = json.dumps(payload).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def fake_verify(credential, request, audience=None, **kwargs):
    padding = "=" * (-len(credential) % 4)
    payload = json.loads(base64.urlsafe_b64decode(credential + padding))
    if not payload.get("signature_ok"):
        raise ValueError("Could not verify token signature.")
    if payload.get("iss") not in ("accounts.google.com", "https://accounts.google.com"):
        raise ValueError("Wrong issuer.")
    if audience is not None and payload.get("aud") != audience:
        raise ValueError(f"Token has wrong audience {payload.get('aud')}, expected {audience}")
    if payload.get("exp", 0) < time.time():
        raise ValueError("Token expired.")
    return payload


@override_settings(GOOGLE_OAUTH_CLIENT_ID=CLIENT_ID)
class GoogleLoginTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.lab = Lab.objects.create(name="Google Lab")
        self.user = User.objects.create_user(
            username="google_user",
            password="pw123456",
            email="auth@test.sk",
            role="user",
            lab=self.lab,
        )
        patcher = mock.patch(
            "apps.core.google_auth.id_token.verify_oauth2_token",
            side_effect=fake_verify,
        )
        self.verify = patcher.start()
        self.addCleanup(patcher.stop)

    def post(self, credential=None, **extra):
        payload = {"credential": credential if credential is not None else make_credential()}
        payload.update(extra)
        return self.client.post(GOOGLE_URL, payload, format="json")

    # ------------------------------------------------------------------ happy path
    def test_valid_token_logs_user_in(self):
        resp = self.post()
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_valid_token_verifies_against_configured_client_id(self):
        self.post()
        args, kwargs = self.verify.call_args
        audience = kwargs.get("audience", args[2] if len(args) > 2 else None)
        self.assertEqual(audience, CLIENT_ID)

    def test_valid_token_sets_httponly_jwt_cookies(self):
        resp = self.post()
        for name in (_ACCESS_COOKIE, _REFRESH_COOKIE):
            self.assertIn(name, resp.cookies)
            self.assertTrue(resp.cookies[name]["httponly"])

    def test_valid_token_creates_user_session(self):
        resp = self.post()
        jti = RefreshToken(resp.data["refresh"])["jti"]
        self.assertTrue(UserSession.objects.filter(user=self.user, jti=jti, revoked=False).exists())

    def test_valid_token_writes_audit_log(self):
        self.post()
        self.assertTrue(AuditLog.objects.filter(actor=self.user, action="user.login_google").exists())

    def test_first_login_stores_google_sub(self):
        self.post()
        self.user.refresh_from_db()
        self.assertEqual(self.user.google_sub, "google-sub-1234567890")

    def test_subsequent_login_matches_on_sub_not_email(self):
        """Google e-mails can change; ``sub`` is the stable identity."""
        self.user.google_sub = "google-sub-1234567890"
        self.user.email = "renamed@test.sk"
        self.user.save(update_fields=["google_sub", "email"])
        resp = self.post(make_credential(email="brand-new-address@gmail.com"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    # ------------------------------------------------------------------ token rejection
    def test_invalid_signature_is_rejected(self):
        resp = self.post(make_credential(signature_ok=False))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn(_ACCESS_COOKIE, resp.cookies)
        self.assertNotIn(_REFRESH_COOKIE, resp.cookies)

    def test_foreign_audience_is_rejected(self):
        resp = self.post(make_credential(aud="someone-elses-client-id"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn(_ACCESS_COOKIE, resp.cookies)

    def test_expired_token_is_rejected(self):
        resp = self.post(make_credential(exp=int(time.time()) - 60))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertNotIn(_ACCESS_COOKIE, resp.cookies)

    def test_foreign_issuer_is_rejected(self):
        resp = self.post(make_credential(iss="https://evil.example.com"))
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_missing_credential_is_rejected(self):
        resp = self.client.post(GOOGLE_URL, {}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.verify.assert_not_called()

    def test_unverified_email_is_rejected(self):
        resp = self.post(make_credential(email_verified=False))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn(_ACCESS_COOKIE, resp.cookies)
        self.assertEqual(resp.data.get("code"), "google_email_unverified")

    def test_inactive_user_is_rejected(self):
        self.user.is_active = False
        self.user.save(update_fields=["is_active"])
        resp = self.post()
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn(_ACCESS_COOKIE, resp.cookies)

    def test_unused_sub_links_to_matching_email_even_if_other_subs_exist(self):
        User.objects.create_user(
            username="other_google",
            password="pw123456",
            email="other@test.sk",
            lab=self.lab,
            google_sub="google-sub-1234567890",
        )
        resp = self.post(make_credential(email="auth@test.sk", sub="different-sub"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.google_sub, "different-sub")

    def test_account_already_linked_to_another_google_identity(self):
        self.user.google_sub = "some-other-sub"
        self.user.save(update_fields=["google_sub"])
        resp = self.post()
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertNotIn(_ACCESS_COOKIE, resp.cookies)

    # ------------------------------------------------------------------ unknown e-mail
    def test_unknown_email_is_rejected_and_creates_nothing(self):
        labs_before = Lab.objects.count()
        users_before = User.objects.count()

        resp = self.post(make_credential(email="stranger@gmail.com", sub="stranger-sub"))

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(resp.data.get("code"), "google_account_unknown")
        self.assertEqual(Lab.objects.count(), labs_before)
        self.assertEqual(User.objects.count(), users_before)
        self.assertFalse(User.objects.filter(email__iexact="stranger@gmail.com").exists())
        self.assertNotIn(_ACCESS_COOKIE, resp.cookies)
        self.assertNotIn(_REFRESH_COOKIE, resp.cookies)

    def test_pending_invitation_alone_does_not_grant_access(self):
        TeamInvitation.objects.create(
            lab=self.lab,
            email="invited@test.sk",
            role="user",
            token="tok-invite-google",
            expires_at=timezone.now() + timedelta(days=1),
        )
        resp = self.post(make_credential(email="invited@test.sk", sub="invited-sub"))
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertFalse(User.objects.filter(email__iexact="invited@test.sk").exists())

    def test_accepted_invitation_user_can_sign_in_with_google(self):
        invitation = TeamInvitation.objects.create(
            lab=self.lab,
            email="invited2@test.sk",
            role="user",
            token="tok-invite-google-2",
            expires_at=timezone.now() + timedelta(days=1),
        )
        accept = self.client.post(
            f"/api/v1/core/team-invitations/{invitation.id}/accept/",
            {"token": invitation.token, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(accept.status_code, status.HTTP_200_OK)
        resp = self.post(make_credential(email="invited2@test.sk", sub="invited2-sub"))
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    # ------------------------------------------------------------------ TOTP
    def test_totp_enabled_user_cannot_bypass_2fa_via_google(self):
        self.user.totp_secret = pyotp.random_base32()
        self.user.totp_enabled = True
        self.user.save(update_fields=["totp_secret", "totp_enabled"])

        resp = self.post()
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(resp.data.get("code"), "totp_required")
        self.assertNotIn(_ACCESS_COOKIE, resp.cookies)
        self.assertFalse(UserSession.objects.filter(user=self.user).exists())

    def test_totp_enabled_user_rejects_wrong_code(self):
        self.user.totp_secret = pyotp.random_base32()
        self.user.totp_enabled = True
        self.user.save(update_fields=["totp_secret", "totp_enabled"])

        resp = self.post(totp_code="000000")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
        self.assertEqual(resp.data.get("code"), "totp_invalid")
        self.assertNotIn(_ACCESS_COOKIE, resp.cookies)

    def test_totp_enabled_user_logs_in_with_valid_code(self):
        self.user.totp_secret = pyotp.random_base32()
        self.user.totp_enabled = True
        self.user.save(update_fields=["totp_secret", "totp_enabled"])

        resp = self.post(totp_code=pyotp.TOTP(self.user.totp_secret).now())
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn(_ACCESS_COOKIE, resp.cookies)

    # ------------------------------------------------------------------ throttling
    def test_google_login_is_throttled_on_login_scope(self):
        codes = set()
        for _ in range(8):
            codes.add(self.post(make_credential(signature_ok=False)).status_code)
        self.assertIn(status.HTTP_429_TOO_MANY_REQUESTS, codes)


class GoogleConfigTests(APITestCase):
    def setUp(self):
        cache.clear()

    @override_settings(GOOGLE_OAUTH_CLIENT_ID=CLIENT_ID)
    def test_config_reports_client_id_when_configured(self):
        resp = self.client.get(GOOGLE_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertTrue(resp.data["configured"])
        self.assertEqual(resp.data["client_id"], CLIENT_ID)

    @override_settings(GOOGLE_OAUTH_CLIENT_ID="")
    def test_config_reports_not_configured_without_client_id(self):
        resp = self.client.get(GOOGLE_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["configured"])
        self.assertIsNone(resp.data["client_id"])

    @override_settings(GOOGLE_OAUTH_CLIENT_ID="")
    def test_login_returns_503_without_client_id(self):
        with mock.patch("apps.core.google_auth.id_token.verify_oauth2_token") as verify:
            resp = self.client.post(GOOGLE_URL, {"credential": make_credential()}, format="json")
        self.assertEqual(resp.status_code, status.HTTP_503_SERVICE_UNAVAILABLE)
        self.assertEqual(resp.data.get("code"), "google_not_configured")
        verify.assert_not_called()


@override_settings(GOOGLE_OAUTH_CLIENT_ID=CLIENT_ID)
class GoogleAccountLinkTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.lab = Lab.objects.create(name="Link Lab")
        self.user = User.objects.create_user(
            username="link_user",
            password="pw123456",
            email="link@test.sk",
            role="user",
            lab=self.lab,
        )
        patcher = mock.patch(
            "apps.core.google_auth.id_token.verify_oauth2_token",
            side_effect=fake_verify,
        )
        patcher.start()
        self.addCleanup(patcher.stop)
        self.client.force_authenticate(user=self.user)

    def test_link_stores_google_sub(self):
        resp = self.client.post(
            LINK_URL,
            {"credential": make_credential(email="link@test.sk", sub="link-sub-1")},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertEqual(self.user.google_sub, "link-sub-1")
        self.assertTrue(resp.data["google_linked"])

    def test_link_rejects_unverified_email(self):
        resp = self.client.post(
            LINK_URL,
            {"credential": make_credential(email_verified=False, sub="link-sub-2")},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.google_sub)

    def test_link_rejects_sub_used_by_another_account(self):
        User.objects.create_user(
            username="taken_google",
            password="pw123456",
            email="taken@test.sk",
            lab=self.lab,
            google_sub="taken-sub",
        )
        resp = self.client.post(
            LINK_URL,
            {"credential": make_credential(sub="taken-sub")},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.google_sub)

    def test_link_rejects_invalid_token(self):
        resp = self.client.post(
            LINK_URL,
            {"credential": make_credential(signature_ok=False)},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_unlink_clears_google_sub(self):
        self.user.google_sub = "link-sub-3"
        self.user.save(update_fields=["google_sub"])
        resp = self.client.delete(LINK_URL)
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.user.refresh_from_db()
        self.assertIsNone(self.user.google_sub)

    def test_unlink_refused_when_user_has_no_password(self):
        self.user.google_sub = "link-sub-4"
        self.user.set_unusable_password()
        self.user.save(update_fields=["google_sub", "password"])
        resp = self.client.delete(LINK_URL)
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.user.refresh_from_db()
        self.assertEqual(self.user.google_sub, "link-sub-4")

    def test_link_requires_authentication(self):
        self.client.force_authenticate(user=None)
        resp = self.client.post(LINK_URL, {"credential": make_credential()}, format="json")
        self.assertIn(resp.status_code, (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN))

    def test_me_exposes_google_link_state(self):
        resp = self.client.get("/api/v1/core/users/me/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertFalse(resp.data["google_linked"])
        self.assertTrue(resp.data["has_password"])
