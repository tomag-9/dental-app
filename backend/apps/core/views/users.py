import logging
import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from apps.finance import stripe_service
from apps.finance.models import Subscription

from .. import user_service
from ..access import AUTHENTICATED, is_admin_or_superadmin, is_superadmin
from ..models import AuditLog, Lab, Notification, TeamInvitation, User, UserSession
from ..serializers import (
    MeUpdateSerializer,
    PasswordChangeSerializer,
    SignupRequestSerializer,
    SignupResponseSerializer,
    TeamInvitationAcceptSerializer,
    TeamInvitationSerializer,
    UserSerializer,
)
from ._shared import IMPERSONATION_TOKEN_LIFETIME, _client_ip, _write_audit_log

logger = logging.getLogger(__name__)

#: Length of the free trial a new signup starts with (#106).
SUBSCRIPTION_TRIAL_DAYS = 14


def _send_invitation_email(invitation):
    from django.conf import settings as django_settings
    from django.core.mail import send_mail

    base_url = getattr(django_settings, "FRONTEND_BASE_URL", "http://localhost:5173")
    join_url = f"{base_url}/join?token={invitation.token}&invitation={invitation.id}"
    lab_name = invitation.lab.name if invitation.lab else "Dental Lab"
    subject = f"Pozvánka do laboratória {lab_name}"
    message = (
        f"Boli ste pozvaní do laboratória {lab_name}.\n\n"
        f"Rola: {invitation.role}\n"
        f"Platnosť: do {invitation.expires_at.strftime('%d.%m.%Y %H:%M')}\n\n"
        f"Prijmite pozvánku kliknutím na odkaz:\n{join_url}\n\n"
        f"Ak ste túto pozvánku neočakávali, ignorujte tento email."
    )
    try:
        send_mail(
            subject,
            message,
            django_settings.DEFAULT_FROM_EMAIL,
            [invitation.email],
            fail_silently=True,
        )
    except Exception:
        pass


def _send_welcome_email(lab, user):
    """Best-effort welcome email for a freshly signed-up lab admin (#106)."""
    from django.conf import settings as django_settings
    from django.core.mail import send_mail

    if not user.email:
        return
    subject = f"Vitajte v Molaris, {lab.name}!"
    message = (
        f"Ahoj{f' {user.first_name}' if user.first_name else ''},\n\n"
        f"váš účet pre laboratórium {lab.name} bol úspešne vytvorený.\n"
        f"Máte {SUBSCRIPTION_TRIAL_DAYS} dní skúšobnej doby na vyskúšanie všetkých funkcií zadarmo.\n\n"
        f"Prihláste sa a doplňte údaje laboratória, aby ste mohli vystavovať faktúry a protetické štítky.\n\n"
        f"Tím Molaris"
    )
    try:
        send_mail(
            subject,
            message,
            django_settings.DEFAULT_FROM_EMAIL,
            [user.email],
            fail_silently=True,
        )
    except Exception:
        logger.exception("Welcome email failed to send for lab %s", lab.id)


def _build_unique_username(base_value):
    base = (base_value or "user").strip().replace(" ", "_").lower()[:120] or "user"
    candidate = base
    idx = 1
    while User.objects.filter(username=candidate).exists():
        idx += 1
        candidate = f"{base}_{idx}"
    return candidate


def _assert_seat_available(lab):
    """Enforce ``Subscription.seats`` when a lab invites someone.

    Plans are flat — one price regardless of head count — so ``seats`` is not a
    billing quantity. It is the only place it means anything: the size of the
    team the plan allows. Pending invitations count, otherwise a lab could
    queue up unlimited members and blow past the limit on acceptance.
    """
    from apps.finance.models import Subscription

    subscription = Subscription.objects.filter(lab=lab).only("seats").first()
    if subscription is None or not subscription.seats:
        return

    used = User.objects.filter(lab=lab, is_active=True).count()
    pending = TeamInvitation.objects.filter(lab=lab, status="pending").count()
    if used + pending >= subscription.seats:
        raise ValidationError(
            {
                "detail": (
                    f"Váš plán umožňuje {subscription.seats} používateľov a limit je vyčerpaný "
                    f"({used} členov, {pending} čakajúcich pozvánok). "
                    "Zvýšte počet miest v nastaveniach predplatného."
                )
            }
        )


class TeamInvitationViewSet(viewsets.ModelViewSet):
    queryset = TeamInvitation.objects.all()
    serializer_class = TeamInvitationSerializer
    permission_classes = AUTHENTICATED

    def get_throttles(self):
        if self.action == "accept":
            self.throttle_scope = "invitation_accept"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def get_permissions(self):
        if self.action == "accept":
            return [permissions.AllowAny()]
        return super().get_permissions()

    def get_queryset(self):
        qs = TeamInvitation.objects.select_related("lab", "invited_by", "accepted_by")
        user = self.request.user
        if is_superadmin(user):
            return qs
        if is_admin_or_superadmin(user) and getattr(user, "lab_id", None):
            return qs.filter(lab_id=user.lab_id)
        return qs.none()

    def _assert_can_manage_invitations(self, user):
        if not is_admin_or_superadmin(user):
            raise PermissionDenied("Pozvánky môže spravovať iba administrátor alebo superadministrátor")

    def create(self, request, *args, **kwargs):
        self._assert_can_manage_invitations(request.user)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._assert_can_manage_invitations(request.user)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._assert_can_manage_invitations(request.user)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._assert_can_manage_invitations(request.user)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        user = self.request.user
        lab = serializer.validated_data.get("lab")
        if is_superadmin(user):
            if lab is None:
                raise ValidationError({"lab": "Lab must be provided"})
        else:
            lab = user.lab
        _assert_seat_available(lab)
        invitation = serializer.save(
            lab=lab,
            invited_by=user,
            token=secrets.token_urlsafe(32),
            status="pending",
            expires_at=timezone.now() + timedelta(days=7),
        )
        _write_audit_log(
            self.request,
            action="team_invitation.created",
            entity_type="team_invitation",
            entity_id=invitation.id,
            lab=invitation.lab,
            description=f"Invitation sent to {invitation.email}",
            metadata={"role": invitation.role},
        )
        _send_invitation_email(invitation)

    @action(
        detail=True,
        methods=["post"],
        permission_classes=[permissions.AllowAny],
    )
    @transaction.atomic
    def accept(self, request, pk=None):
        invitation = TeamInvitation.objects.select_related("lab").filter(pk=pk).first()
        if invitation is None:
            return Response({"detail": "Invitation not found"}, status=status.HTTP_404_NOT_FOUND)

        serializer = TeamInvitationAcceptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        if data["token"] != invitation.token:
            raise PermissionDenied("Invalid invitation token")
        if invitation.status != "pending":
            raise ValidationError({"detail": "Invitation is not pending"})
        if invitation.expires_at <= timezone.now():
            invitation.status = "expired"
            invitation.save(update_fields=["status"])
            raise ValidationError({"detail": "Invitation has expired"})

        user = User.objects.filter(email__iexact=invitation.email).first()
        if user:
            if user.lab_id and user.lab_id != invitation.lab_id:
                raise ValidationError({"email": "User already belongs to another lab"})
            user.lab = invitation.lab
            user.role = invitation.role
            user.is_active = True
            user.save(update_fields=["lab", "role", "is_active"])
        else:
            password = data.get("password")
            if not password:
                raise ValidationError({"password": "Password is required"})
            username = _build_unique_username(data.get("username") or invitation.email.split("@")[0])
            user = User.objects.create_user(
                username=username,
                email=invitation.email,
                password=password,
                role=invitation.role,
                lab=invitation.lab,
                is_active=True,
            )

        invitation.status = "accepted"
        invitation.accepted_by = user
        invitation.accepted_at = timezone.now()
        invitation.save(update_fields=["status", "accepted_by", "accepted_at"])
        AuditLog.objects.create(
            actor=user,
            lab=invitation.lab,
            action="team_invitation.accepted",
            entity_type="team_invitation",
            entity_id=str(invitation.id),
            description=f"Invitation accepted by {user.email}",
            metadata={"role": invitation.role},
            ip_address=_client_ip(request),
        )
        return Response(
            {
                "invitation": TeamInvitationSerializer(invitation).data,
                "user": UserSerializer(user).data,
            }
        )

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        self._assert_can_manage_invitations(request.user)
        invitation = self.get_object()
        if invitation.status != "pending":
            raise ValidationError({"detail": "Only pending invitations can be cancelled"})
        invitation.status = "cancelled"
        invitation.save(update_fields=["status"])
        _write_audit_log(
            request,
            action="team_invitation.cancelled",
            entity_type="team_invitation",
            entity_id=invitation.id,
            lab=invitation.lab,
            description=f"Invitation cancelled for {invitation.email}",
        )
        return Response(self.get_serializer(invitation).data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = AUTHENTICATED

    def get_throttles(self):
        if self.action == "signup":
            self.throttle_scope = "signup"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def _assert_can_manage_users(self, requester):
        if not is_admin_or_superadmin(requester):
            raise PermissionDenied("Používateľov môže spravovať iba administrátor alebo superadministrátor")

    def _assert_in_scope_or_superadmin(self, requester, target):
        if is_superadmin(requester):
            return
        if getattr(requester, "lab_id", None) != getattr(target, "lab_id", None):
            raise PermissionDenied("Cannot manage users from another lab")

    def _precheck_target_scope(self, requester):
        lookup_kwarg = self.lookup_url_kwarg or self.lookup_field
        target_user_id = self.kwargs.get(lookup_kwarg)
        if not target_user_id:
            return
        target = User.objects.filter(pk=target_user_id).first()
        if target is None:
            return
        self._assert_in_scope_or_superadmin(requester, target)

    def _validate_update_contract(self, requester, target, data):
        def requested_bool(value):
            if isinstance(value, str):
                return value.lower() not in ("false", "0", "no", "")
            return bool(value)

        if is_superadmin(requester):
            return
        if is_superadmin(target):
            raise PermissionDenied("Cannot manage superadmin users")

        requested_role = data.get("role")
        if requested_role == "superadmin":
            raise PermissionDenied("Only superadmin can assign superadmin role")
        if target.id == requester.id and requested_role and requested_role != target.role:
            raise PermissionDenied("Cannot change your own role")

        if "lab" in data:
            try:
                requested_lab_id = int(data["lab"])
            except (TypeError, ValueError):
                raise ValidationError({"lab": "Invalid lab"})
            if requested_lab_id != getattr(requester, "lab_id", None):
                raise PermissionDenied("Cannot move users to another lab")

        if "is_active" in data and requested_bool(data["is_active"]) != target.is_active:
            raise PermissionDenied("Only superadmin can change user active state")

    def _audit_snapshot(self, user):
        return {
            "email": user.email,
            "role": user.role,
            "lab_id": user.lab_id,
            "is_active": user.is_active,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "nickname": user.nickname,
        }

    def _audit_changed_fields(self, before, user):
        after = self._audit_snapshot(user)
        return sorted(field for field, value in before.items() if after[field] != value)

    def get_queryset(self):
        user = self.request.user
        if is_superadmin(user):
            return User.objects.all()
        if is_admin_or_superadmin(user) and getattr(user, "lab", None):
            return User.objects.filter(lab=user.lab).exclude(role="superadmin")
        return User.objects.none()

    def list(self, request, *args, **kwargs):
        self._assert_can_manage_users(request.user)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self._assert_can_manage_users(request.user)
        self._precheck_target_scope(request.user)
        obj = self.get_object()
        self._assert_in_scope_or_superadmin(request.user, obj)
        serializer = self.get_serializer(obj)
        return Response(serializer.data)

    def update(self, request, *args, **kwargs):
        self._assert_can_manage_users(request.user)
        self._precheck_target_scope(request.user)
        target = self.get_object()
        self._assert_in_scope_or_superadmin(request.user, target)
        self._validate_update_contract(request.user, target, request.data)
        self._audit_before_update = self._audit_snapshot(target)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._assert_can_manage_users(request.user)
        self._precheck_target_scope(request.user)
        target = self.get_object()
        self._assert_in_scope_or_superadmin(request.user, target)
        self._validate_update_contract(request.user, target, request.data)
        self._audit_before_update = self._audit_snapshot(target)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._assert_can_manage_users(request.user)
        self._precheck_target_scope(request.user)
        target = self.get_object()
        self._assert_in_scope_or_superadmin(request.user, target)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        user_service.create_user(self.request.user, serializer)

    def perform_update(self, serializer):
        user_service.update_user(self.request.user, serializer.instance, serializer, self.request.data)

    def perform_destroy(self, instance):
        user_service.delete_user(self.request.user, instance)

    @action(
        detail=False,
        methods=["post"],
        permission_classes=[permissions.AllowAny],
        url_path="signup",
    )
    def signup(self, request):
        serializer = SignupRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            if Lab.objects.filter(name=data["lab_name"]).exists():
                return Response(
                    {"detail": "Lab name already exists"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if data.get("email") and User.objects.filter(email=data["email"]).exists():
                return Response(
                    {"detail": "Email already registered"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            lab = Lab.objects.create(
                name=data["lab_name"],
                address=data.get("lab_address") or None,
                city=data.get("lab_city") or None,
                email=data.get("lab_email") or data.get("email"),
            )

            username_base = data.get("nickname") or (data.get("email") or "admin").split("@")[0]
            username = _build_unique_username(username_base)

            user = User.objects.create_user(
                username=username,
                nickname=data.get("nickname") or None,
                email=data.get("email"),
                password=data["password"],
                role="admin",
                lab=lab,
                is_active=True,
            )

            Subscription.objects.create(
                lab=lab,
                plan="free",
                status=Subscription.STATUS_TRIALING,
                seats=5,
                trial_ends_at=(timezone.now() + timedelta(days=SUBSCRIPTION_TRIAL_DAYS)).date(),
            )

        # Stripe customer creation is best-effort: with STRIPE_SECRET_KEY unset
        # (dev/CI) the module is disabled and this is a no-op, and a network
        # failure here must never block account creation.
        if stripe_service.stripe_enabled():
            try:
                stripe_service.ensure_customer(lab)
            except Exception:
                logger.exception("Stripe customer creation failed during signup for lab %s", lab.id)

        _send_welcome_email(lab, user)

        refresh = RefreshToken.for_user(user)
        payload = {
            "lab": lab,
            "user": user,
            "token": {
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
                "token_type": "bearer",
            },
        }
        out = SignupResponseSerializer(payload)
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get", "put"], url_path="me")
    def me(self, request):
        user = request.user
        if request.method == "GET":
            return Response(UserSerializer(user).data)

        serializer = MeUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if "nickname" in data and data["nickname"] != user.nickname:
            nickname = data["nickname"] or None
            if nickname and User.objects.filter(nickname=nickname).exclude(id=user.id).exists():
                return Response(
                    {"detail": "Nickname already registered"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.nickname = nickname

        if "email" in data and data["email"] != user.email:
            email = data["email"]
            if email and User.objects.filter(email=email).exclude(id=user.id).exists():
                return Response(
                    {"detail": "Email already registered"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            user.email = email

        if "first_name" in data:
            user.first_name = data["first_name"]

        if "last_name" in data:
            user.last_name = data["last_name"]

        if "notification_preferences" in data:
            user.notification_preferences = data["notification_preferences"] or {}

        target_role = data.get("role")
        if target_role and target_role != user.role:
            if target_role == "superadmin" and not is_superadmin(user):
                raise PermissionDenied("Rolu superadministrátora môže priradiť iba superadministrátor")
            if target_role == "admin" and user.role not in ("admin", "superadmin"):
                raise PermissionDenied("Rolu administrátora môže priradiť iba administrátor alebo superadministrátor")
            user.role = target_role

        if data.get("password"):
            user.set_password(data["password"])

        user.save()
        return Response(UserSerializer(user).data)

    @action(detail=False, methods=["post"], url_path="me/password")
    def change_password(self, request):
        serializer = PasswordChangeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        user = request.user

        if not user.check_password(data["current_password"]):
            return Response(
                {"current_password": "Current password is incorrect"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(data["new_password"])
        user.save(update_fields=["password"])
        UserSession.objects.filter(user=user, revoked=False).update(revoked=True)
        _write_audit_log(
            request,
            action="user.password_changed",
            entity_type="user",
            entity_id=user.id,
            lab=user.lab,
            description=f"User {user.username} changed password",
        )
        return Response({"detail": "Password changed"})

    @action(detail=False, methods=["get"], url_path="superadmin/all")
    def superadmin_all(self, request):
        if not is_superadmin(request.user):
            raise PermissionDenied("Superadmin only endpoint")

        result = []
        for user in User.objects.select_related("lab").all():
            result.append(
                {
                    "id": user.id,
                    "username": user.username,
                    "nickname": user.nickname,
                    "email": user.email,
                    "role": user.role,
                    "is_active": user.is_active,
                    "lab_id": user.lab_id,
                    "lab_name": user.lab.name if user.lab else None,
                    "date_joined": user.date_joined,
                }
            )
        return Response(result)

    @action(detail=False, methods=["patch"], url_path="me/avatar")
    def update_avatar(self, request):
        user = request.user
        avatar_url = request.data.get("avatar_url", "")
        user.avatar_url = avatar_url or None
        user.save(update_fields=["avatar_url"])
        return Response({"avatar_url": user.avatar_url})

    @action(
        detail=False,
        methods=["put"],
        url_path=r"superadmin/(?P<target_user_id>[^/.]+)/toggle-active",
    )
    def toggle_active(self, request, target_user_id=None):
        if not is_superadmin(request.user):
            raise PermissionDenied("Superadmin only endpoint")

        try:
            target = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        target.is_active = not target.is_active
        target.save(update_fields=["is_active"])
        _write_audit_log(
            request,
            action="user.toggle_active",
            entity_type="user",
            entity_id=target.id,
            lab=target.lab,
            description=f"User {target.username} active={target.is_active}",
            metadata={"is_active": target.is_active},
        )
        return Response({"id": target.id, "is_active": target.is_active})

    @action(
        detail=False,
        methods=["post"],
        url_path=r"superadmin/(?P<target_user_id>[^/.]+)/impersonate",
    )
    def impersonate(self, request, target_user_id=None):
        if not is_superadmin(request.user):
            raise PermissionDenied("Superadmin only endpoint")

        reason = (request.data.get("reason") or "").strip()
        if not reason:
            raise ValidationError({"reason": "Uveďte dôvod prihlásenia za používateľa."})

        try:
            target = User.objects.select_related("lab").get(id=target_user_id)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Impersonation is access to another lab's health-records-adjacent data,
        # so the token is deliberately short-lived (unlike a normal login) and
        # carries claims the frontend uses to render an unmistakable banner.
        refresh = RefreshToken.for_user(target)
        refresh.set_exp(lifetime=IMPERSONATION_TOKEN_LIFETIME)
        refresh["impersonation"] = True
        refresh["impersonated_by"] = request.user.id
        access = refresh.access_token
        access.set_exp(lifetime=IMPERSONATION_TOKEN_LIFETIME)
        access["impersonation"] = True
        access["impersonated_by"] = request.user.id
        access["impersonated_by_username"] = request.user.username

        _write_audit_log(
            request,
            action="user.impersonated",
            entity_type="user",
            entity_id=target.id,
            lab=target.lab,
            description=f"Superadmin {request.user.username} impersonated {target.username}",
            metadata={"impersonated_by": request.user.id, "reason": reason},
        )

        if target.lab_id:
            recipients = list(User.objects.filter(lab_id=target.lab_id, role="admin"))
            if not recipients and target.role != "superadmin":
                recipients = [target]
            for recipient in recipients:
                Notification.objects.create(
                    lab=target.lab,
                    recipient=recipient,
                    type="system",
                    title="Superadmin sa prihlásil za používateľa vo vašom laboratóriu",
                    message=(
                        f"Superadministrátor {request.user.username} sa prihlásil ako "
                        f"{target.username}. Dôvod: {reason}"
                    ),
                )

        return Response(
            {
                "user": UserSerializer(target).data,
                "access_token": str(access),
                "refresh_token": str(refresh),
            }
        )
