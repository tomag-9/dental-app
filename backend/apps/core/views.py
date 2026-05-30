from datetime import timedelta
from decimal import Decimal
import secrets

from django.db import connection, transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.finance.models import Subscription
from apps.jobs.models import CalendarEvent, Vacation

from .access import assert_lab_write_allowed, is_admin_or_superadmin, is_superadmin
from . import user_service
from .auth import MolarisTokenObtainPairSerializer
from .models import (
    AuditLog,
    Lab,
    LabApiKey,
    LabRolePermission,
    Notification,
    TeamInvitation,
    User,
    UserSession,
)
from .serializers import (
    AuditLogSerializer,
    LabSerializer,
    MeUpdateSerializer,
    NotificationSerializer,
    PasswordChangeSerializer,
    SignupRequestSerializer,
    SignupResponseSerializer,
    TeamInvitationAcceptSerializer,
    TeamInvitationSerializer,
    UserSerializer,
)


def _client_ip(request):
    forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if forwarded_for:
        return forwarded_for.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR")


def _write_audit_log(
    request,
    *,
    action,
    entity_type="",
    entity_id="",
    lab=None,
    description="",
    metadata=None,
):
    return AuditLog.objects.create(
        actor=request.user if getattr(request, "user", None).is_authenticated else None,
        lab=lab,
        action=action,
        entity_type=entity_type,
        entity_id=str(entity_id) if entity_id else "",
        description=description,
        metadata=metadata or {},
        ip_address=_client_ip(request),
    )


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


def _role_permission_payload(user):
    role = getattr(user, "role", "user") or "user"
    superadmin = is_superadmin(user)
    admin = is_admin_or_superadmin(user)

    navigation = [
        ("dashboard", "Nástenka", "/dashboard", "dashboard", True),
        ("jobs", "Práce", "/jobs", "briefcase", True),
        ("calendar", "Kalendár", "/calendar", "calendar", True),
        ("patients", "Pacienti", "/patients", "user", role != "technician"),
        ("crm", "CRM", "/clinics", "building", role != "technician"),
        ("finance", "Finance", "/finance", "euro", admin),
        ("inventory", "Sklad", "/inventory", "package", admin),
        ("settings", "Nastavenia", "/settings", "settings", admin),
        ("superadmin", "Superadmin", "/superadmin", "shield", superadmin),
    ]
    actions = {
        "create_job": True,
        "create_patient": role != "technician",
        "create_invoice": admin,
        "manage_inventory": admin,
        "manage_team": admin,
        "manage_platform": superadmin,
    }

    return {
        "role": role,
        "is_superadmin": superadmin,
        "navigation": [
            {
                "id": item_id,
                "label": label,
                "path": path,
                "icon": icon,
                "allowed": allowed,
            }
            for item_id, label, path, icon, allowed in navigation
        ],
        "actions": actions,
    }


class PermissionsView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(_role_permission_payload(request.user))


class SystemHealthView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not is_superadmin(request.user):
            raise PermissionDenied("Superadmin only endpoint")

        checks = []
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
            database_status = "ok"
        except Exception as exc:
            database_status = "error"
            checks.append(
                {
                    "service": "database",
                    "status": "error",
                    "detail": str(exc),
                }
            )
        else:
            checks.append(
                {
                    "service": "database",
                    "status": "ok",
                    "detail": "PostgreSQL connection is available",
                }
            )

        # Migration check
        from django.db.migrations.executor import MigrationExecutor

        try:
            executor = MigrationExecutor(connection)
            plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
            pending_migrations = len(plan)
            migration_status = "ok" if pending_migrations == 0 else "warning"
            checks.append(
                {
                    "service": "migrations",
                    "status": migration_status,
                    "detail": (
                        "All migrations applied"
                        if pending_migrations == 0
                        else f"{pending_migrations} pending migration(s)"
                    ),
                }
            )
        except Exception as exc:
            migration_status = "error"
            checks.append(
                {"service": "migrations", "status": "error", "detail": str(exc)}
            )

        # Memory check (psutil optional)
        memory_info = None
        try:
            import psutil

            mem = psutil.virtual_memory()
            memory_info = {
                "total_mb": round(mem.total / 1024 / 1024),
                "available_mb": round(mem.available / 1024 / 1024),
                "percent_used": mem.percent,
            }
            checks.append(
                {
                    "service": "memory",
                    "status": "ok" if mem.percent < 90 else "warning",
                    "detail": f"{mem.percent}% used",
                }
            )
        except ImportError:
            pass

        import django
        import sys

        lab_count = Lab.objects.count()
        user_count = User.objects.count()
        pending_invites = TeamInvitation.objects.filter(status="pending").count()
        unread_notifications = Notification.objects.filter(read_at__isnull=True).count()
        overall_status = "ok" if database_status == "ok" else "degraded"

        return Response(
            {
                "status": overall_status,
                "generated_at": timezone.now().isoformat(),
                "checks": checks,
                "metrics": {
                    "labs": lab_count,
                    "users": user_count,
                    "pending_invitations": pending_invites,
                    "unread_notifications": unread_notifications,
                },
                "runtime": {
                    "django_version": django.__version__,
                    "python_version": sys.version.split(" ")[0],
                    "pending_migrations": (
                        pending_migrations if "pending_migrations" in dir() else None
                    ),
                    "memory": memory_info,
                },
            }
        )


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
        period_start = today.replace(day=1)
        if period_start.month == 1:
            previous_period_start = period_start.replace(
                year=period_start.year - 1, month=12
            )
        else:
            previous_period_start = period_start.replace(month=period_start.month - 1)
        previous_period_end = period_start - timedelta(days=1)

        monthly_patients = patients_qs.filter(
            created_at__date__gte=period_start,
            created_at__date__lte=today,
        ).count()
        previous_monthly_patients = patients_qs.filter(
            created_at__date__gte=previous_period_start,
            created_at__date__lte=previous_period_end,
        ).count()
        monthly_jobs = jobs_qs.filter(
            created_at__date__gte=period_start,
            created_at__date__lte=today,
        ).count()
        previous_monthly_jobs = jobs_qs.filter(
            created_at__date__gte=previous_period_start,
            created_at__date__lte=previous_period_end,
        ).count()
        monthly_revenue = invoices_qs.filter(
            status="paid",
            paid_at__date__gte=period_start,
            paid_at__date__lte=today,
        ).aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")
        previous_monthly_revenue = invoices_qs.filter(
            status="paid",
            paid_at__date__gte=previous_period_start,
            paid_at__date__lte=previous_period_end,
        ).aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")

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

        # Add CalendarEvents happening today.
        cal_qs = CalendarEvent.objects.filter(start__date=today)
        if not is_superadmin(user):
            cal_qs = cal_qs.filter(lab_id=getattr(user, "lab_id", None))
        for event in cal_qs.order_by("start")[:6]:
            local_start = timezone.localtime(event.start)
            time_str = local_start.strftime("%H:%M")
            today_schedule_data.append(
                {
                    "id": event.id,
                    "type": event.event_type or "meeting",
                    "time": time_str,
                    "title": event.title,
                    "status": None,
                }
            )
        # Add vacation periods covering today.
        vac_qs = Vacation.objects.filter(start__date__lte=today, end__date__gte=today)
        if not is_superadmin(user):
            vac_qs = vac_qs.filter(lab_id=getattr(user, "lab_id", None))
        for vac in vac_qs[:3]:
            desc = vac.description or "Dovolenka"
            today_schedule_data.append(
                {
                    "id": vac.id,
                    "type": "vacation",
                    "time": "00:00",
                    "title": desc,
                    "status": None,
                }
            )

        today_schedule_data.sort(key=lambda x: x["time"])

        return Response(
            {
                "total_patients": total_patients,
                "active_jobs": active_jobs,
                "completed_jobs": completed_jobs,
                "total_revenue": str(total_revenue),
                "current_period": {
                    "start": period_start.isoformat(),
                    "end": today.isoformat(),
                },
                "monthly_totals": {
                    "new_patients": monthly_patients,
                    "new_jobs": monthly_jobs,
                    "revenue": f"{monthly_revenue:.2f}",
                },
                "deltas": {
                    "new_patients": monthly_patients - previous_monthly_patients,
                    "new_jobs": monthly_jobs - previous_monthly_jobs,
                    "revenue": f"{monthly_revenue - previous_monthly_revenue:.2f}",
                },
                "recent_jobs": recent_jobs_data,
                "recent_invoices": recent_invoices_data,
                "today_schedule": today_schedule_data,
            }
        )


class DashboardChartDataView(APIView):
    """Daily revenue and job counts for the last 30 days, plus status distribution."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.finance.models import Invoice
        from apps.jobs.models import Job

        user = request.user
        lab_id = getattr(user, "lab_id", None)

        if is_superadmin(user):
            invoices_qs = Invoice.objects.all()
            jobs_qs = Job.objects.all()
        elif lab_id:
            invoices_qs = Invoice.objects.filter(lab_id=lab_id)
            jobs_qs = Job.objects.filter(lab_id=lab_id)
        else:
            return Response(
                {"detail": "No lab associated"}, status=status.HTTP_403_FORBIDDEN
            )

        today = timezone.localdate()
        days = int(request.query_params.get("days", 30))
        days = min(max(days, 7), 90)

        daily_revenue = {}
        daily_jobs = {}
        for i in range(days - 1, -1, -1):
            day = today - timedelta(days=i)
            daily_revenue[day.isoformat()] = Decimal("0.00")
            daily_jobs[day.isoformat()] = 0

        start_date = today - timedelta(days=days - 1)
        for inv in invoices_qs.filter(
            status="paid",
            paid_at__date__gte=start_date,
            paid_at__date__lte=today,
        ).only("paid_at", "total_amount"):
            key = inv.paid_at.date().isoformat()
            if key in daily_revenue:
                daily_revenue[key] += Decimal(str(inv.total_amount or 0))

        for job in jobs_qs.filter(
            created_at__date__gte=start_date,
            created_at__date__lte=today,
        ).only("created_at"):
            key = job.created_at.date().isoformat()
            if key in daily_jobs:
                daily_jobs[key] += 1

        status_counts = {}
        for job in jobs_qs.values("status"):
            s = job["status"]
            status_counts[s] = status_counts.get(s, 0) + 1

        return Response(
            {
                "days": days,
                "daily_revenue": [
                    {"date": d, "revenue": f"{v:.2f}"} for d, v in daily_revenue.items()
                ],
                "daily_jobs": [{"date": d, "count": c} for d, c in daily_jobs.items()],
                "status_distribution": [
                    {"status": s, "count": c} for s, c in sorted(status_counts.items())
                ],
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


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.all()
    serializer_class = AuditLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        if not is_superadmin(self.request.user):
            raise PermissionDenied("Superadmin only endpoint")
        return AuditLog.objects.select_related("actor", "lab").all()


class TeamInvitationViewSet(viewsets.ModelViewSet):
    queryset = TeamInvitation.objects.all()
    serializer_class = TeamInvitationSerializer
    permission_classes = [permissions.IsAuthenticated]

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
            raise PermissionDenied("Only admin or superadmin can manage invitations")

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
            return Response(
                {"detail": "Invitation not found"}, status=status.HTTP_404_NOT_FOUND
            )

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
            username = _build_unique_username(
                data.get("username") or invitation.email.split("@")[0]
            )
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
            raise ValidationError(
                {"detail": "Only pending invitations can be cancelled"}
            )
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


class NotificationViewSet(viewsets.ModelViewSet):
    queryset = Notification.objects.all()
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Notification.objects.select_related("lab", "recipient")
        if not is_superadmin(self.request.user):
            qs = qs.filter(recipient=self.request.user)

        # Only apply query-param filters for list/retrieve — not for bulk actions
        # like mark_all_read or unread_count which must see the full recipient scope.
        if getattr(self, "action", None) in ("list", "retrieve"):
            notification_type = self.request.query_params.get("type")
            if notification_type:
                qs = qs.filter(type=notification_type)

            if self.request.query_params.get("unread") in ("1", "true"):
                qs = qs.filter(read_at__isnull=True)

        return qs.order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        if is_superadmin(user):
            recipient = serializer.validated_data.get("recipient") or user
            lab = serializer.validated_data.get("lab") or getattr(
                recipient, "lab", None
            )
            serializer.save(recipient=recipient, lab=lab)
            return

        serializer.save(recipient=user, lab=getattr(user, "lab", None))

    @action(detail=True, methods=["post"], url_path="mark-read")
    def mark_read(self, request, pk=None):
        notification = self.get_object()
        if notification.read_at is None:
            notification.read_at = timezone.now()
            notification.save(update_fields=["read_at"])
        return Response(self.get_serializer(notification).data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        updated = (
            self.get_queryset()
            .filter(read_at__isnull=True)
            .update(read_at=timezone.now())
        )
        return Response({"updated": updated})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        return Response(
            {"unread_count": self.get_queryset().filter(read_at__isnull=True).count()}
        )


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_throttles(self):
        if self.action == "signup":
            self.throttle_scope = "signup"
            return [ScopedRateThrottle()]
        return super().get_throttles()

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
        if (
            target.id == requester.id
            and requested_role
            and requested_role != target.role
        ):
            raise PermissionDenied("Cannot change your own role")

        if "lab" in data:
            try:
                requested_lab_id = int(data["lab"])
            except (TypeError, ValueError):
                raise ValidationError({"lab": "Invalid lab"})
            if requested_lab_id != getattr(requester, "lab_id", None):
                raise PermissionDenied("Cannot move users to another lab")

        if (
            "is_active" in data
            and requested_bool(data["is_active"]) != target.is_active
        ):
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
        user_service.update_user(
            self.request.user, serializer.instance, serializer, self.request.data
        )

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

        if "notification_preferences" in data:
            user.notification_preferences = data["notification_preferences"] or {}

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
            return Response(
                {"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

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

        try:
            target = User.objects.select_related("lab").get(id=target_user_id)
        except User.DoesNotExist:
            return Response(
                {"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND
            )

        refresh = RefreshToken.for_user(target)
        _write_audit_log(
            request,
            action="user.impersonated",
            entity_type="user",
            entity_id=target.id,
            lab=target.lab,
            description=f"Superadmin {request.user.username} impersonated {target.username}",
            metadata={"impersonated_by": request.user.id},
        )
        return Response(
            {
                "user": UserSerializer(target).data,
                "access_token": str(refresh.access_token),
                "refresh_token": str(refresh),
            }
        )


class SessionLoginView(APIView):
    """JWT login that also persists a UserSession record."""

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"

    def post(self, request):
        serializer = MolarisTokenObtainPairSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        return Response(serializer.validated_data)


class SessionViewSet(viewsets.ViewSet):
    """List and revoke the current user's active sessions."""

    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        qs = UserSession.objects.filter(
            user=request.user, revoked=False, expires_at__gt=timezone.now()
        ).order_by("-created_at")
        return Response(
            [
                {
                    "id": s.id,
                    "jti": s.jti,
                    "ip_address": s.ip_address,
                    "device_info": s.device_info,
                    "created_at": s.created_at.isoformat(),
                    "expires_at": s.expires_at.isoformat(),
                }
                for s in qs
            ]
        )

    def destroy(self, request, pk=None):
        session = UserSession.objects.filter(pk=pk, user=request.user).first()
        if session is None:
            return Response(
                {"detail": "Session not found"}, status=status.HTTP_404_NOT_FOUND
            )
        session.revoked = True
        session.save(update_fields=["revoked"])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["delete"], url_path="revoke-all")
    def revoke_all(self, request):
        updated = UserSession.objects.filter(user=request.user, revoked=False).update(
            revoked=True
        )
        return Response({"revoked": updated})


class LabApiKeyViewSet(viewsets.ViewSet):
    """Generate and manage lab API keys (hashed storage, plaintext shown once)."""

    permission_classes = [permissions.IsAuthenticated]

    def get_throttles(self):
        if self.action == "create":
            self.throttle_scope = "api_key_create"
            return [ScopedRateThrottle()]
        return super().get_throttles()

    def _assert_admin(self, user):
        if not is_admin_or_superadmin(user):
            raise PermissionDenied("Only admin or superadmin can manage API keys")

    def _get_lab(self, user):
        if is_superadmin(user):
            return None
        lab = getattr(user, "lab", None)
        if not lab:
            raise PermissionDenied("No lab associated")
        return lab

    def list(self, request):
        self._assert_admin(request.user)
        lab = self._get_lab(request.user)
        qs = LabApiKey.objects.filter(is_active=True)
        if lab:
            qs = qs.filter(lab=lab)
        return Response(
            [
                {
                    "id": k.id,
                    "name": k.name,
                    "prefix": k.prefix,
                    "is_active": k.is_active,
                    "last_used_at": (
                        k.last_used_at.isoformat() if k.last_used_at else None
                    ),
                    "created_at": k.created_at.isoformat(),
                }
                for k in qs
            ]
        )

    def create(self, request):
        import hashlib

        self._assert_admin(request.user)
        name = (request.data.get("name") or "").strip()
        if not name:
            return Response(
                {"name": "Name is required"}, status=status.HTTP_400_BAD_REQUEST
            )

        lab = self._get_lab(request.user)
        if lab is None:
            lab_id = request.data.get("lab_id")
            if not lab_id:
                return Response(
                    {"lab_id": "lab_id required for superadmin"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            lab = Lab.objects.filter(id=lab_id).first()
            if not lab:
                return Response(
                    {"detail": "Lab not found"}, status=status.HTTP_404_NOT_FOUND
                )

        raw_key = secrets.token_urlsafe(32)
        prefix = raw_key[:8]
        hashed = hashlib.sha256(raw_key.encode()).hexdigest()

        key = LabApiKey.objects.create(
            lab=lab,
            name=name,
            prefix=prefix,
            hashed_key=hashed,
            created_by=request.user,
        )
        _write_audit_log(
            request,
            action="api_key.created",
            entity_type="lab_api_key",
            entity_id=key.id,
            lab=lab,
            description=f"API key {key.name} created",
            metadata={"name": key.name, "prefix": key.prefix},
        )
        return Response(
            {
                "id": key.id,
                "name": key.name,
                "prefix": key.prefix,
                "key": raw_key,
                "created_at": key.created_at.isoformat(),
            },
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, pk=None):
        self._assert_admin(request.user)
        lab = self._get_lab(request.user)
        qs = LabApiKey.objects.filter(pk=pk)
        if lab:
            qs = qs.filter(lab=lab)
        key = qs.first()
        if not key:
            return Response(
                {"detail": "API key not found"}, status=status.HTTP_404_NOT_FOUND
            )
        key.is_active = False
        key.save(update_fields=["is_active"])
        _write_audit_log(
            request,
            action="api_key.revoked",
            entity_type="lab_api_key",
            entity_id=key.id,
            lab=key.lab,
            description=f"API key {key.name} revoked",
            metadata={"name": key.name, "prefix": key.prefix},
        )
        return Response(status=status.HTTP_204_NO_CONTENT)


class SuperadminMetricsView(APIView):
    """Platform-level MRR/activity aggregates for superadmin."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not is_superadmin(request.user):
            raise PermissionDenied("Superadmin only endpoint")

        from apps.finance.models import Invoice, Subscription

        today = timezone.localdate()
        month_start = today.replace(day=1)

        total_labs = Lab.objects.count()
        total_users = User.objects.filter(is_active=True).count()
        active_subscriptions = Subscription.objects.filter(status="active").count()

        mrr = Invoice.objects.filter(
            status="paid",
            paid_at__date__gte=month_start,
            paid_at__date__lte=today,
        ).aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")

        recent_activity = []
        for log in AuditLog.objects.select_related("actor", "lab").order_by(
            "-created_at"
        )[:10]:
            recent_activity.append(
                {
                    "id": log.id,
                    "action": log.action,
                    "actor": log.actor.username if log.actor else None,
                    "lab": log.lab.name if log.lab else None,
                    "description": log.description,
                    "created_at": log.created_at.isoformat(),
                }
            )

        new_labs_this_month = Lab.objects.filter(
            created_at__date__gte=month_start
        ).count()
        new_users_this_month = User.objects.filter(
            date_joined__date__gte=month_start
        ).count()

        return Response(
            {
                "total_labs": total_labs,
                "total_users": total_users,
                "active_subscriptions": active_subscriptions,
                "mrr": f"{mrr:.2f}",
                "new_labs_this_month": new_labs_this_month,
                "new_users_this_month": new_users_this_month,
                "recent_activity": recent_activity,
            }
        )


class TwoFactorView(APIView):
    """TOTP-based 2FA: setup, verify (activate), disable."""

    permission_classes = [permissions.IsAuthenticated]

    def get_throttles(self):
        if (
            self.request.method == "POST"
            and self.request.query_params.get("action", "setup") == "verify"
        ):
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
                    {
                        "detail": "2FA is already active. Disable it first before re-enrolling."
                    },
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
            return Response(
                {"totp_enabled": True, "message": "2FA activated successfully."}
            )

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
            {
                "detail": f"Unknown action '{action_name}'. Use setup, verify, or disable."
            },
            status=status.HTTP_400_BAD_REQUEST,
        )


_ROLE_PERMISSIONS = {
    "superadmin": {
        "description": "Full platform access across all labs",
        "actions": [
            "lab:read",
            "lab:write",
            "lab:delete",
            "user:read",
            "user:write",
            "user:delete",
            "user:impersonate",
            "patient:read",
            "patient:write",
            "patient:delete",
            "clinic:read",
            "clinic:write",
            "clinic:delete",
            "doctor:read",
            "doctor:write",
            "doctor:delete",
            "job:read",
            "job:write",
            "job:delete",
            "invoice:read",
            "invoice:write",
            "invoice:delete",
            "inventory:read",
            "inventory:write",
            "inventory:delete",
            "audit_log:read",
            "session:read",
            "session:revoke",
            "api_key:read",
            "api_key:write",
            "api_key:delete",
            "2fa:manage",
            "system_health:read",
            "superadmin_metrics:read",
        ],
    },
    "admin": {
        "description": "Full access within own lab",
        "actions": [
            "lab:read",
            "lab:write",
            "user:read",
            "user:write",
            "patient:read",
            "patient:write",
            "patient:delete",
            "clinic:read",
            "clinic:write",
            "clinic:delete",
            "doctor:read",
            "doctor:write",
            "doctor:delete",
            "job:read",
            "job:write",
            "job:delete",
            "invoice:read",
            "invoice:write",
            "invoice:delete",
            "inventory:read",
            "inventory:write",
            "inventory:delete",
            "audit_log:read",
            "session:read",
            "session:revoke",
            "api_key:read",
            "api_key:write",
            "api_key:delete",
            "2fa:manage",
        ],
    },
    "user": {
        "description": "Standard lab user — can read most resources, limited write",
        "actions": [
            "lab:read",
            "patient:read",
            "clinic:read",
            "doctor:read",
            "job:read",
            "job:write",
            "invoice:read",
            "inventory:read",
            "session:read",
            "session:revoke",
            "2fa:manage",
        ],
    },
    "technician": {
        "description": "Technician — focused on job execution, no invoicing or admin",
        "actions": [
            "lab:read",
            "patient:read",
            "job:read",
            "job:write",
            "inventory:read",
            "session:read",
            "session:revoke",
            "2fa:manage",
        ],
    },
}


class PermissionsMatrixView(APIView):
    """Return the full role → allowed actions matrix."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        role = getattr(user, "role", "user")
        return Response(
            {
                "current_role": role,
                "current_permissions": _ROLE_PERMISSIONS.get(role, {}).get(
                    "actions", []
                ),
                "matrix": _ROLE_PERMISSIONS,
            }
        )


class LabRolePermissionViewSet(viewsets.ViewSet):
    """Manage per-lab role permission metadata overrides. Admin-only."""

    permission_classes = [permissions.IsAuthenticated]

    def _get_lab(self, request, lab_pk):
        user = request.user
        if is_superadmin(user):
            return Lab.objects.filter(pk=lab_pk).first()
        try:
            requested_lab_id = int(lab_pk)
        except (TypeError, ValueError):
            return None
        if (
            is_admin_or_superadmin(user)
            and getattr(user, "lab_id", None) == requested_lab_id
        ):
            return user.lab
        return None

    def list(self, request, lab_pk=None):
        lab = self._get_lab(request, lab_pk)
        if not lab:
            raise PermissionDenied("Access denied or lab not found.")
        overrides = LabRolePermission.objects.filter(lab=lab)
        data = [
            {"id": o.id, "role": o.role, "action": o.action, "allowed": o.allowed}
            for o in overrides
        ]
        return Response(data)

    def create(self, request, lab_pk=None):
        lab = self._get_lab(request, lab_pk)
        if not lab:
            raise PermissionDenied("Access denied or lab not found.")
        role = request.data.get("role")
        action_name = request.data.get("action")
        raw_allowed = request.data.get("allowed", True)
        if not role or not action_name:
            return Response(
                {"detail": "role and action are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        valid_roles = {r for r, _ in LabRolePermission.ROLE_CHOICES}
        if role not in valid_roles:
            return Response(
                {"detail": f"role must be one of: {', '.join(sorted(valid_roles))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Normalise: JSON bool → Python bool; string "false"/"0" → False.
        if isinstance(raw_allowed, str):
            allowed = raw_allowed.lower() not in ("false", "0", "no")
        else:
            allowed = bool(raw_allowed)
        override, _ = LabRolePermission.objects.update_or_create(
            lab=lab,
            role=role,
            action=action_name,
            defaults={"allowed": allowed},
        )
        _write_audit_log(
            request,
            action="permission_override.saved",
            entity_type="lab_role_permission",
            entity_id=override.id,
            lab=lab,
            description=f"Permission override {role}:{action_name}={allowed}",
            metadata={"role": role, "action": action_name, "allowed": allowed},
        )
        return Response(
            {
                "id": override.id,
                "role": override.role,
                "action": override.action,
                "allowed": override.allowed,
            },
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, lab_pk=None, pk=None):
        lab = self._get_lab(request, lab_pk)
        if not lab:
            raise PermissionDenied("Access denied or lab not found.")
        override = LabRolePermission.objects.filter(lab=lab, pk=pk).first()
        if not override:
            return Response({"detail": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        metadata = {
            "role": override.role,
            "action": override.action,
            "allowed": override.allowed,
        }
        entity_id = override.id
        description = f"Permission override {override.role}:{override.action} deleted"
        override.delete()
        _write_audit_log(
            request,
            action="permission_override.deleted",
            entity_type="lab_role_permission",
            entity_id=entity_id,
            lab=lab,
            description=description,
            metadata=metadata,
        )
        return Response(status=status.HTTP_204_NO_CONTENT)
