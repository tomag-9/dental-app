from django.db import connection
from django.utils import timezone
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from ..access import AUTHENTICATED, is_superadmin
from ..models import Lab, Notification, TeamInvitation, User


class HealthCheckResponseSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=("ok", "unhealthy"))
    checks = serializers.DictField(child=serializers.ChoiceField(choices=("ok", "error")))


class HealthCheckView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []

    @extend_schema(
        responses={
            200: HealthCheckResponseSerializer,
            503: OpenApiResponse(
                response=HealthCheckResponseSerializer,
                description="Database connectivity check failed.",
            ),
        }
    )
    def get(self, request):
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception:
            return Response(
                {"status": "unhealthy", "checks": {"database": "error"}},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({"status": "ok", "checks": {"database": "ok"}})


class SystemHealthView(APIView):
    permission_classes = AUTHENTICATED

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
            checks.append({"service": "migrations", "status": "error", "detail": str(exc)})

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

        import sys

        import django

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
                    "pending_migrations": (pending_migrations if "pending_migrations" in dir() else None),
                    "memory": memory_info,
                },
            }
        )
