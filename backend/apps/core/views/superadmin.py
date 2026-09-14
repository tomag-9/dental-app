from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from ..access import AUTHENTICATED, is_superadmin
from ..models import AuditLog, Lab, User

# Subscription statuses that still represent billable platform revenue.
BILLING_SUBSCRIPTION_STATUSES = ("active", "past_due")


class SuperadminMetricsView(APIView):
    """Platform-level MRR/activity aggregates for superadmin."""

    permission_classes = AUTHENTICATED

    def get(self, request):
        if not is_superadmin(request.user):
            raise PermissionDenied("Superadmin only endpoint")

        from apps.finance.models import Subscription

        today = timezone.localdate()
        month_start = today.replace(day=1)

        total_labs = Lab.objects.count()
        total_users = User.objects.filter(is_active=True).count()

        # Platform metrics are derived from Subscription (what labs pay us).
        # Invoice rows are lab->clinic revenue (what our customers bill their
        # customers) and must never leak into platform MRR/ARR — see issue #110.
        subscriptions = Subscription.objects.all()
        active_subscriptions = subscriptions.filter(status="active").count()
        past_due_subscriptions = subscriptions.filter(status="past_due").count()
        billing_subscriptions = subscriptions.filter(status__in=BILLING_SUBSCRIPTION_STATUSES)

        mrr = billing_subscriptions.aggregate(total=Sum("mrr"))["total"] or Decimal("0.00")
        arr = mrr * 12

        trial_labs = subscriptions.filter(trial_ends_at__gte=today).exclude(status="cancelled").count()

        cancelled_this_month = subscriptions.filter(
            status="cancelled",
            cancelled_at__date__gte=month_start,
            cancelled_at__date__lte=today,
        ).count()
        churn_base = active_subscriptions + past_due_subscriptions + cancelled_this_month
        churn_rate = (Decimal(cancelled_this_month) / Decimal(churn_base) * 100) if churn_base else Decimal("0")

        recent_activity = []
        for log in AuditLog.objects.select_related("actor", "lab").order_by("-created_at")[:10]:
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

        new_labs_this_month = Lab.objects.filter(created_at__date__gte=month_start).count()
        new_users_this_month = User.objects.filter(date_joined__date__gte=month_start).count()

        return Response(
            {
                "total_labs": total_labs,
                "total_users": total_users,
                "active_subscriptions": active_subscriptions,
                "past_due_subscriptions": past_due_subscriptions,
                "trial_labs": trial_labs,
                "mrr": f"{mrr:.2f}",
                "arr": f"{arr:.2f}",
                "cancelled_this_month": cancelled_this_month,
                "churn_rate": f"{churn_rate.quantize(Decimal('0.01'))}",
                "new_labs_this_month": new_labs_this_month,
                "new_users_this_month": new_users_this_month,
                "recent_activity": recent_activity,
            }
        )
