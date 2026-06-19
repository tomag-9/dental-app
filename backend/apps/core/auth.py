from datetime import datetime
from datetime import timezone as datetime_timezone

import pyotp
from django.middleware.csrf import get_token as csrf_get_token
from rest_framework import permissions
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.serializers import (
    TokenObtainPairSerializer,
    TokenRefreshSerializer,
)
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from .cookie_auth import _REFRESH_COOKIE, set_jwt_cookies
from .models import UserSession


def _client_ip(request):
    if request is None:
        return None
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def record_user_session(user, refresh_token, request=None):
    token = RefreshToken(str(refresh_token))
    exp = datetime.fromtimestamp(token["exp"], tz=datetime_timezone.utc)
    device_info = ""
    if request is not None:
        device_info = request.META.get("HTTP_USER_AGENT", "")[:500]

    UserSession.objects.update_or_create(
        jti=token["jti"],
        defaults={
            "user": user,
            "ip_address": _client_ip(request),
            "device_info": device_info,
            "expires_at": exp,
            "revoked": False,
        },
    )


class MolarisTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Issue JWT tokens and enforce TOTP for users with 2FA enabled."""

    def validate(self, attrs):
        data = super().validate(attrs)

        if self.user.totp_enabled:
            code = (
                self.initial_data.get("totp_code")
                or self.initial_data.get("otp_code")
                or self.initial_data.get("code")
                or ""
            )
            if not code:
                raise AuthenticationFailed(
                    "TOTP code required.",
                    code="totp_required",
                )
            if not self.user.totp_secret:
                raise AuthenticationFailed(
                    "2FA secret is missing. Contact support.",
                    code="totp_unavailable",
                )
            totp = pyotp.TOTP(self.user.totp_secret)
            if not totp.verify(code, valid_window=1):
                raise AuthenticationFailed(
                    "Invalid TOTP code.",
                    code="totp_invalid",
                )

        request = self.context.get("request")
        record_user_session(self.user, data["refresh"], request)
        return data


class MolarisTokenRefreshSerializer(TokenRefreshSerializer):
    """Reject refresh tokens whose persisted session was revoked."""

    def validate(self, attrs):
        refresh = RefreshToken(attrs["refresh"])
        jti = refresh["jti"]
        if UserSession.objects.filter(jti=jti, revoked=True).exists():
            raise AuthenticationFailed(
                "Session has been revoked.",
                code="session_revoked",
            )
        return super().validate(attrs)


class MolarisTokenObtainPairView(TokenObtainPairView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MolarisTokenObtainPairSerializer
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        if response.status_code == 200:
            set_jwt_cookies(response, response.data["access"], response.data["refresh"])
            # Seed the CSRF cookie so the frontend can make authenticated mutations immediately.
            csrf_get_token(request)
        return response


class MolarisTokenRefreshView(TokenRefreshView):
    permission_classes = [permissions.AllowAny]
    serializer_class = MolarisTokenRefreshSerializer

    def post(self, request, *args, **kwargs):
        # Prefer refresh token from cookie; fall back to request body for backward compat.
        cookie_refresh = request.COOKIES.get(_REFRESH_COOKIE)
        # Use .copy() when available (QueryDict) to preserve scalar values; fall back to dict().
        data = (
            request.data.copy()
            if hasattr(request.data, "copy")
            else dict(request.data or {})
        )
        if cookie_refresh and not data.get("refresh"):
            data["refresh"] = cookie_refresh

        serializer = self.get_serializer(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as exc:
            raise InvalidToken(exc.args[0])

        response = Response(serializer.validated_data)
        set_jwt_cookies(
            response,
            serializer.validated_data["access"],
            # When ROTATE_REFRESH_TOKENS=True SimpleJWT issues a new refresh token;
            # fall back to the incoming cookie so the cookie always stays current.
            serializer.validated_data.get("refresh") or data.get("refresh", ""),
        )
        return response
