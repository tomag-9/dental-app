from rest_framework import permissions
from rest_framework.exceptions import APIException, PermissionDenied, ValidationError

# ---------------------------------------------------------------------------
# Permission registry — the single source of truth for the action vocabulary.
#
# Every entry maps a canonical action name to the tuple of roles that are
# allowed to perform it *by default*. Per-lab overrides (``LabRolePermission``)
# are layered on top of these defaults by :func:`has_lab_permission`.
#
# Actions whose default role tuple is exactly ``("superadmin",)`` are
# platform-scoped: they can never be granted (nor revoked) by a lab-level
# override, because doing so would let a lab administrator promote a member of
# their own lab into a platform administrator.
# ---------------------------------------------------------------------------

ROLE_SUPERADMIN = "superadmin"
ROLE_ADMIN = "admin"
ROLE_USER = "user"
ROLE_TECHNICIAN = "technician"

_ALL_ROLES = (ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_USER, ROLE_TECHNICIAN)
_ADMINS = (ROLE_SUPERADMIN, ROLE_ADMIN)
_PLATFORM_ONLY = (ROLE_SUPERADMIN,)

LAB_PERMISSION_ACTIONS = {
    # Lab settings
    "lab:read": _ALL_ROLES,
    "lab:write": _ADMINS,
    "lab:delete": _PLATFORM_ONLY,
    # Users / team
    "user:read": _ADMINS,
    "user:write": _ADMINS,
    "user:delete": _PLATFORM_ONLY,
    "user:impersonate": _PLATFORM_ONLY,
    # CRM
    "patient:read": _ALL_ROLES,
    "patient:write": _ADMINS,
    "patient:delete": _ADMINS,
    "clinic:read": (ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_USER),
    "clinic:write": _ADMINS,
    "clinic:delete": _ADMINS,
    "doctor:read": (ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_USER),
    "doctor:write": _ADMINS,
    "doctor:delete": _ADMINS,
    # Jobs
    "job:read": _ALL_ROLES,
    "job:write": _ALL_ROLES,
    "job:delete": _ADMINS,
    # Finance
    "invoice:read": (ROLE_SUPERADMIN, ROLE_ADMIN, ROLE_USER),
    "invoice:write": _ADMINS,
    "invoice:delete": _ADMINS,
    # Inventory
    "inventory:read": _ALL_ROLES,
    "inventory:write": _ADMINS,
    "inventory:delete": _ADMINS,
    # Security / audit
    "audit_log:read": _ADMINS,
    "session:read": _ALL_ROLES,
    "session:revoke": _ALL_ROLES,
    "api_key:read": _ADMINS,
    "api_key:write": _ADMINS,
    "api_key:delete": _ADMINS,
    "2fa:manage": _ALL_ROLES,
    "system_health:read": _PLATFORM_ONLY,
    "superadmin_metrics:read": _PLATFORM_ONLY,
    # Coarse-grained UI capabilities (consumed by GET /api/permissions/)
    "create_job": _ADMINS,
    "create_patient": _ADMINS,
    "create_invoice": _ADMINS,
    "manage_inventory": _ADMINS,
    "manage_team": _ADMINS,
    "manage_platform": _PLATFORM_ONLY,
}

#: Actions surfaced in the ``actions`` map of ``GET /api/permissions/``.
UI_PERMISSION_ACTIONS = (
    "create_job",
    "create_patient",
    "create_invoice",
    "manage_inventory",
    "manage_team",
    "manage_platform",
)

ROLE_DESCRIPTIONS = {
    ROLE_SUPERADMIN: "Full platform access across all labs",
    ROLE_ADMIN: "Full access within own lab",
    ROLE_USER: "Standard lab user — can read most resources, limited write",
    ROLE_TECHNICIAN: "Technician — focused on job execution, no invoicing or admin",
}

_OVERRIDE_CACHE_ATTR = "_lab_permission_overrides_cache"


def is_platform_action(action):
    """Platform-scoped actions can never be altered by a per-lab override."""
    return LAB_PERMISSION_ACTIONS.get(action) == _PLATFORM_ONLY


def default_actions_for_role(role):
    """Actions allowed for ``role`` before any per-lab override is applied."""
    return sorted(action for action, roles in LAB_PERMISSION_ACTIONS.items() if role in roles)


def role_permission_matrix():
    """The role -> allowed actions matrix built from the shared registry."""
    return {
        role: {
            "description": ROLE_DESCRIPTIONS[role],
            "actions": default_actions_for_role(role),
        }
        for role in _ALL_ROLES
    }


def effective_role(user):
    if is_superadmin(user):
        return ROLE_SUPERADMIN
    return getattr(user, "role", ROLE_USER) or ROLE_USER


def lab_permission_overrides(user):
    """Return ``{(role, action): allowed}`` for the user's lab.

    The result is cached on the user instance together with the lab id it was
    loaded for, so a single request never issues more than one query and a
    cached map can never be reused for a different lab.
    """
    lab_id = getattr(user, "lab_id", None)
    if not lab_id:
        return {}
    cached = getattr(user, _OVERRIDE_CACHE_ATTR, None)
    if cached is not None and cached[0] == lab_id:
        return cached[1]

    from apps.core.models import LabRolePermission

    overrides = {
        (row.role, row.action): row.allowed
        for row in LabRolePermission.objects.filter(lab_id=lab_id).only("role", "action", "allowed")
    }
    try:
        setattr(user, _OVERRIDE_CACHE_ATTR, (lab_id, overrides))
    except AttributeError:  # pragma: no cover - defensive, e.g. slotted users
        pass
    return overrides


def invalidate_lab_permission_cache(user):
    if hasattr(user, _OVERRIDE_CACHE_ATTR):
        try:
            delattr(user, _OVERRIDE_CACHE_ATTR)
        except AttributeError:  # pragma: no cover
            pass


def has_lab_permission(user, action):
    """Single source of truth for "may this user perform ``action``?".

    Resolution order:

    1. Superadmins (platform staff) always pass.
    2. Platform-scoped actions are decided by the role alone — a lab override
       must never be able to hand out platform access.
    3. Otherwise the per-lab ``LabRolePermission`` override for the user's role
       wins over the role default; it may both revoke and grant, but only
       within the user's own lab.
    """
    if user is None:
        return False
    if not getattr(user, "is_authenticated", False):
        return False
    if is_superadmin(user):
        return True

    role = effective_role(user)
    default_roles = LAB_PERMISSION_ACTIONS.get(action)
    allowed_by_role = bool(default_roles) and role in default_roles

    if default_roles is not None and is_platform_action(action):
        return allowed_by_role

    override = lab_permission_overrides(user).get((role, action))
    if override is not None:
        return bool(override)
    return allowed_by_role


def assert_lab_permission(user, action, message):
    if not has_lab_permission(user, action):
        raise PermissionDenied(message)


class LabActionPermissionMixin:
    """Check lab-scoped actions before the view body runs.

    DRF evaluates permissions in ``initial()``, i.e. *before* serializer
    validation. Guarding only in ``perform_create``/``perform_update`` means an
    invalid payload from a forbidden user answers 400 ("your data is wrong")
    instead of 403 ("you may not do this") — which both leaks whether the
    payload was well-formed and confuses the caller.

    Views map their DRF action name to a permission action::

        lab_permission_actions = {
            "create": "patient:write",
            "destroy": "patient:write",
        }

    ``self.action`` is set by ``ViewSetMixin.initialize_request`` before
    ``initial()`` runs, so it is available here.
    """

    lab_permission_actions: dict = {}
    lab_permission_message = "Na túto akciu nemáte oprávnenie."

    def check_permissions(self, request):
        super().check_permissions(request)
        required = self.lab_permission_actions.get(getattr(self, "action", None))
        if required:
            assert_lab_permission(request.user, required, self.lab_permission_message)


def is_superadmin(user):
    return bool(getattr(user, "is_superuser", False) or getattr(user, "role", None) == "superadmin")


def is_lab_admin(user):
    return bool(getattr(user, "role", None) == "admin")


def is_admin_or_superadmin(user):
    return is_superadmin(user) or is_lab_admin(user)


def tenant_scoped_queryset(queryset, user, lab_filter_field="lab"):
    if is_superadmin(user):
        return queryset
    lab_id = getattr(user, "lab_id", None)
    if lab_id:
        return queryset.filter(**{f"{lab_filter_field}_id": lab_id})
    return queryset.none()


class TenantScopedQuerysetMixin:
    lab_filter_field = "lab"

    def get_tenant_scoped_queryset(self, queryset=None):
        qs = queryset if queryset is not None else super().get_queryset()
        return tenant_scoped_queryset(qs, self.request.user, self.lab_filter_field)

    def save_with_request_lab(self, serializer):
        user = self.request.user
        if is_superadmin(user):
            lab = serializer.validated_data.get(self.lab_filter_field)
            if lab is None:
                lab = self._get_lab_from_request_data()
            serializer.save(**{self.lab_filter_field: lab})
            return

        lab = getattr(user, "lab", None)
        if not lab:
            raise ValidationError("User is not assigned to any lab")
        serializer.save(**{self.lab_filter_field: lab})

    def _get_lab_from_request_data(self):
        from apps.core.models import Lab

        lab_id = self.request.data.get(
            self.lab_filter_field,
            self.request.data.get(f"{self.lab_filter_field}_id"),
        )
        if not lab_id:
            raise ValidationError({self.lab_filter_field: "Lab must be provided"})
        try:
            return Lab.objects.get(pk=lab_id)
        except (TypeError, ValueError, Lab.DoesNotExist):
            raise ValidationError({self.lab_filter_field: "Invalid lab"})


def assert_lab_write_allowed(user):
    assert_lab_permission(
        user,
        "lab:write",
        "Nastavenia laboratória môže upravovať iba administrátor alebo superadministrátor",
    )


def _view_write_allowed(request, view):
    """Role check for a write, honouring the view's declared lab action.

    A view may set ``lab_permission_action`` to opt into per-lab overrides.
    Views that do not declare one keep the plain role check, so wiring an
    action in is an explicit, reviewable decision per endpoint.
    """
    action = getattr(view, "lab_permission_action", None)
    if action:
        return has_lab_permission(request.user, action)
    return is_admin_or_superadmin(request.user)


class IsAdminOrSuperadminPermission(permissions.BasePermission):
    """Allow only tenant admins and platform superadmins."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return _view_write_allowed(request, view)


class IsReadOnlyOrAdminOrSuperadminPermission(permissions.BasePermission):
    """Allow authenticated reads, but restrict writes to admins."""

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        if request.method in permissions.SAFE_METHODS:
            return True
        return _view_write_allowed(request, view)


# ---------------------------------------------------------------------------
# Subscription read-only lock (issue #104)
#
# When a lab's subscription lapses the tenant is *not* cut off from its data:
# it keeps reading and exporting patient records and MDR traceability, which
# it is legally obliged to retain for a decade and entitled to take with it
# under GDPR art. 20. Only writes are refused, with 402 Payment Required and a
# link to the billing page — a bare 403 would say "you may not", when the real
# answer is "pay and you may".
# ---------------------------------------------------------------------------

#: Subscription statuses in which writes are refused.
READ_ONLY_SUBSCRIPTION_STATUSES = frozenset({"read_only", "cancelled"})

#: URL names (``request.resolver_match.url_name``) that stay writable while a
#: lab is locked. Keep every exemption here — scattering them across viewsets
#: is how a lab ends up unable to pay its way out of the lock.
SUBSCRIPTION_LOCK_EXEMPT_URL_NAMES = frozenset(
    {
        # Authentication — a locked-out user must still be able to log out.
        "session-login",
        "logout",
        "token_obtain_pair",
        "token_refresh",
        "csrf",
        "2fa",
        # Billing itself.
        "stripe-webhook",
    }
)

#: Path fragments that mark a request as billing-related or as an export.
#: Exports are reads even when they are POSTs (a report body is a filter, not
#: a mutation), so they stay available to a read-only lab.
SUBSCRIPTION_LOCK_EXEMPT_PATH_FRAGMENTS = (
    # Billing — checkout, portal, `my`, Stripe callbacks.
    "/finance/subscriptions/",
    "/finance/stripe/",
    # Account security and session handling. These are not business writes, and
    # locking a user out of logging out, rotating a password or revoking a
    # stolen session would trade a billing problem for a security one.
    "/auth/",
    "/2fa/",
    "/sessions/",
    "/csrf/",
    "me/password",
    # Exports and printable documents. Some are POSTs whose body is a filter,
    # not a mutation — they are reads, and a lapsed lab keeps its right to take
    # its data with it.
    "/export",
    "/pdf",
    "-pdf",
    "/qr",
    "/download",
)


def _is_subscription_lock_exempt(request):
    """Single decision point for "this write survives the read-only lock"."""
    match = getattr(request, "resolver_match", None)
    url_name = getattr(match, "url_name", None)
    if url_name and url_name in SUBSCRIPTION_LOCK_EXEMPT_URL_NAMES:
        return True
    path = (request.path or "").lower()
    return any(fragment in path for fragment in SUBSCRIPTION_LOCK_EXEMPT_PATH_FRAGMENTS)


def subscription_lock_state(user):
    """Return ``(locked, subscription)`` for the user's lab.

    A lab with no ``Subscription`` row at all is *not* locked: absence of a
    billing record means billing was never set up for that tenant, which is
    not the same as a lapsed one.
    """
    lab_id = getattr(user, "lab_id", None)
    if not lab_id:
        return False, None

    from apps.finance.models import Subscription

    subscription = Subscription.objects.filter(lab_id=lab_id).only("id", "status", "plan").first()
    if subscription is None:
        return False, None
    return subscription.status in READ_ONLY_SUBSCRIPTION_STATUSES, subscription


class PaymentRequired(APIException):
    """402 — the tenant may read, but must settle billing before writing."""

    status_code = 402
    default_detail = "Predplatné laboratória nie je aktívne. Dáta zostávajú čitateľné a exportovateľné, zápisy sú pozastavené."
    default_code = "subscription_read_only"


class SubscriptionWriteAllowed(permissions.BasePermission):
    """Block writes when the lab's subscription has lapsed.

    Wired into ``DEFAULT_PERMISSION_CLASSES`` and into the explicit
    ``permission_classes`` of the views that override the defaults. Raising
    (rather than returning ``False``) is deliberate: DRF turns a ``False`` into
    a generic 403, and the caller needs the 402 plus the payment link.
    """

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            # Authentication is another permission's job; don't mask a 401.
            return True
        if is_superadmin(user):
            return True
        if _is_subscription_lock_exempt(request):
            return True

        locked, subscription = subscription_lock_state(user)
        if not locked:
            return True

        from django.conf import settings

        raise PaymentRequired(
            {
                "detail": PaymentRequired.default_detail,
                "code": PaymentRequired.default_code,
                "subscription_status": subscription.status,
                "billing_url": getattr(settings, "SUBSCRIPTION_BILLING_URL", ""),
            }
        )


#: Drop-in replacement for ``[permissions.IsAuthenticated]`` that also honours
#: the subscription read-only lock. Views overriding ``permission_classes`` use
#: this so they don't silently opt out of DEFAULT_PERMISSION_CLASSES.
AUTHENTICATED = [permissions.IsAuthenticated, SubscriptionWriteAllowed]
