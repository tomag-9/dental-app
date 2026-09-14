from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from ..auth import MolarisTokenObtainPairSerializer
from ..cookie_auth import _REFRESH_COOKIE, clear_jwt_cookies
from ..models import UserSession


class SessionLoginView(APIView):
    """JWT login that also persists a UserSession record."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [AnonRateThrottle, ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = MolarisTokenObtainPairSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class LogoutView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        # Accept refresh token from cookie (new) or request body (backward compat).
        refresh_raw = request.COOKIES.get(_REFRESH_COOKIE) or request.data.get("refresh_token")
        if refresh_raw:
            try:
                token = RefreshToken(refresh_raw)
                token.blacklist()
                UserSession.objects.filter(jti=token["jti"]).update(revoked=True)
            except TokenError:
                pass
        response = Response(status=status.HTTP_204_NO_CONTENT)
        clear_jwt_cookies(response)
        return response


class CsrfView(APIView):
    """Seeds the csrftoken cookie so the frontend can make authenticated mutations."""

    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    def get(self, request):
        from django.middleware.csrf import get_token

        return Response({"csrfToken": get_token(request)})
