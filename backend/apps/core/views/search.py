from django.db.models import Q
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..access import AUTHENTICATED, is_admin_or_superadmin, is_superadmin


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
    actions = []
    if is_admin_or_superadmin(user):
        actions = [
            (
                "action:new-job",
                "action",
                "Vytvoriť novú prácu",
                "Quick add",
                "/jobs/new",
            ),
            ("action:new-patient", "action", "Pridať pacienta", "CRM", "/patients"),
            (
                "action:new-invoice",
                "action",
                "Vytvoriť faktúru",
                "Finance",
                "/invoices",
            ),
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
    permission_classes = AUTHENTICATED

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
            jobs_qs = Job.objects.select_related("patient", "clinic").filter(lab_id=lab_id)
            invoices_qs = Invoice.objects.select_related("clinic").filter(lab_id=lab_id)
        else:
            return Response(
                {"detail": "Používateľ nemá priradené laboratórium"},
                status=status.HTTP_403_FORBIDDEN,
            )

        results = _static_search_results(query, user)

        if query:
            patient_filter = (
                Q(first_name__icontains=query)
                | Q(last_name__icontains=query)
                | Q(birth_number__icontains=query)
                | Q(email__icontains=query)
            )
            for patient in patients_qs.filter(patient_filter).order_by("last_name", "first_name")[:limit]:
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
                    f"{job.patient.first_name} {job.patient.last_name}".strip() if job.patient_id else "Neznámy pacient"
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

            invoice_filter = Q(number__icontains=query) | Q(status__icontains=query) | Q(clinic__name__icontains=query)
            for invoice in invoices_qs.filter(invoice_filter).order_by("-created_at")[:limit]:
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
