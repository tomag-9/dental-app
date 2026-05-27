from rest_framework import permissions
from rest_framework.exceptions import PermissionDenied, ValidationError


def is_superadmin(user):
    return bool(
        getattr(user, "is_superuser", False)
        or getattr(user, "role", None) == "superadmin"
    )


def is_lab_admin(user):
    return bool(getattr(user, "role", None) == "admin")


def is_admin_or_superadmin(user):
    return is_superadmin(user) or is_lab_admin(user)


class TenantScopedQuerysetMixin:
    lab_filter_field = "lab"

    def get_tenant_scoped_queryset(self, queryset=None):
        qs = queryset if queryset is not None else super().get_queryset()
        user = self.request.user
        if is_superadmin(user):
            return qs
        lab_id = getattr(user, "lab_id", None)
        if lab_id:
            return qs.filter(**{f"{self.lab_filter_field}_id": lab_id})
        return qs.none()

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
    if not is_admin_or_superadmin(user):
        raise PermissionDenied("Only admin or superadmin can update lab settings")


class IsAdminOrSuperadminPermission(permissions.BasePermission):
    """Allow only tenant admins and platform superadmins."""

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and is_admin_or_superadmin(request.user)
        )
