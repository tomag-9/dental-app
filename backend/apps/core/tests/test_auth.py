import pyotp

from django.core.cache import cache
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import RefreshToken

from apps.core.models import Lab, TeamInvitation, User, UserSession


class SessionEndpointsTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Session Lab")
        self.user = User.objects.create_user(
            username="sess_user",
            password="pw123",
            email="sess@test.sk",
            role="user",
            lab=self.lab,
        )

    def _make_session(self, revoked=False):
        return UserSession.objects.create(
            user=self.user,
            jti="test-jti-12345",
            ip_address="127.0.0.1",
            device_info="TestBrowser/1.0",
            expires_at=timezone.now() + timezone.timedelta(days=1),
            revoked=revoked,
        )

    def test_list_sessions_returns_active_only(self):
        self._make_session(revoked=False)
        UserSession.objects.create(
            user=self.user,
            jti="revoked-jti",
            expires_at=timezone.now() + timezone.timedelta(days=1),
            revoked=True,
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/core/sessions/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["jti"], "test-jti-12345")

    def test_revoke_session(self):
        session = self._make_session()
        self.client.force_authenticate(user=self.user)
        resp = self.client.delete(f"/api/core/sessions/{session.id}/")
        self.assertEqual(resp.status_code, 204)
        session.refresh_from_db()
        self.assertTrue(session.revoked)

    def test_revoke_all_sessions(self):
        UserSession.objects.create(
            user=self.user,
            jti="j1",
            expires_at=timezone.now() + timezone.timedelta(days=1),
        )
        UserSession.objects.create(
            user=self.user,
            jti="j2",
            expires_at=timezone.now() + timezone.timedelta(days=1),
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.delete("/api/core/sessions/revoke-all/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["revoked"], 2)

    def test_cannot_revoke_other_users_session(self):
        other_user = User.objects.create_user(
            username="other_sess",
            password="pw",
            email="other_sess@test.sk",
            lab=self.lab,
            role="user",
        )
        session = UserSession.objects.create(
            user=other_user,
            jti="other-jti",
            expires_at=timezone.now() + timezone.timedelta(days=1),
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.delete(f"/api/core/sessions/{session.id}/")
        self.assertEqual(resp.status_code, 404)


class AuthLoginFlowTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.lab = Lab.objects.create(name="Auth Flow Lab")
        self.user = User.objects.create_user(
            username="auth_user",
            password="pw123456",
            email="auth@test.sk",
            role="user",
            lab=self.lab,
        )
        self.inactive = User.objects.create_user(
            username="inactive_auth",
            password="pw123456",
            email="inactive_auth@test.sk",
            role="user",
            lab=self.lab,
            is_active=False,
        )

    def test_token_login_rejects_invalid_credentials(self):
        resp = self.client.post(
            "/api/token/",
            {"username": self.user.username, "password": "wrong"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_login_rejects_malformed_payload(self):
        resp = self.client.post("/api/token/", {"username": self.user.username})
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_token_login_rejects_inactive_user(self):
        resp = self.client.post(
            "/api/token/",
            {"username": self.inactive.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_token_login_creates_user_session(self):
        resp = self.client.post(
            "/api/token/",
            {"username": self.user.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        jti = RefreshToken(resp.data["refresh"])["jti"]
        self.assertTrue(
            UserSession.objects.filter(user=self.user, jti=jti, revoked=False).exists()
        )

    def test_session_login_creates_user_session(self):
        resp = self.client.post(
            "/api/core/auth/login/",
            {"username": self.user.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        jti = RefreshToken(resp.data["refresh"])["jti"]
        self.assertTrue(
            UserSession.objects.filter(user=self.user, jti=jti, revoked=False).exists()
        )

    def test_2fa_enabled_user_requires_totp_code_at_login(self):
        self.user.totp_secret = pyotp.random_base32()
        self.user.totp_enabled = True
        self.user.save(update_fields=["totp_secret", "totp_enabled"])

        resp = self.client.post(
            "/api/token/",
            {"username": self.user.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_2fa_enabled_user_rejects_invalid_totp_code(self):
        self.user.totp_secret = pyotp.random_base32()
        self.user.totp_enabled = True
        self.user.save(update_fields=["totp_secret", "totp_enabled"])

        resp = self.client.post(
            "/api/token/",
            {
                "username": self.user.username,
                "password": "pw123456",
                "totp_code": "000000",
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_2fa_enabled_user_can_login_with_valid_totp_code(self):
        self.user.totp_secret = pyotp.random_base32()
        self.user.totp_enabled = True
        self.user.save(update_fields=["totp_secret", "totp_enabled"])
        code = pyotp.TOTP(self.user.totp_secret).now()

        resp = self.client.post(
            "/api/token/",
            {
                "username": self.user.username,
                "password": "pw123456",
                "totp_code": code,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn("access", resp.data)
        self.assertIn("refresh", resp.data)

    def test_revoked_session_refresh_token_is_rejected(self):
        login = self.client.post(
            "/api/token/",
            {"username": self.user.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(login.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=self.user)
        revoke = self.client.delete("/api/core/sessions/revoke-all/")
        self.assertEqual(revoke.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(user=None)
        refresh = self.client.post(
            "/api/token/refresh/",
            {"refresh": login.data["refresh"]},
            format="json",
        )
        self.assertEqual(refresh.status_code, status.HTTP_401_UNAUTHORIZED)


class LogoutViewTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.lab = Lab.objects.create(name="Logout Lab")
        self.user = User.objects.create_user(
            username="logout_user",
            password="pw123456",
            email="logout@test.sk",
            role="user",
            lab=self.lab,
        )

    def _login(self):
        resp = self.client.post(
            "/api/token/",
            {"username": self.user.username, "password": "pw123456"},
            format="json",
        )
        self.assertEqual(resp.status_code, 200)
        return resp.data["access"], resp.data["refresh"]

    def test_logout_blacklists_refresh_token(self):
        access, refresh = self._login()
        resp = self.client.post(
            "/api/core/auth/logout/",
            {"refresh_token": refresh},
            format="json",
        )
        self.assertEqual(resp.status_code, 204)
        refresh_resp = self.client.post(
            "/api/token/refresh/", {"refresh": refresh}, format="json"
        )
        self.assertEqual(refresh_resp.status_code, 401)

    def test_logout_revokes_user_session(self):
        _access, refresh = self._login()
        jti = RefreshToken(refresh)["jti"]
        self.assertTrue(UserSession.objects.filter(jti=jti, revoked=False).exists())
        self.client.post(
            "/api/core/auth/logout/",
            {"refresh_token": refresh},
            format="json",
        )
        self.assertTrue(UserSession.objects.filter(jti=jti, revoked=True).exists())

    def test_logout_with_invalid_token_returns_204(self):
        resp = self.client.post(
            "/api/core/auth/logout/",
            {"refresh_token": "this.is.garbage"},
            format="json",
        )
        self.assertEqual(resp.status_code, 204)

    def test_logout_with_empty_body_returns_204(self):
        resp = self.client.post("/api/core/auth/logout/", {}, format="json")
        self.assertEqual(resp.status_code, 204)

    def test_logout_works_without_access_token(self):
        """Client with expired access token can still blacklist their refresh token."""
        _access, refresh = self._login()
        resp = self.client.post(
            "/api/core/auth/logout/",
            {"refresh_token": refresh},
            format="json",
        )
        self.assertEqual(resp.status_code, 204)


class AuthThrottleTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.lab = Lab.objects.create(name="Throttle Lab")
        self.admin = User.objects.create_user(
            username="throttle_admin",
            password="pw123456",
            email="throttle_admin@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.user = User.objects.create_user(
            username="throttle_user",
            password="pw123456",
            email="throttle_user@test.sk",
            role="user",
            lab=self.lab,
        )

    def _assert_throttled_after_allowed_responses(self, statuses, allowed_status):
        self.assertIn(status.HTTP_429_TOO_MANY_REQUESTS, statuses)
        first_throttled = statuses.index(status.HTTP_429_TOO_MANY_REQUESTS)
        self.assertGreater(first_throttled, 0)
        self.assertEqual(statuses[:first_throttled], [allowed_status] * first_throttled)

    def test_login_endpoint_is_throttled(self):
        payload = {"username": self.user.username, "password": "wrong"}
        statuses = [
            self.client.post("/api/token/", payload).status_code for _ in range(11)
        ]
        self._assert_throttled_after_allowed_responses(
            statuses, status.HTTP_401_UNAUTHORIZED
        )

    def test_signup_endpoint_is_throttled(self):
        statuses = []
        for idx in range(11):
            statuses.append(
                self.client.post(
                    "/api/core/users/signup/",
                    {
                        "lab_name": f"Throttle Signup {idx}",
                        "email": f"signup{idx}@test.sk",
                        "password": "pw123456",
                    },
                    format="json",
                ).status_code
            )
        self._assert_throttled_after_allowed_responses(
            statuses, status.HTTP_201_CREATED
        )

    def test_invitation_accept_endpoint_is_throttled(self):
        invitation = TeamInvitation.objects.create(
            lab=self.lab,
            email="invited-throttle@test.sk",
            role="user",
            token="correct-token",
            expires_at=timezone.now() + timezone.timedelta(days=1),
            invited_by=self.admin,
        )
        url = f"/api/core/team-invitations/{invitation.id}/accept/"
        payload = {"token": "wrong-token", "password": "pw123456"}

        statuses = [self.client.post(url, payload).status_code for _ in range(11)]
        self._assert_throttled_after_allowed_responses(
            statuses, status.HTTP_403_FORBIDDEN
        )

    def test_two_factor_verify_endpoint_is_throttled(self):
        self.client.force_authenticate(user=self.user)
        setup = self.client.post("/api/core/2fa/?action=setup")
        self.assertEqual(setup.status_code, status.HTTP_200_OK)
        payload = {"code": "000000"}

        statuses = [
            self.client.post("/api/core/2fa/?action=verify", payload).status_code
            for _ in range(11)
        ]
        self._assert_throttled_after_allowed_responses(
            statuses, status.HTTP_400_BAD_REQUEST
        )

    def test_api_key_create_endpoint_is_throttled(self):
        self.client.force_authenticate(user=self.admin)
        statuses = []
        for idx in range(11):
            statuses.append(
                self.client.post(
                    "/api/core/api-keys/",
                    {"name": f"Throttle Key {idx}"},
                    format="json",
                ).status_code
            )
        self._assert_throttled_after_allowed_responses(
            statuses, status.HTTP_201_CREATED
        )


class TwoFactorTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="2FA Lab")
        self.user = User.objects.create_user(
            username="tfa_user",
            password="pw",
            email="tfa@test.sk",
            role="user",
            lab=self.lab,
        )

    def test_get_2fa_status_unenrolled(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/core/2fa/")
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["totp_enabled"])

    def test_setup_returns_secret_and_uri(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post("/api/core/2fa/?action=setup")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("secret", resp.data)
        self.assertIn("provisioning_uri", resp.data)
        self.assertIn("otpauth://", resp.data["provisioning_uri"])

    def test_verify_with_valid_code_enables_2fa(self):
        import pyotp

        self.client.force_authenticate(user=self.user)
        self.client.post("/api/core/2fa/?action=setup")
        self.user.refresh_from_db()
        totp = pyotp.TOTP(self.user.totp_secret)
        code = totp.now()
        resp = self.client.post("/api/core/2fa/?action=verify", {"code": code})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.data["totp_enabled"])
        self.user.refresh_from_db()
        self.assertTrue(self.user.totp_enabled)

    def test_verify_with_invalid_code_returns_400(self):
        self.client.force_authenticate(user=self.user)
        self.client.post("/api/core/2fa/?action=setup")
        resp = self.client.post("/api/core/2fa/?action=verify", {"code": "000000"})
        self.assertEqual(resp.status_code, 400)

    def test_disable_with_valid_code_deactivates_2fa(self):
        import pyotp

        self.client.force_authenticate(user=self.user)
        self.client.post("/api/core/2fa/?action=setup")
        self.user.refresh_from_db()
        totp = pyotp.TOTP(self.user.totp_secret)
        self.client.post("/api/core/2fa/?action=verify", {"code": totp.now()})
        resp = self.client.post("/api/core/2fa/?action=disable", {"code": totp.now()})
        self.assertEqual(resp.status_code, 200)
        self.assertFalse(resp.data["totp_enabled"])

    def test_setup_blocked_when_2fa_already_active(self):
        import pyotp

        self.client.force_authenticate(user=self.user)
        self.client.post("/api/core/2fa/?action=setup")
        self.user.refresh_from_db()
        totp = pyotp.TOTP(self.user.totp_secret)
        self.client.post("/api/core/2fa/?action=verify", {"code": totp.now()})
        resp = self.client.post("/api/core/2fa/?action=setup")
        self.assertEqual(resp.status_code, 400)

    def test_disable_with_missing_secret_returns_400_not_500(self):
        self.client.force_authenticate(user=self.user)
        self.user.totp_enabled = True
        self.user.totp_secret = None
        self.user.save(update_fields=["totp_enabled", "totp_secret"])
        resp = self.client.post("/api/core/2fa/?action=disable", {"code": "123456"})
        self.assertEqual(resp.status_code, 400)

    def test_unauthenticated_denied(self):
        resp = self.client.get("/api/core/2fa/")
        self.assertEqual(resp.status_code, 401)
