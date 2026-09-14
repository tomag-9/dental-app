from datetime import timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.jobs.models import CalendarEvent, Vacation

from ..access import AUTHENTICATED, is_superadmin


class DashboardStatsView(APIView):
    permission_classes = AUTHENTICATED

    def get(self, request):
        from apps.crm.models import Patient
        from apps.finance.models import Invoice
        from apps.jobs.models import Job

        user = request.user
        lab_id = getattr(user, "lab_id", None)

        if is_superadmin(user):
            patients_qs = Patient.objects.all()
            jobs_qs = Job.objects.select_related("patient").order_by("-created_at")
            invoices_qs = Invoice.objects.select_related("clinic").order_by("-created_at")
        elif lab_id:
            patients_qs = Patient.objects.filter(lab_id=lab_id)
            jobs_qs = Job.objects.filter(lab_id=lab_id).select_related("patient").order_by("-created_at")
            invoices_qs = Invoice.objects.filter(lab_id=lab_id).select_related("clinic").order_by("-created_at")
        else:
            return Response(
                {"detail": "Používateľ nemá priradené laboratórium"},
                status=status.HTTP_403_FORBIDDEN,
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
        total_revenue = invoices_qs.filter(status="paid").aggregate(total=Sum("total_amount"))["total"] or Decimal(
            "0.00"
        )
        today = timezone.localdate()
        period_start = today.replace(day=1)
        if period_start.month == 1:
            previous_period_start = period_start.replace(year=period_start.year - 1, month=12)
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
                    "created_at": (inv.created_at.isoformat() if inv.created_at else None),
                    "issued_at": inv.issued_at.isoformat() if inv.issued_at else None,
                }
            )

        today_schedule_data = []
        for job in jobs_qs.filter(due_date=today).exclude(
            status__in=("completed", "cancelled", "finished_factured", "closed")
        )[:6]:
            patient = job.patient
            patient_name = f"{patient.first_name} {patient.last_name}".strip() if patient else "Neznámy pacient"
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

    permission_classes = AUTHENTICATED

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
                {"detail": "Používateľ nemá priradené laboratórium"},
                status=status.HTTP_403_FORBIDDEN,
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
                "daily_revenue": [{"date": d, "revenue": f"{v:.2f}"} for d, v in daily_revenue.items()],
                "daily_jobs": [{"date": d, "count": c} for d, c in daily_jobs.items()],
                "status_distribution": [{"status": s, "count": c} for s, c in sorted(status_counts.items())],
            }
        )
