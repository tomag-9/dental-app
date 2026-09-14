from django.db.models import Count
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from ..access import AUTHENTICATED, assert_lab_write_allowed, is_superadmin
from ..models import Lab
from ..serializers import LabSerializer
from ._shared import _write_audit_log


class LabViewSet(viewsets.ModelViewSet):
    queryset = Lab.objects.all()
    serializer_class = LabSerializer
    permission_classes = AUTHENTICATED

    def get_queryset(self):
        user = self.request.user
        if is_superadmin(user):
            return Lab.objects.all()
        if getattr(user, "lab", None):
            return Lab.objects.filter(id=user.lab_id)
        return Lab.objects.none()

    def create(self, request, *args, **kwargs):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only superadmin can create labs")
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        assert_lab_write_allowed(request.user)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        assert_lab_write_allowed(request.user)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        if not is_superadmin(request.user):
            raise PermissionDenied("Only superadmin can delete labs")
        instance = self.get_object()
        confirm_name = (request.data.get("confirm_name") or "").strip()
        if confirm_name != instance.name:
            raise ValidationError({"confirm_name": "Na potvrdenie zmazania zadajte presný názov laboratória."})
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        lab = serializer.save()
        _write_audit_log(
            self.request,
            action="lab.created",
            entity_type="lab",
            entity_id=lab.id,
            lab=lab,
            description=f"Lab {lab.name} created",
        )

    def perform_update(self, serializer):
        lab = serializer.save()
        _write_audit_log(
            self.request,
            action="lab.updated",
            entity_type="lab",
            entity_id=lab.id,
            lab=lab,
            description=f"Lab {lab.name} updated",
            metadata={"fields": sorted(self.request.data.keys())},
        )

    def perform_destroy(self, instance):
        _write_audit_log(
            self.request,
            action="lab.deleted",
            entity_type="lab",
            entity_id=instance.id,
            lab=instance,
            description=f"Lab {instance.name} deleted",
        )
        instance.delete()

    @action(detail=False, methods=["get"], url_path="superadmin/all")
    def superadmin_all(self, request):
        if not is_superadmin(request.user):
            raise PermissionDenied("Superadmin only endpoint")

        labs = Lab.objects.annotate(user_count=Count("users")).all()
        result = []
        for lab in labs:
            sub = getattr(lab, "subscription", None)
            result.append(
                {
                    "id": lab.id,
                    "name": lab.name,
                    "email": lab.email,
                    "city": lab.city,
                    "created_at": lab.created_at,
                    "user_count": lab.user_count,
                    "subscription_plan": sub.plan if sub else "none",
                    "subscription_status": sub.status if sub else "inactive",
                    "subscription_seats": sub.seats if sub else 0,
                }
            )
        return Response(result)

    @action(detail=True, methods=["post"], url_path="suspend")
    def suspend(self, request, pk=None):
        if not is_superadmin(request.user):
            raise PermissionDenied("Iba superadministrátor môže pozastaviť laboratórium")
        lab = self.get_object()
        if lab.is_active:
            lab.is_active = False
            lab.save(update_fields=["is_active"])
        _write_audit_log(
            request,
            action="lab.suspended",
            entity_type="lab",
            entity_id=lab.id,
            lab=lab,
            description=f"Lab {lab.name} suspended",
            metadata={"reason": request.data.get("reason", "")},
        )
        return Response(self.get_serializer(lab).data)

    @action(detail=True, methods=["post"], url_path="activate")
    def activate(self, request, pk=None):
        if not is_superadmin(request.user):
            raise PermissionDenied("Iba superadministrátor môže obnoviť laboratórium")
        lab = self.get_object()
        if not lab.is_active:
            lab.is_active = True
            lab.save(update_fields=["is_active"])
        _write_audit_log(
            request,
            action="lab.activated",
            entity_type="lab",
            entity_id=lab.id,
            lab=lab,
            description=f"Lab {lab.name} activated",
        )
        return Response(self.get_serializer(lab).data)
