from rest_framework import status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from ..access import AUTHENTICATED
from ._shared import _write_audit_log


class TwoFactorView(APIView):
    """TOTP-based 2FA: setup, verify (activate), disable."""

    permission_classes = AUTHENTICATED

    def get_throttles(self):
        if self.request.method == "POST" and self.request.query_params.get("action", "setup") == "verify":
            self.throttle_scope = "two_factor_verify"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get(self, request):
        """Return current 2FA status for the user."""
        return Response({"totp_enabled": request.user.totp_enabled})

    def post(self, request):
        """
        Action-based dispatch via ?action= query param.
        setup    — generate a new TOTP secret and return the provisioning URI.
        verify   — confirm a TOTP code and activate 2FA.
        disable  — deactivate 2FA (requires current TOTP code).
        """
        import pyotp

        action_name = request.query_params.get("action", "setup")
        user = request.user

        if action_name == "setup":
            if user.totp_enabled:
                return Response(
                    {"detail": "2FA is already active. Disable it first before re-enrolling."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            secret = pyotp.random_base32()
            user.totp_secret = secret
            user.totp_enabled = False
            user.save(update_fields=["totp_secret", "totp_enabled"])
            totp = pyotp.TOTP(secret)
            issuer = "DentalApp"
            label = user.email or user.username
            provisioning_uri = totp.provisioning_uri(name=label, issuer_name=issuer)
            return Response(
                {
                    "secret": secret,
                    "provisioning_uri": provisioning_uri,
                    "message": "Scan the provisioning_uri with your authenticator app, then call verify.",
                }
            )

        if action_name == "verify":
            code = request.data.get("code", "")
            if not user.totp_secret:
                return Response(
                    {"detail": "2FA not set up. Call setup first."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            totp = pyotp.TOTP(user.totp_secret)
            if not totp.verify(code, valid_window=1):
                return Response(
                    {"detail": "Invalid TOTP code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.totp_enabled = True
            user.save(update_fields=["totp_enabled"])
            _write_audit_log(
                request,
                action="user.2fa_enabled",
                entity_type="user",
                entity_id=user.pk,
                lab=user.lab,
                description=f"2FA enabled for {user.username}",
            )
            return Response({"totp_enabled": True, "message": "2FA activated successfully."})

        if action_name == "disable":
            code = request.data.get("code", "")
            if not user.totp_enabled:
                return Response(
                    {"detail": "2FA is not active."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if not user.totp_secret:
                return Response(
                    {"detail": "2FA secret is missing. Contact support."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            totp = pyotp.TOTP(user.totp_secret)
            if not totp.verify(code, valid_window=1):
                return Response(
                    {"detail": "Invalid TOTP code."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.totp_secret = None
            user.totp_enabled = False
            user.save(update_fields=["totp_secret", "totp_enabled"])
            _write_audit_log(
                request,
                action="user.2fa_disabled",
                entity_type="user",
                entity_id=user.pk,
                lab=user.lab,
                description=f"2FA disabled for {user.username}",
            )
            return Response({"totp_enabled": False, "message": "2FA deactivated."})

        return Response(
            {"detail": f"Unknown action '{action_name}'. Use setup, verify, or disable."},
            status=status.HTTP_400_BAD_REQUEST,
        )
