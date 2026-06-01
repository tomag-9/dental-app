"""
httpOnly JWT cookie authentication.

This module is intentionally isolated: it is referenced in DEFAULT_AUTHENTICATION_CLASSES,
which is evaluated by rest_framework.schemas at import time (triggered via
rest_framework.views → rest_framework.schemas.__init__).  Importing anything from
rest_framework_simplejwt.views at module level here would create a circular import because
rest_framework_simplejwt.views itself imports rest_framework.views → rest_framework.schemas.

Rules for this file:
  - Only import from stdlib, django.*, and rest_framework.exceptions (all fully loaded before
    DEFAULT_AUTHENTICATION_CLASSES is first accessed).
  - Import rest_framework_simplejwt.authentication lazily (inside methods).
"""

from datetime import timedelta

from django.conf import settings
from django.middleware.csrf import CsrfViewMiddleware
from rest_framework import exceptions
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

_ACCESS_COOKIE = "molaris_access"
_REFRESH_COOKIE = "molaris_refresh"


class _CSRFCheck(CsrfViewMiddleware):
    """Returns the failure reason string instead of an HttpResponse so callers can raise."""

    def _reject(self, request, reason):
        return reason


def _cookie_params():
    secure = getattr(settings, "JWT_COOKIE_SECURE", True)
    samesite = getattr(settings, "JWT_COOKIE_SAMESITE", "Strict")
    return secure, samesite


def _jwt_max_ages():
    """Derive cookie lifetimes from SIMPLE_JWT so they stay in sync with token expiry."""
    simple_jwt = getattr(settings, "SIMPLE_JWT", {})
    access = simple_jwt.get("ACCESS_TOKEN_LIFETIME", timedelta(minutes=15))
    refresh = simple_jwt.get("REFRESH_TOKEN_LIFETIME", timedelta(days=7))
    return int(access.total_seconds()), int(refresh.total_seconds())


def set_jwt_cookies(response, access, refresh):
    secure, samesite = _cookie_params()
    access_max_age, refresh_max_age = _jwt_max_ages()
    response.set_cookie(
        _ACCESS_COOKIE,
        str(access),
        max_age=access_max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )
    response.set_cookie(
        _REFRESH_COOKIE,
        str(refresh),
        max_age=refresh_max_age,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
    )


def clear_jwt_cookies(response):
    response.delete_cookie(_ACCESS_COOKIE, path="/")
    response.delete_cookie(_REFRESH_COOKIE, path="/")


class JWTCookieAuthentication:
    """Authenticates via the httpOnly access cookie; enforces CSRF on cookie-authenticated requests."""

    def _jwt(self):
        from rest_framework_simplejwt.authentication import JWTAuthentication

        return JWTAuthentication()

    def authenticate(self, request):
        raw_token = request.COOKIES.get(_ACCESS_COOKIE)
        if raw_token is None:
            return self._jwt().authenticate(request)

        jwt = self._jwt()
        try:
            validated_token = jwt.get_validated_token(raw_token)
        except (TokenError, InvalidToken):
            return None

        self._enforce_csrf(request)
        return jwt.get_user(validated_token), validated_token

    def authenticate_header(self, request):
        return 'Bearer realm="api"'

    def _enforce_csrf(self, request):
        checker = _CSRFCheck(get_response=lambda req: None)
        checker.process_request(request)
        reason = checker.process_view(request, None, (), {})
        if reason:
            raise exceptions.PermissionDenied(f"CSRF Failed: {reason}")
