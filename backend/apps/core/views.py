from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.finance.models import Subscription

from .models import Lab, User
from .serializers import (
    LabSerializer,
    MeUpdateSerializer,
    SignupRequestSerializer,
    SignupResponseSerializer,
    UserSerializer,
)


def _is_superadmin(user):
    return bool(
        getattr(user, "is_superuser", False)
        or getattr(user, "role", None) == "superadmin"
    )


def _is_admin_or_superadmin(user):
    return _is_superadmin(user) or getattr(user, "role", None) == "admin"


def _build_unique_username(base_value):
    base = (base_value or "user").strip().replace(" ", "_").lower()[:120] or "user"
    candidate = base
    idx = 1
    while User.objects.filter(username=candidate).exists():
        idx += 1
        candidate = f"{base}_{idx}"
    return candidate


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.crm.models import Patient
        from apps.finance.models import Invoice
        from apps.jobs.models import Job

        user = request.user
        lab_id = getattr(user, "lab_id", None)

        if _is_superadmin(user):
            patients_qs = Patient.objects.all()
            jobs_qs = Job.objects.select_related("patient").order_by("-created_at")
            invoices_qs = Invoice.objects.select_related("clinic").order_by("-created_at")
        elif lab_id:
            patients_qs = Patient.objects.filter(lab_id=lab_id)
            jobs_qs = (
                Job.objects.filter(lab_id=lab_id)
                .select_related("patient")
                .order_by("-created_at")
            )
            invoices_qs = (
                Invoice.objects.filter(lab_id=lab_id)
                .select_related("clinic")
                .order_by("-created_at")
            )
        else:
            return Response(
                {"detail": "No lab associated"}, status=status.HTTP_403_FORBIDDEN
            )

        active_statuses = ("new", "in_progress")
        done_statuses = (
            "completed",
            "finished_factured",
            "finished_unfactured",
            "closed",
        )

        total_patients = patients_qs.count()
        active_jobs = jobs_qs.filter(status__in=active_statuses).count()
        completed_jobs = jobs_qs.filter(status__in=done_statuses).count()
        total_revenue = (
            invoices_qs.filter(status="paid").aggregate(total=Sum("total_amount"))[
                "total"
            ]
            or Decimal("0.00")
        )

        recent_jobs_data = []
        for job in jobs_qs[:5]:
            patient = job.patient
            recent_jobs_data.append(
                {
                    "id": job.id,
                    "status": job.status,
                    "due_date": job.due_date,
                    "description": job.description,
                    "patient_details": (
                        {
                            "first_name": patient.first_name if patient else "",
                            "last_name": patient.last_name if patient else "",
                        }
                        if patient
                        else None
                    ),
                }
            )

        recent_invoices_data = []
        for inv in invoices_qs[:5]:
            recent_invoices_data.append(
                {
                    "id": inv.id,
                    "number": inv.number,
                    "status": inv.status,
                    "total_amount": str(inv.total_amount),
                    "clinic_name": inv.clinic.name if inv.clinic else None,
                    "created_at": (
                        inv.created_at.isoformat() if inv.created_at else None
                    ),
                    "issued_at": inv.issued_at.isoformat() if inv.issued_at else None,
                }
            )

        return Response(
            {
                "total_patients": total_patients,
                "active_jobs": active_jobs,
                "completed_jobs": completed_jobs,
                "total_revenue": str(total_revenue),
                "recent_jobs": recent_jobs_data,
                "recent_invoices": recent_invoices_data,
            }
        )


class LabViewSet(viewsets.ModelViewSet):
    queryset = Lab.objects.all()
    serializer_class = LabSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if _is_superadmin(user):
            return Lab.objects.all()
        if getattr(user, "lab", None):
            return Lab.objects.filter(id=user.lab_id)
        return Lab.objects.none()

    @action(detail=False, methods=["get"], url_path="superadmin/all")
    def superadmin_all(self, request):
        if not _is_superadmin(request.user):
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


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _assert_can_manage_users(self, requester):
        if not _is_admin_or_superadmin(requester):
            raise PermissionDenied("Only admin or superadmin can manage users")

    def _assert_in_scope_or_superadmin(self, requester, target):
        if _is_superadmin(requester):
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

    def get_queryset(self):
        user = self.request.user
        if _is_superadmin(user):
            return User.objects.all()
        if _is_admin_or_superadmin(user) and getattr(user, "lab", None):
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
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._assert_can_manage_users(request.user)
        self._precheck_target_scope(request.user)
        target = self.get_object()
        self._assert_in_scope_or_superadmin(request.user, target)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._assert_can_manage_users(request.user)
        self._precheck_target_scope(request.user)
        target = self.get_object()
        self._assert_in_scope_or_superadmin(request.user, target)
        return super().destroy(request, *args, **kwargs)

    def perform_create(self, serializer):
        requester = self.request.user
        self._assert_can_manage_users(requester)
        # Keep non-superadmins within their own lab and prevent role escalation.
        if not _is_superadmin(requester):
            role = serializer.validated_data.get("role")
            if role == "superadmin":
                raise PermissionDenied("Only superadmin can assign superadmin role")
            serializer.save(lab=requester.lab)
            return
        serializer.save()

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

            username_base = (
                data.get("nickname") or (data.get("email") or "admin").split("@")[0]
            )
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
                status="active",
                seats=5,
                current_period_start=timezone.now().date(),
                current_period_end=(timezone.now() + timedelta(days=30)).date(),
            )

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
            if (
                nickname
                and User.objects.filter(nickname=nickname).exclude(id=user.id).exists()
            ):
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

        target_role = data.get("role")
        if target_role and target_role != user.role:
            if target_role == "superadmin" and not _is_superadmin(user):
                raise PermissionDenied("Only superadmin can assign superadmin role")
            if target_role == "admin" and user.role not in ("admin", "superadmin"):
                raise PermissionDenied("Only admin/superadmin can assign admin role")
            user.role = target_role

        if data.get("password"):
            user.set_password(data["password"])

        user.save()
        return Response(UserSerializer(user).data)

    @action(detail=False, methods=["get"], url_path="superadmin/all")
    def superadmin_all(self, request):
        if not _is_superadmin(request.user):
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

    @action(
        detail=False,
        methods=["put"],
        url_path=r"superadmin/(?P<target_user_id>[^/.]+)/toggle-active",
    )
    def toggle_active(self, request, target_user_id=None):
        if not _is_superadmin(request.user):
            raise PermissionDenied("Superadmin only endpoint")

        try:
            target = User.objects.get(id=target_user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        target.is_active = not target.is_active
        target.save(update_fields=["is_active"])
        return Response({"id": target.id, "is_active": target.is_active})
