import calendar
import csv
import logging
from datetime import date
from decimal import Decimal
from io import BytesIO, StringIO

import openpyxl
from django.conf import settings as django_settings
from django.core.mail import EmailMessage
from django.db import transaction
from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_date
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from reportlab.graphics import renderSVG
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import (
    AUTHENTICATED,
    IsReadOnlyOrAdminOrSuperadminPermission,
    LabActiveRequired,
    SubscriptionWriteAllowed,
    TenantScopedQuerysetMixin,
    assert_lab_permission,
    is_superadmin,
)
from apps.core.exports import limited_export_queryset
from apps.core.localization import (
    INVOICE_STATUS_LABELS,
    format_sk_currency,
    format_sk_date,
)
from apps.core.models import User

from . import invoice_service, stripe_service
from . import services as finance_services
from .models import Invoice, PriceList, Subscription
from .pay_by_square import PayBySquareError
from .pdf import build_invoice_context, render_invoice_pdf
from .selectors import invoices_for_user, price_list_for_user
from .serializers import (
    InvoiceCreateSerializer,
    InvoiceEmailSerializer,
    InvoiceListSerializer,
    InvoiceSerializer,
    InvoiceStatusUpdateSerializer,
    PriceListSerializer,
    SubscriptionSerializer,
)

logger = logging.getLogger(__name__)


class InvoicePageNumberPagination(PageNumberPagination):
    """Keep invoice collection responses bounded; detail data has its own endpoint."""

    page_size = 100
    page_size_query_param = "page_size"
    max_page_size = 100


def _write_invoice_audit(request, invoice, action, metadata=None, description=None):
    actor = getattr(request, "user", None)
    if actor is not None and not actor.is_authenticated:
        actor = None
    invoice_service.write_invoice_audit(actor, invoice, action, metadata, description)


class PriceListViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = PriceList.objects.all()
    serializer_class = PriceListSerializer
    permission_classes = [
        permissions.IsAuthenticated,
        IsReadOnlyOrAdminOrSuperadminPermission,
        SubscriptionWriteAllowed,
        LabActiveRequired,
    ]

    def get_queryset(self):
        return price_list_for_user(self.request.user).order_by("code", "id")

    def perform_create(self, serializer):
        self.save_with_request_lab(serializer)

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        item = self.get_object()
        base_code = f"{item.code}-COPY"
        code = base_code
        suffix = 2
        while PriceList.objects.filter(lab=item.lab, code=code).exists():
            code = f"{base_code}-{suffix}"
            suffix += 1

        duplicate = PriceList.objects.create(
            lab=item.lab,
            code=code,
            description=item.description,
            price=item.price,
            valid_from=item.valid_from,
            valid_to=item.valid_to,
        )
        return Response(
            self.get_serializer(duplicate).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        qs = self.get_queryset().order_by("code")
        header = ["Kód", "Popis", "Cena", "Kategória", "Platné od", "Platné do"]
        rows = [
            [
                item.code,
                item.description,
                format_sk_currency(item.price),
                item.category or "",
                format_sk_date(item.valid_from),
                format_sk_date(item.valid_to),
            ]
            for item in limited_export_queryset(qs, "price-list")
        ]
        if request.query_params.get("export_format") == "xlsx":
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Cenník"
            ws.append(header)
            for row in rows:
                ws.append(row)
            buf = BytesIO()
            wb.save(buf)
            buf.seek(0)
            response = HttpResponse(
                buf.read(),
                content_type=("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            )
            response["Content-Disposition"] = 'attachment; filename="pricelist.xlsx"'
            return response
        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)
        response = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="pricelist.csv"'
        return response


class InvoiceViewSet(viewsets.ModelViewSet):
    # Per-lab overrides for this coarse UI capability are enforced here.
    lab_permission_action = "create_invoice"
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    pagination_class = InvoicePageNumberPagination
    permission_classes = [
        permissions.IsAuthenticated,
        IsReadOnlyOrAdminOrSuperadminPermission,
        SubscriptionWriteAllowed,
        LabActiveRequired,
    ]

    def get_serializer_class(self):
        if self.action == "list":
            return InvoiceListSerializer
        return InvoiceSerializer

    def _build_qr_svg(self, payload, size=128):
        widget = qr.QrCodeWidget(payload)
        x0, y0, x1, y1 = widget.getBounds()
        width = x1 - x0
        height = y1 - y0
        drawing = Drawing(
            size,
            size,
            transform=[size / width, 0, 0, size / height, 0, 0],
        )
        drawing.add(widget)
        return renderSVG.drawToString(drawing), drawing

    def get_queryset(self):
        qs = invoices_for_user(self.request.user)
        qs = qs.select_related("clinic", "lab").prefetch_related("items__job__patient")
        if self.action in {"retrieve", "pdf", "send_email", "update_status"}:
            qs = qs.prefetch_related(
                "items__job__material_usages__recipe_source",
                "items__job__material_usages__lines",
            )

        params = self.request.query_params
        if status_filter := params.get("status"):
            qs = qs.filter(status=status_filter)
        if doc_type := params.get("document_type"):
            qs = qs.filter(document_type=doc_type)
        if clinic_id := params.get("clinic_id"):
            try:
                qs = qs.filter(clinic_id=int(clinic_id))
            except (ValueError, TypeError):
                pass
        if date_from := parse_date(params.get("date_from", "")):
            qs = qs.filter(due_date__gte=date_from)
        if date_to := parse_date(params.get("date_to", "")):
            qs = qs.filter(due_date__lte=date_to)

        return qs.order_by("-created_at", "-id")

    def create(self, request, *args, **kwargs):
        payload = InvoiceCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        invoice = finance_services.create_invoice_from_jobs(
            user=request.user,
            clinic_id=data["clinic_id"],
            job_ids=data["job_ids"],
            document_type=data.get("document_type", "invoice"),
            discount_percent=data.get("discount_percent", Decimal("0")),
            description_mode=data.get("description_mode", "structured"),
            custom_description=data.get("custom_description", ""),
            show_patient_list=data.get("show_patient_list", True),
        )
        return Response(
            InvoiceSerializer(invoice, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["put"], url_path="status")
    def update_status(self, request, pk=None):
        invoice = self.get_object()
        payload = InvoiceStatusUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        invoice = finance_services.update_invoice_status(
            user=request.user,
            invoice=invoice,
            status=payload.validated_data["status"],
        )
        return Response(InvoiceSerializer(invoice, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="qr")
    def qr(self, request, pk=None):
        invoice = self.get_object()
        try:
            payload = finance_services.build_invoice_payment_payload(invoice)
        except PayBySquareError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        svg_markup, _ = self._build_qr_svg(payload)
        if isinstance(svg_markup, bytes):
            content = svg_markup
        else:
            content = svg_markup.encode("utf-8")
        return HttpResponse(content, content_type="image/svg+xml")

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        invoice = self.get_object()
        pdf_bytes = render_invoice_pdf(build_invoice_context(invoice))
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'inline; filename="faktura_{invoice.number}.pdf"'
        return response

    @action(detail=True, methods=["post"], url_path="send-email")
    def send_email(self, request, pk=None):
        """Email the invoice PDF to the clinic contact or a provided address."""
        invoice = self.get_object()
        clinic = invoice.clinic
        payload = InvoiceEmailSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        clinic_contact = (clinic.contact_info or {}) if clinic else {}
        clinic_email = clinic_contact.get("email") if isinstance(clinic_contact, dict) else None
        recipient = payload.validated_data.get("email") or clinic_email
        if not recipient:
            detail = "Chýba e-mail príjemcu. Zadajte 'email' v požiadavke alebo nastavte clinic contact_info.email."
            return Response(
                {"detail": detail},
                status=status.HTTP_400_BAD_REQUEST,
            )

        pdf_bytes = render_invoice_pdf(build_invoice_context(invoice))

        try:
            invoice_service.send_invoice_email(request.user, invoice, pdf_bytes, recipient)
        except Exception:
            logger.exception("Invoice email delivery failed", extra={"invoice_id": invoice.id})
            return Response(
                {"detail": "Odoslanie e-mailu zlyhalo. Skontrolujte nastavenie odosielania a skúste to znova."},
                status=status.HTTP_502_BAD_GATEWAY,
            )
        return Response({"sent_to": recipient, "invoice": invoice.number})

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        invoice = self.get_object()
        invoice_service.delete_invoice(request.user, invoice)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=False, methods=["post"], url_path="send-overdue-reminders")
    def send_overdue_reminders(self, request):
        """Send reminder emails for all overdue issued invoices in this lab."""
        today = date.today()
        # Build queryset directly — bypass list-filter query params so a stray
        # ?status= on the POST does not silently suppress reminder delivery.
        user = request.user
        base_qs = Invoice.objects.select_related("clinic", "lab")
        if not is_superadmin(user):
            lab_id = getattr(user, "lab_id", None)
            base_qs = base_qs.filter(lab_id=lab_id) if lab_id else base_qs.none()
        qs = base_qs.filter(status="issued", due_date__lt=today)

        sent = []
        failed = []
        for invoice in qs:
            clinic = invoice.clinic
            recipient = (clinic.contact_info or {}).get("email") if clinic else None
            if not recipient:
                failed.append({"invoice": invoice.number, "reason": "Chýba e-mail príjemcu"})
                continue

            pdf_bytes = render_invoice_pdf(build_invoice_context(invoice))

            days_overdue = (today - invoice.due_date).days
            lab = invoice.lab
            subject = f"Upomienka: Faktúra č. {invoice.number} je po splatnosti"
            body = (
                f"Dobrý deň,\n\n"
                f"Faktúra č. {invoice.number} je po splatnosti {days_overdue} dní"
                f" (splatnosť: {invoice.due_date.strftime('%d.%m.%Y')}).\n\n"
                f"Prosíme o úhradu v čo najkratšom čase.\n\n"
                f"S pozdravom,\n{lab.name if lab else 'Dentálne laboratórium'}"
            )
            msg = EmailMessage(
                subject=subject,
                body=body,
                from_email=getattr(django_settings, "DEFAULT_FROM_EMAIL", "noreply@dentalapp.sk"),
                to=[recipient],
            )
            msg.attach(f"faktura_{invoice.number}.pdf", pdf_bytes, "application/pdf")
            try:
                msg.send(fail_silently=False)
                _write_invoice_audit(
                    request,
                    invoice,
                    "invoice.reminder_sent",
                    metadata={"sent_to": recipient, "days_overdue": days_overdue},
                )
                sent.append(invoice.number)
            except Exception as exc:
                failed.append({"invoice": invoice.number, "reason": str(exc)})

        return Response(
            {"sent": sent, "sent_count": len(sent), "failed": failed},
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        qs = self.get_queryset()
        status_filter = request.query_params.get("status")
        if status_filter:
            qs = qs.filter(status=status_filter)
        qs = qs.select_related("clinic", "lab").order_by("-created_at")

        header = [
            "Číslo",
            "Stav",
            "Klinika",
            "Laboratórium",
            "Suma celkom",
            "Dátum splatnosti",
            "Dátum vystavenia",
            "Dátum úhrady",
            "Vytvorené",
        ]
        rows = [
            [
                inv.number,
                INVOICE_STATUS_LABELS.get(inv.status, inv.status),
                inv.clinic.name,
                inv.lab.name,
                format_sk_currency(inv.total_amount),
                format_sk_date(inv.due_date),
                format_sk_date(inv.issued_at),
                format_sk_date(inv.paid_at),
                format_sk_date(inv.created_at),
            ]
            for inv in limited_export_queryset(qs, "invoices")
        ]

        if request.query_params.get("export_format") == "xlsx":
            wb = openpyxl.Workbook()
            ws = wb.active
            ws.title = "Faktúry"
            ws.append(header)
            for row in rows:
                ws.append(row)
            buf = BytesIO()
            wb.save(buf)
            buf.seek(0)
            response = HttpResponse(
                buf.read(),
                content_type=("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            )
            response["Content-Disposition"] = 'attachment; filename="invoices.xlsx"'
            return response

        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(header)
        for row in rows:
            writer.writerow(row)
        response = HttpResponse(buf.getvalue(), content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="invoices.csv"'
        return response


class SubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    permission_classes = AUTHENTICATED

    def _assert_superadmin(self, user):
        # "manage_platform" is a platform-scoped action: no per-lab override
        # can ever grant it, so this stays superadmin-only by construction.
        assert_lab_permission(user, "manage_platform", "Superadmin only endpoint")

    def get_queryset(self):
        if is_superadmin(self.request.user):
            return Subscription.objects.all()
        return Subscription.objects.none()

    def list(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().list(request, *args, **kwargs)

    def retrieve(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().retrieve(request, *args, **kwargs)

    def create(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().update(request, *args, **kwargs)

    def partial_update(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().partial_update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        self._assert_superadmin(request.user)
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="my")
    def my(self, request):
        user = request.user
        if not getattr(user, "lab_id", None):
            return Response(
                {"detail": "Používateľ nemá priradené laboratórium"},
                status=status.HTTP_404_NOT_FOUND,
            )

        subscription = Subscription.objects.filter(lab_id=user.lab_id).first()
        if not subscription:
            return Response(
                {"detail": "No subscription found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        data = SubscriptionSerializer(subscription).data
        # Billing state the UI needs *before* a user runs into a 402.
        grace_ends_at = subscription.grace_ends_at()
        data["billing"] = {
            "read_only": subscription.is_read_only,
            "grace_ends_at": grace_ends_at.isoformat() if grace_ends_at else None,
            "billing_url": getattr(django_settings, "SUBSCRIPTION_BILLING_URL", ""),
            "stripe_enabled": stripe_service.stripe_enabled(),
            "has_payment_account": bool(subscription.stripe_customer_id),
            "seat_limit": subscription.seats,
            "seats_used": User.objects.filter(lab_id=user.lab_id, is_active=True).count(),
        }
        return Response(data)

    def _lab_admin_or_403(self, request):
        """Checkout and portal are billing actions — lab admins only.

        The lab always comes from ``request.user``; a lab admin can never name
        another tenant, so there is no way to open a session against a
        different lab's Stripe customer.
        """
        assert_lab_permission(
            request.user,
            "lab:write",
            "Predplatné môže spravovať iba administrátor laboratória.",
        )
        lab = getattr(request.user, "lab", None)
        if lab is None:
            raise ValidationError("Používateľ nemá priradené laboratórium.")
        return lab

    @action(detail=False, methods=["post"], url_path="checkout")
    def checkout(self, request):
        lab = self._lab_admin_or_403(request)
        # The plan name is the only client input; the price behind it is
        # resolved from settings, never from the request.
        plan = str(request.data.get("plan") or "").strip()
        try:
            url = stripe_service.create_checkout_session(lab, plan)
        except stripe_service.StripeNotConfigured as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except stripe_service.StripeServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"url": url})

    @action(detail=False, methods=["post"], url_path="portal")
    def portal(self, request):
        lab = self._lab_admin_or_403(request)
        try:
            url = stripe_service.create_portal_session(lab)
        except stripe_service.StripeNotConfigured as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        except stripe_service.StripeServiceError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"url": url})


class StripeWebhookView(APIView):
    """Stripe's authoritative channel for subscription lifecycle changes.

    Three deliberate exemptions, each of which would otherwise break delivery:

    * ``authentication_classes = []`` — ``JWTCookieAuthentication`` enforces
      CSRF on cookie-authenticated requests, and Stripe carries no cookie and
      no CSRF token. Dropping authentication also drops that check; the view is
      additionally ``csrf_exempt`` so nothing re-adds it.
    * ``throttle_classes = []`` — ``ScopedRateThrottle`` is the project default.
      A burst of deliveries throttled to 429 is a burst of events lost after
      Stripe exhausts its retries.
    * ``permission_classes = [AllowAny]`` — the signature *is* the
      authentication. Nothing is processed before it verifies.
    """

    authentication_classes = []
    permission_classes = [permissions.AllowAny]
    throttle_classes = []

    @method_decorator(csrf_exempt)
    def dispatch(self, request, *args, **kwargs):
        return super().dispatch(request, *args, **kwargs)

    def post(self, request):
        if not stripe_service.webhook_enabled():
            # Not configured: nothing can be verified, so nothing is trusted.
            return Response(
                {"detail": "Stripe webhook nie je nakonfigurovaný."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        signature = request.META.get("HTTP_STRIPE_SIGNATURE", "")
        try:
            event = stripe_service.construct_event(request.body, signature)
        except stripe_service.StripeNotConfigured:
            return Response(
                {"detail": "Stripe webhook nie je nakonfigurovaný."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception:
            # Invalid or missing signature — 400 so Stripe surfaces it in the
            # dashboard, and so a forged payload never reaches a handler.
            logger.warning("Rejected Stripe webhook with invalid signature")
            return Response(
                {"detail": "Neplatný podpis webhooku."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            handled, note = stripe_service.process_event(event)
        except Exception:
            # A handler bug must not turn into an infinite Stripe retry loop
            # against an endpoint that will keep failing the same way.
            logger.exception("Stripe webhook handler failed")
            return Response({"received": True, "handled": False}, status=status.HTTP_200_OK)

        # Always 200 — including unknown types and duplicates. 4xx/5xx here
        # starts a retry cycle that we cannot stop.
        return Response({"received": True, "handled": handled, "note": note}, status=status.HTTP_200_OK)


def _month_window(dt):
    first = dt.replace(day=1)
    last = dt.replace(day=calendar.monthrange(dt.year, dt.month)[1])
    return first, last


def _months_ago(n):
    today = timezone.localdate()
    month = today.month - n
    year = today.year
    while month <= 0:
        month += 12
        year -= 1
    return date(year, month, 1)


class FinanceStatsView(APIView):
    permission_classes = AUTHENTICATED

    def get(self, request):
        user = request.user
        lab_id = getattr(user, "lab_id", None)

        if is_superadmin(user):
            qs = Invoice.objects.all()
        elif lab_id:
            qs = Invoice.objects.filter(lab_id=lab_id)
        else:
            return Response(
                {"detail": "Používateľ nemá priradené laboratórium"},
                status=status.HTTP_403_FORBIDDEN,
            )

        total_revenue = qs.filter(status="paid").aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")
        pending_invoices = qs.filter(status="issued").count()

        today = timezone.localdate()
        overdue_qs = qs.filter(status="issued", due_date__lt=today)
        overdue_amount = overdue_qs.aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")

        this_start, this_end = _month_window(today)
        last_month = _months_ago(1)
        last_start, last_end = _month_window(last_month)

        this_month_rev = qs.filter(
            status="paid",
            paid_at__date__gte=this_start,
            paid_at__date__lte=this_end,
        ).aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")
        last_month_rev = qs.filter(
            status="paid",
            paid_at__date__gte=last_start,
            paid_at__date__lte=last_end,
        ).aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")

        if last_month_rev > 0:
            growth_pct = float((this_month_rev - last_month_rev) / last_month_rev * 100)
        else:
            growth_pct = 0.0

        monthly_revenue = []
        for i in range(5, -1, -1):
            month_date = _months_ago(i)
            m_start, m_end = _month_window(month_date)
            rev = qs.filter(
                status="paid",
                paid_at__date__gte=m_start,
                paid_at__date__lte=m_end,
            ).aggregate(total=Sum("total_amount"))["total"] or Decimal("0.00")
            monthly_revenue.append(
                {
                    "month": month_date.strftime("%b %Y"),
                    "revenue": str(rev),
                }
            )

        paid_invoices = qs.filter(status="paid", paid_at__isnull=False)
        payment_days = []
        for invoice in paid_invoices:
            start = invoice.issued_at or invoice.created_at
            if start and invoice.paid_at:
                payment_days.append((invoice.paid_at.date() - start.date()).days)
        average_payment_days = round(sum(payment_days) / len(payment_days), 1) if payment_days else 0.0

        top_clinics = []
        top_clinic_rows = (
            qs.filter(status="paid")
            .values("clinic_id", "clinic__name")
            .annotate(revenue=Sum("total_amount"))
            .order_by("-revenue", "clinic__name")[:5]
        )
        for row in top_clinic_rows:
            top_clinics.append(
                {
                    "clinic_id": row["clinic_id"],
                    "clinic_name": row["clinic__name"],
                    "revenue": f"{row['revenue'] or Decimal('0.00'):.2f}",
                }
            )

        issued_qs = qs.filter(status="issued", due_date__isnull=False)
        aging = {"current": 0, "1_30": 0, "31_60": 0, "61_90": 0, "over_90": 0}
        for inv in issued_qs.only("due_date"):
            days = (today - inv.due_date).days
            if days <= 0:
                aging["current"] += 1
            elif days <= 30:
                aging["1_30"] += 1
            elif days <= 60:
                aging["31_60"] += 1
            elif days <= 90:
                aging["61_90"] += 1
            else:
                aging["over_90"] += 1

        return Response(
            {
                "total_revenue": str(total_revenue),
                "pending_invoices": pending_invoices,
                "overdue_invoices": overdue_qs.count(),
                "overdue_amount": f"{overdue_amount:.2f}",
                "average_payment_days": average_payment_days,
                "top_clinics": top_clinics,
                "monthly_growth_pct": round(growth_pct, 1),
                "monthly_revenue": monthly_revenue,
                "aging": aging,
            }
        )


class ProcedureCatalogView(APIView):
    """Returns PriceList items grouped by category for the current lab."""

    permission_classes = AUTHENTICATED

    def get(self, request):
        user = request.user
        if is_superadmin(user):
            qs = PriceList.objects.all()
        elif getattr(user, "lab_id", None):
            qs = PriceList.objects.filter(lab_id=user.lab_id)
        else:
            return Response(
                {"detail": "Používateľ nemá priradené laboratórium"},
                status=status.HTTP_403_FORBIDDEN,
            )

        from .models import PROCEDURE_CATEGORY_CHOICES

        category_map = {key: label for key, label in PROCEDURE_CATEGORY_CHOICES}
        groups = {}
        uncategorized = []

        for item in qs.order_by("category", "code"):
            serialized = {
                "id": item.id,
                "code": item.code,
                "description": item.description,
                "price": str(item.price),
                "category": item.category,
            }
            if item.category and item.category in category_map:
                groups.setdefault(
                    item.category,
                    {
                        "category": item.category,
                        "label": category_map[item.category],
                        "items": [],
                    },
                )["items"].append(serialized)
            else:
                uncategorized.append(serialized)

        result = list(groups.values())
        if uncategorized:
            result.append(
                {
                    "category": None,
                    "label": "Nezaradené",
                    "items": uncategorized,
                }
            )

        return Response(result)


class InvoiceAgingView(APIView):
    """Buckets overdue issued invoices by age: 0-30, 31-60, 61-90, 90+ days."""

    permission_classes = AUTHENTICATED

    def get(self, request):
        user = request.user
        if is_superadmin(user):
            qs = Invoice.objects.filter(status="issued")
        elif getattr(user, "lab_id", None):
            qs = Invoice.objects.filter(status="issued", lab_id=user.lab_id)
        else:
            return Response(
                {"detail": "Používateľ nemá priradené laboratórium"},
                status=status.HTTP_403_FORBIDDEN,
            )

        today = timezone.localdate()
        buckets = {
            "current": {
                "label": "Aktuálne (≤0 dní)",
                "count": 0,
                "amount": Decimal("0.00"),
            },
            "1_30": {"label": "1–30 dní", "count": 0, "amount": Decimal("0.00")},
            "31_60": {"label": "31–60 dní", "count": 0, "amount": Decimal("0.00")},
            "61_90": {"label": "61–90 dní", "count": 0, "amount": Decimal("0.00")},
            "over_90": {
                "label": "Viac ako 90 dní",
                "count": 0,
                "amount": Decimal("0.00"),
            },
        }

        for invoice in qs.filter(due_date__isnull=False):
            days_overdue = (today - invoice.due_date).days
            amount = invoice.total_amount or Decimal("0.00")
            if days_overdue <= 0:
                key = "current"
            elif days_overdue <= 30:
                key = "1_30"
            elif days_overdue <= 60:
                key = "31_60"
            elif days_overdue <= 90:
                key = "61_90"
            else:
                key = "over_90"
            buckets[key]["count"] += 1
            buckets[key]["amount"] += amount

        result = []
        for key, data in buckets.items():
            result.append(
                {
                    "bucket": key,
                    "label": data["label"],
                    "count": data["count"],
                    "amount": str(data["amount"]),
                }
            )

        return Response(result)
