"""Sign in with Google — ID token verification and account linking (#107).

Deliberately *not* ``django-allauth``: allauth brings its own models, templates
and a session-based flow that collides with the httpOnly JWT cookie
authentication in :mod:`apps.core.cookie_auth`.  Verifying a Google ID token is
a small amount of code that fits the existing layer as-is.

Security invariants enforced here:

* The token is **never** decoded without verifying its signature — the whole
  check (signature against Google's public keys, ``aud`` against our client ID,
  ``iss``, ``exp``) is delegated to
  :func:`google.oauth2.id_token.verify_oauth2_token`.
* ``email_verified`` must be true, otherwise merely controlling someone else's
  address would be enough to take over their account.
* An unknown e-mail never creates a ``User`` or a ``Lab``.  Self-service tenant
  creation through Google would hand anyone with a Google account an admin role
  in a fresh tenant, bypassing registration and billing.
* Accounts are matched on Google's stable ``sub``; the e-mail only bootstraps
  the first pairing.
* ``totp_enabled`` users still have to pass the TOTP step, so a third party
  cannot be used to skip 2FA.
"""

import pyotp
from django.conf import settings
from django.middleware.csrf import get_token as csrf_get_token
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView

from .auth import MolarisTokenObtainPairSerializer, _client_ip, record_user_session
from .cookie_auth import set_jwt_cookies
from .models import AuditLog, User

try:  # pragma: no cover - exercised implicitly by the import working or not
    from google.auth.transport import requests as google_requests
    from google.oauth2 import id_token
except ImportError:  # pragma: no cover - keeps dev/CI runnable without the dep
    google_requests = None
    id_token = None

UNKNOWN_ACCOUNT_MESSAGE = (
    "Tento Google účet nie je priradený k žiadnemu laboratóriu. Požiadajte administrátora o pozvánku."
)


class GoogleAuthError(Exception):
    """Google sign-in was refused. Carries the HTTP shape of the refusal."""

    def __init__(self, detail, code, status_code):
        super().__init__(detail)
        self.detail = detail
        self.code = code
        self.status_code = status_code

    def as_response(self):
        return Response({"detail": self.detail, "code": self.code}, status=self.status_code)


def google_client_id():
    return (getattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "") or "").strip()


def google_login_available():
    """Google sign-in is only offered when configured *and* the library is present."""
    return bool(google_client_id()) and id_token is not None


def _require_configured():
    if not google_login_available():
        raise GoogleAuthError(
            "Prihlásenie cez Google nie je na tomto serveri nakonfigurované.",
            "google_not_configured",
            status.HTTP_503_SERVICE_UNAVAILABLE,
        )


def verify_google_credential(credential):
    """Verify a Google ID token and return its claims.

    Every failure mode of ``verify_oauth2_token`` (bad signature, foreign
    ``aud``, wrong ``iss``, expired token) surfaces as ``ValueError`` and is
    mapped to a single 401 — the client must not be told which check failed.
    """
    _require_configured()
    if not credential or not isinstance(credential, str):
        raise GoogleAuthError(
            "Chýba Google prihlasovací token.",
            "google_credential_missing",
            status.HTTP_400_BAD_REQUEST,
        )

    request_adapter = google_requests.Request() if google_requests is not None else None
    try:
        claims = id_token.verify_oauth2_token(credential, request_adapter, google_client_id())
    except ValueError as exc:
        raise GoogleAuthError(
            "Google prihlasovací token je neplatný.",
            "google_token_invalid",
            status.HTTP_401_UNAUTHORIZED,
        ) from exc

    if not claims.get("sub"):
        raise GoogleAuthError(
            "Google prihlasovací token je neplatný.",
            "google_token_invalid",
            status.HTTP_401_UNAUTHORIZED,
        )

    if not claims.get("email_verified"):
        raise GoogleAuthError(
            "Google e-mail nie je overený, prihlásenie nie je možné.",
            "google_email_unverified",
            status.HTTP_403_FORBIDDEN,
        )

    if not claims.get("email"):
        raise GoogleAuthError(
            "Google účet neposkytol e-mailovú adresu.",
            "google_email_missing",
            status.HTTP_403_FORBIDDEN,
        )

    return claims


def _resolve_user(claims):
    """Match an existing user. Never creates a User or a Lab."""
    sub = claims["sub"]
    user = User.objects.filter(google_sub=sub).first()
    if user is not None:
        return user

    user = User.objects.filter(email__iexact=claims["email"]).first()
    if user is None:
        raise GoogleAuthError(
            UNKNOWN_ACCOUNT_MESSAGE,
            "google_account_unknown",
            status.HTTP_403_FORBIDDEN,
        )
    if user.google_sub:
        # The account is already bound to a different Google identity — do not
        # silently rebind it on the strength of a matching e-mail.
        raise GoogleAuthError(
            "Tento účet je už prepojený s iným Google účtom.",
            "google_account_mismatch",
            status.HTTP_403_FORBIDDEN,
        )
    user.google_sub = sub
    user.save(update_fields=["google_sub"])
    return user


def _enforce_totp(user, data):
    if not user.totp_enabled:
        return
    code = str(data.get("totp_code") or data.get("otp_code") or data.get("code") or "").strip()
    if not code:
        raise GoogleAuthError("TOTP code required.", "totp_required", status.HTTP_401_UNAUTHORIZED)
    if not user.totp_secret:
        raise GoogleAuthError(
            "2FA secret is missing. Contact support.",
            "totp_unavailable",
            status.HTTP_401_UNAUTHORIZED,
        )
    if not pyotp.TOTP(user.totp_secret).verify(code, valid_window=1):
        raise GoogleAuthError("Invalid TOTP code.", "totp_invalid", status.HTTP_401_UNAUTHORIZED)


class GoogleLoginView(APIView):
    """``GET`` reports the public config; ``POST`` exchanges an ID token for JWT cookies."""

    permission_classes = [permissions.AllowAny]
    # No authentication: a stale access cookie must not make the login endpoint
    # demand CSRF via JWTCookieAuthentication.
    authentication_classes = []
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = "login"

    def get_throttles(self):
        if self.request.method == "GET":
            return []
        return super().get_throttles()

    def get(self, request):
        configured = google_login_available()
        return Response(
            {
                "configured": configured,
                "client_id": google_client_id() if configured else None,
            }
        )

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        try:
            claims = verify_google_credential(data.get("credential"))
            user = _resolve_user(claims)
            if not user.is_active:
                raise GoogleAuthError(
                    "Účet je deaktivovaný.",
                    "account_inactive",
                    status.HTTP_403_FORBIDDEN,
                )
            _enforce_totp(user, data)
        except GoogleAuthError as exc:
            return exc.as_response()

        refresh = MolarisTokenObtainPairSerializer.get_token(user)
        access = refresh.access_token
        record_user_session(user, refresh, request)

        AuditLog.objects.create(
            actor=user,
            lab=user.lab,
            action="user.login_google",
            entity_type="user",
            entity_id=str(user.pk),
            description=f"Google login for {user.username}",
            metadata={"email": claims.get("email", "")},
            ip_address=_client_ip(request),
        )

        response = Response({"access": str(access), "refresh": str(refresh)})
        set_jwt_cookies(response, str(access), str(refresh))
        # Seed the CSRF cookie so the frontend can mutate right after login.
        csrf_get_token(request)
        return response


class GoogleAccountLinkView(APIView):
    """Link (``POST``) or unlink (``DELETE``) the signed-in user's Google account."""

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = request.data if isinstance(request.data, dict) else {}
        try:
            claims = verify_google_credential(data.get("credential"))
        except GoogleAuthError as exc:
            return exc.as_response()

        sub = claims["sub"]
        user = request.user
        if User.objects.filter(google_sub=sub).exclude(pk=user.pk).exists():
            return Response(
                {
                    "detail": "Tento Google účet je už prepojený s iným používateľom.",
                    "code": "google_sub_taken",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.google_sub = sub
        user.save(update_fields=["google_sub"])
        AuditLog.objects.create(
            actor=user,
            lab=user.lab,
            action="user.google_linked",
            entity_type="user",
            entity_id=str(user.pk),
            description=f"Google account linked to {user.username}",
            metadata={"email": claims.get("email", "")},
            ip_address=_client_ip(request),
        )
        return Response(
            {
                "google_linked": True,
                "google_email": claims.get("email", ""),
                "has_password": user.has_usable_password(),
            }
        )

    def delete(self, request):
        user = request.user
        if not user.has_usable_password():
            # Unlinking would leave the account with no way in at all.
            return Response(
                {
                    "detail": "Najprv si nastavte heslo, inak by ste stratili prístup k účtu.",
                    "code": "password_required",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not user.google_sub:
            return Response(
                {"detail": "Google účet nie je prepojený.", "code": "google_not_linked"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.google_sub = None
        user.save(update_fields=["google_sub"])
        AuditLog.objects.create(
            actor=user,
            lab=user.lab,
            action="user.google_unlinked",
            entity_type="user",
            entity_id=str(user.pk),
            description=f"Google account unlinked from {user.username}",
            metadata={},
            ip_address=_client_ip(request),
        )
        return Response({"google_linked": False, "has_password": True})
