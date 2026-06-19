import logging
import time
import uuid

request_logger = logging.getLogger("apps.core.request")


class RequestLogMiddleware:
    """Emit one structured log entry for every HTTP request."""

    REQUEST_ID_HEADER = "HTTP_X_REQUEST_ID"
    RESPONSE_HEADER = "X-Request-ID"

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started_at = time.monotonic()
        request_id = request.META.get(self.REQUEST_ID_HEADER) or uuid.uuid4().hex
        request.request_id = request_id

        response = None
        try:
            response = self.get_response(request)
            return response
        finally:
            duration_ms = round((time.monotonic() - started_at) * 1000, 2)
            user = self._request_user(request)
            is_authenticated = bool(
                user is not None and getattr(user, "is_authenticated", False)
            )
            lab = getattr(user, "lab", None) if is_authenticated else None
            status_code = getattr(response, "status_code", 500)

            if response is not None:
                response[self.RESPONSE_HEADER] = request_id

            request_logger.info(
                "request_completed",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "path": request.get_full_path(),
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                    "user_id": getattr(user, "id", None) if is_authenticated else None,
                    "username": (
                        getattr(user, "get_username", lambda: "")()
                        if is_authenticated
                        else ""
                    ),
                    "lab_id": getattr(lab, "id", None),
                    "remote_addr": self._client_ip(request),
                },
            )

    def _client_ip(self, request):
        forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")

    def _request_user(self, request):
        user = getattr(request, "user", None)
        if user is not None and getattr(user, "is_authenticated", False):
            return user

        try:
            from rest_framework_simplejwt.authentication import JWTAuthentication
            from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

            from apps.core.cookie_auth import _ACCESS_COOKIE
        except Exception:
            return user

        raw_token = request.COOKIES.get(_ACCESS_COOKIE)
        if raw_token is None:
            header = JWTAuthentication().get_header(request)
            raw_token = JWTAuthentication().get_raw_token(header) if header else None
        if raw_token is None:
            return user

        jwt = JWTAuthentication()
        try:
            return jwt.get_user(jwt.get_validated_token(raw_token))
        except (InvalidToken, TokenError):
            return user


class ContentSecurityPolicyMiddleware:
    """Adds a Content-Security-Policy header to every response.

    'unsafe-inline' for scripts/styles is intentional — the existing React app
    uses inline styles and script injection. Tighten after the httpOnly cookie
    migration (PR 8) stabilises the auth surface.
    """

    # cdn.jsdelivr.net is required by drf-spectacular's Swagger UI for its JS/CSS/fonts.
    CSP = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
        "img-src 'self' data: blob: https://cdn.jsdelivr.net; "
        "font-src 'self' https://cdn.jsdelivr.net; "
        "connect-src 'self'; "
        "frame-ancestors 'none';"
    )

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        response["Content-Security-Policy"] = self.CSP
        return response
