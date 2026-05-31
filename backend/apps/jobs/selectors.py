from apps.core.access import tenant_scoped_queryset

from .models import CalendarEvent, Job, Technician


def jobs_for_user(user):
    return tenant_scoped_queryset(Job.objects.all(), user)


def technicians_for_user(user):
    return tenant_scoped_queryset(Technician.objects.all(), user)


def calendar_events_for_user(user):
    return tenant_scoped_queryset(CalendarEvent.objects.all(), user)
