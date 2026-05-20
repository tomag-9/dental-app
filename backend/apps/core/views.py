from datetime import timedelta
from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.finance.models import Subscription

from .access import assert_lab_write_allowed, is_admin_or_superadmin, is_superadmin
from .models import Lab, User
from .serializers import (
    LabSerializer,
    MeUpdateSerializer,
    SignupRequestSerializer,
    SignupResponseSerializer,
    UserSerializer,
)


def _build_unique_username(base_value):
    base = (base_value or "user").strip().replace(" ", "_").lower()[:120] or "user"
    candidate = base
    idx = 1
    while User.objects.filter(username=candidate).exists():
        idx += 1
        candidate = f"{base}_{idx}"
    return candidate


def _matches_query(*values, query):
    if not query:
        return True
    haystack = " ".join(str(value or "") for value in values).lower()
    return query.lower() in haystack


def _static_search_results(query, user):
    pages = [
        ("page:dashboard", "page", "Prejsť na Nástenku", "Dashboard", "/dashboard"),
        ("page:jobs", "page", "Prejsť na Práce", "Zákazky a termíny", "/jobs"),
        ("page:patients", "page", "Prejsť na Pacientov", "CRM", "/patients"),
        ("page:invoices", "page", "Prejsť na Faktúry", "Finance", "/invoices"),
        (
            "page:inventory",
            "page",
            "Prejsť na Sklad",
            "Inventár materiálu",
            "/inventory",
        ),
        ("page:settings", "page", "Prejsť na Nastavenia", "Profil a tím", "/settings"),
    ]
    actions = [
        ("action:new-job", "action", "Vytvoriť novú prácu", "Quick add", "/jobs/new"),
        ("action:new-patient", "action", "Pridať pacienta", "CRM", "/patients"),
        ("action:new-invoice", "action", "Vytvoriť faktúru", "Finance", "/invoices"),
    ]
    if is_superadmin(user):
        pages.append(
            (
                "page:superadmin",
                "page",
                "Prejsť na Superadmin",
                "Platforma",
                "/superadmin",
            )
        )

    return [
        {
            "id": item_id,
            "type": item_type,
            "label": label,
            "subtitle": subtitle,
            "url": url,
        }
        for item_id, item_type, label, subtitle, url in pages + actions
        if _matches_query(label, subtitle, url, query=query)
    ]


class GlobalSearchView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.crm.models import Patient
        from apps.finance.models import Invoice
        from apps.jobs.models import Job

        user = request.user
        lab_id = getattr(user, "lab_id", None)
        query = request.query_params.get("q", "").strip()
        try:
            limit = min(int(request.query_params.get("limit", 5)), 20)
        except (TypeError, ValueError):
            limit = 5
        limit = max(limit, 1)

        if is_superadmin(user):
            patients_qs = Patient.objects.all()
            jobs_qs = Job.objects.select_related("patient", "clinic").all()
            invoices_qs = Invoice.objects.select_related("clinic").all()
        elif lab_id:
            patients_qs = Patient.objects.filter(lab_id=lab_id)
            jobs_qs = Job.objects.select_related("patient", "clinic").filter(
                lab_id=lab_id
            )
            invoices_qs = Invoice.objects.select_related("clinic").filter(lab_id=lab_id)
        else:
            return Response(
                {"detail": "No lab associated"}, status=status.HTTP_403_FORBIDDEN
            )

        results = _static_search_results(query, user)

        if query:
            patient_filter = (
                Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(birth_number__icontains=query)
                | Q(email__icontains=query)
            )
            for patient in patients_qs.filter(patient_filter).order_by(
                "last_name", "first_name"
            )[:limit]:
                name = f"{patient.first_name} {patient.last_name}".strip()
                results.append(
                    {
                        "id": f"patient:{patient.id}",
                        "type": "patient",
                        "label": name,
                        "subtitle": patient.birth_number,
                        "url": f"/patients/{patient.id}",
                        "object_id": patient.id,
                    }
                )

            job_filter = (
                Q(description__icontains=query)
                | Q(status__icontains=query)
                | Q(patient__first_name__icontains=query)
                | Q(patient__last_name__icontains=query)
                | Q(clinic__name__icontains=query)
            )
            if query.isdigit():
                job_filter |= Q(id=int(query))
            for job in jobs_qs.filter(job_filter).order_by("-created_at")[:limit]:
                patient_name = (
                    f"{job.patient.first_name} {job.patient.last_name}".strip()
                    if job.patient_id
                    else "Neznámy pacient"
                )
                results.append(
                    {
                        "id": f"job:{job.id}",
                        "type": "job",
                        "label": f"#{job.id} - {patient_name}",
                        "subtitle": job.description or job.status,
                        "url": f"/jobs/{job.id}",
                        "object_id": job.id,
                    }
                )

            invoice_filter = (
                Q(number__icontains=query)
                | Q(status__icontains=query)
                | Q(clinic__name__icontains=query)
            )
            for invoice in invoices_qs.filter(invoice_filter).order_by("-created_at")[
                :limit
            ]:
                clinic_name = invoice.clinic.name if invoice.clinic_id else ""
                results.append(
                    {
                        "id": f"invoice:{invoice.id}",
                        "type": "invoice",
                        "label": invoice.number,
                        "subtitle": f"{clinic_name} - {invoice.total_amount:.2f} EUR",
                        "url": f"/invoices/{invoice.id}",
                        "object_id": invoice.id,
                    }
                )

        return Response({"query": query, "results": results})


class DashboardStatsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.crm.models import Patient
        from apps.finance.models import Invoice
        from apps.jobs.models import Job

        user = request.user
        lab_id = getattr(user, "lab_id", None)

        if is_superadmin(user):
            patients_qs = Patient.objects.all()
            jobs_qs = Job.objects.select_related("patient").order_by("-created_at")
            invoices_qs = Invoice.objects.select_related("clinic").order_by(
                "-created_at"
            )
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
        total_revenue = invoices_qs.filter(status="paid").aggregate(
            total=Sum("total_amount")
        )["total"] or Decimal("0.00")
        today = timezone.localdate()

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

        today_schedule_data = []
        for job in jobs_qs.filter(due_date=today).exclude(
            status__in=("completed", "cancelled", "finished_factured", "closed")
        )[:6]:
            patient = job.patient
            patient_name = (
                f"{patient.first_name} {patient.last_name}".strip()
                if patient
                else "Neznámy pacient"
            )
            today_schedule_data.append(
                {
                    "id": job.id,
                    "type": "job",
                    "time": "Dnes",
                    "title": f"Termín odovzdania #{job.id} - {patient_name}",
                    "status": job.status,
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
                "today_schedule": today_schedule_data,
            }
        )


class LabViewSet(viewsets.ModelViewSet):
    queryset = Lab.objects.all()
    serializer_class = LabSerializer
    permission_classes = [permissions.IsAuthenticated]

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
        return super().destroy(request, *args, **kwargs)

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


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _assert_can_manage_users(self, requester):
        if not is_admin_or_superadmin(requester):
            raise PermissionDenied("Only admin or superadmin can manage users")

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
        if not is_superadmin(requester):
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
            if target_role == "superadmin" and not is_superadmin(user):
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
            return Response(
                {"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        target.is_active = not target.is_active
        target.save(update_fields=["is_active"])
        return Response({"id": target.id, "is_active": target.is_active})
