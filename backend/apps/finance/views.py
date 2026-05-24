import calendar
import csv
from datetime import date
from decimal import Decimal
from io import BytesIO, StringIO

from django.utils.dateparse import parse_date

from django.conf import settings as django_settings
from django.core.mail import EmailMessage
from django.db import transaction
from django.db.models import Sum
from django.http import HttpResponse
from django.utils import timezone
from reportlab.graphics import renderPDF, renderSVG
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.access import TenantScopedQuerysetMixin, is_superadmin
from apps.crm.models import Clinic
from apps.jobs.models import Job

from .models import Invoice, InvoiceItem, InvoiceSequence, PriceList, Subscription
from .serializers import (
    InvoiceCreateSerializer,
    InvoiceSerializer,
    InvoiceStatusUpdateSerializer,
    PriceListSerializer,
    SubscriptionSerializer,
)


class PriceListViewSet(TenantScopedQuerysetMixin, viewsets.ModelViewSet):
    queryset = PriceList.objects.all()
    serializer_class = PriceListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return self.get_tenant_scoped_queryset(PriceList.objects.all())

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


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _invoice_number(self, lab):
        seq, _ = InvoiceSequence.objects.select_for_update().get_or_create(lab=lab)
        seq.last_number += 1
        seq.save(update_fields=["last_number"])
        prefix = (getattr(lab, "invoice_prefix", None) or "INV").strip() or "INV"
        year = timezone.now().year
        return f"{prefix}-{year}-{seq.last_number:04d}"

    def _sync_jobs_for_invoice_status(self, invoice, new_status):
        job_ids = (
            InvoiceItem.objects.filter(invoice=invoice, job_id__isnull=False)
            .values_list("job_id", flat=True)
            .distinct()
        )
        jobs = Job.objects.filter(id__in=job_ids)

        if new_status == "paid":
            jobs.update(status="closed")
        elif new_status == "issued":
            jobs.update(status="finished_factured")
        elif new_status == "cancelled":
            jobs.update(status="finished_unfactured")

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
        user = self.request.user
        qs = Invoice.objects.select_related("clinic", "lab").prefetch_related(
            "items__job__patient"
        )
        if not is_superadmin(user):
            if getattr(user, "lab_id", None):
                qs = qs.filter(lab_id=user.lab_id)
            else:
                return qs.none()

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

        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        payload = InvoiceCreateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        data = payload.validated_data

        clinic = Clinic.objects.filter(id=data["clinic_id"]).first()
        if not clinic:
            return Response(
                {"detail": "Clinic not found"}, status=status.HTTP_404_NOT_FOUND
            )

        user = request.user
        if not is_superadmin(user) and clinic.lab_id != getattr(user, "lab_id", None):
            raise PermissionDenied("Forbidden")

        jobs = list(Job.objects.filter(id__in=data["job_ids"]).select_related("lab"))
        if len(jobs) != len(set(data["job_ids"])):
            return Response(
                {"detail": "One or more jobs not found"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        clinic_lab_jobs = [job for job in jobs if job.lab_id == clinic.lab_id]
        if len(clinic_lab_jobs) != len(jobs):
            return Response(
                {"detail": "All jobs must belong to the same clinic lab"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        now = timezone.now()
        due_date = timezone.localdate() + timezone.timedelta(
            days=clinic.lab.invoice_due_days
        )
        invoice = Invoice.objects.create(
            clinic=clinic,
            lab_id=clinic.lab_id,
            number=self._invoice_number(clinic.lab),
            status="issued",
            document_type=data.get("document_type", "invoice"),
            vat_rate=clinic.lab.vat_rate,
            discount_percent=data.get("discount_percent", Decimal("0")),
            issued_at=now,
            due_date=due_date,
        )

        # Pre-load all PriceList entries for this lab into a lookup map.
        price_map = {pl.code: pl for pl in PriceList.objects.filter(lab=clinic.lab)}

        subtotal = Decimal("0.00")
        for job in jobs:
            procedures = job.procedure_codes or []
            quantities = job.procedure_quantities or {}

            if not procedures:
                quantity = 1
                unit_price = Decimal(str(job.price or 0))
                item = InvoiceItem.objects.create(
                    invoice=invoice,
                    job=job,
                    description=job.description or "Dental work",
                    quantity=quantity,
                    unit_price=unit_price,
                    line_total=unit_price * quantity,
                )
                subtotal += item.line_total
                continue

            for code in procedures:
                quantity = int(quantities.get(code, 1))
                pl_entry = price_map.get(str(code))
                if len(procedures) == 1:
                    unit_price = Decimal(str(job.price or 0))
                elif pl_entry:
                    unit_price = Decimal(str(pl_entry.price))
                else:
                    unit_price = Decimal("0")
                description = (pl_entry.description if pl_entry else None) or str(code)
                item = InvoiceItem.objects.create(
                    invoice=invoice,
                    job=job,
                    description=description,
                    quantity=quantity,
                    unit_price=unit_price,
                    line_total=unit_price * quantity,
                )
                subtotal += item.line_total

        discount = Decimal(str(invoice.discount_percent or 0))
        discount_amount = (subtotal * discount / Decimal("100")).quantize(
            Decimal("0.01")
        )
        discounted = subtotal - discount_amount
        vat_rate = Decimal(str(invoice.vat_rate or 0))
        vat_amount = (discounted * vat_rate / Decimal("100")).quantize(Decimal("0.01"))
        invoice.total_amount = discounted + vat_amount
        invoice.save(update_fields=["total_amount"])

        # Legacy parity: creating/issuing an invoice marks linked jobs as factured.
        self._sync_jobs_for_invoice_status(invoice, "issued")

        out = InvoiceSerializer(invoice, context={"request": request})
        return Response(out.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["put"], url_path="status")
    @transaction.atomic
    def update_status(self, request, pk=None):
        invoice = self.get_object()
        payload = InvoiceStatusUpdateSerializer(data=request.data)
        payload.is_valid(raise_exception=True)
        new_status = payload.validated_data["status"]

        invoice.status = new_status
        if new_status == "issued" and not invoice.issued_at:
            invoice.issued_at = timezone.now()
        if new_status == "paid" and not invoice.paid_at:
            invoice.paid_at = timezone.now()
        invoice.save(update_fields=["status", "issued_at", "paid_at"])

        self._sync_jobs_for_invoice_status(invoice, new_status)

        return Response(InvoiceSerializer(invoice, context={"request": request}).data)

    @action(detail=True, methods=["get"], url_path="qr")
    def qr(self, request, pk=None):
        invoice = self.get_object()
        payload = (
            f"INVOICE|{invoice.number}|"
            f"{Decimal(invoice.total_amount):.2f}|{invoice.status}"
        )
        svg_markup, _ = self._build_qr_svg(payload)
        if isinstance(svg_markup, bytes):
            content = svg_markup
        else:
            content = svg_markup.encode("utf-8")
        return HttpResponse(content, content_type="image/svg+xml")

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        invoice = self.get_object()
        buffer = BytesIO()
        self._render_invoice_pdf(invoice, buffer)
        pdf_bytes = buffer.getvalue()
        buffer.close()
        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'inline; filename="faktura_{invoice.number}.pdf"'
        )
        return response

    @action(detail=True, methods=["post"], url_path="send-email")
    def send_email(self, request, pk=None):
        """Email the invoice PDF to the clinic contact or a provided address."""
        invoice = self.get_object()
        lab = invoice.lab
        clinic = invoice.clinic

        recipient = (
            request.data.get("email") or (clinic.contact_info or {}).get("email")
            if clinic
            else None
        )
        if not recipient:
            return Response(
                {
                    "detail": "No recipient email. Provide 'email' in request body or set clinic contact_info.email."
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Build PDF in memory
        buffer = BytesIO()
        self._render_invoice_pdf(invoice, buffer)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        doc_label = (
            "Faktúra" if invoice.document_type == "invoice" else "Proforma faktúra"
        )
        subject = f"{doc_label} č. {invoice.number}"
        body = (
            f"Dobrý deň,\n\n"
            f"V prílohe nájdete {doc_label.lower()} č. {invoice.number}.\n\n"
            f"S pozdravom,\n{lab.name if lab else 'Dentálne laboratórium'}"
        )
        msg = EmailMessage(
            subject=subject,
            body=body,
            from_email=getattr(
                django_settings, "DEFAULT_FROM_EMAIL", "noreply@dentalapp.sk"
            ),
            to=[recipient],
        )
        msg.attach(f"faktura_{invoice.number}.pdf", pdf_bytes, "application/pdf")
        try:
            msg.send(fail_silently=False)
        except Exception as exc:
            return Response(
                {"detail": f"Email delivery failed: {exc}"},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        return Response({"sent_to": recipient, "invoice": invoice.number})

    def _render_invoice_pdf(self, invoice, buffer):
        """Render the invoice PDF into buffer (shared by pdf action and send_email)."""
        items = invoice.items.select_related("job__patient").all()
        lab = invoice.lab
        clinic = invoice.clinic

        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        L = 15 * mm
        R = width - 15 * mm

        def hline(y, x1=None, x2=None):
            pdf.setLineWidth(0.3)
            pdf.line(x1 or L, y, x2 or R, y)

        if lab.enable_qr_payment and lab.bank_account:
            iban = (lab.bank_account or "").replace(" ", "")
            amount = Decimal(str(invoice.total_amount or 0))
            bic = lab.bank_bic or ""
            msg_text = f"Faktura {invoice.number}"
            payload = (
                f"PAY*QR%0100*1*1"
                f"%AM{amount:.2f}%CC EUR"
                f"%IBAN{iban}" + (f"%BIC{bic}" if bic else "") + f"%MSG{msg_text}"
            )
        else:
            payload = f"INVOICE|{invoice.number}|{Decimal(invoice.total_amount or 0):.2f}|{invoice.status}"
        _, qr_drawing = self._build_qr_svg(payload, size=72)
        renderPDF.draw(qr_drawing, pdf, width - 47 * mm, height - 47 * mm)

        doc_label = (
            "FAKTÚRA" if invoice.document_type == "invoice" else "PROFORMA FAKTÚRA"
        )
        pdf.setFont("Helvetica-Bold", 18)
        pdf.drawString(L, height - 18 * mm, doc_label)
        pdf.setFont("Helvetica", 10)
        pdf.drawString(L, height - 25 * mm, f"Číslo: {invoice.number}")
        issued_at = invoice.issued_at or timezone.now()
        pdf.drawString(
            L, height - 31 * mm, f"Dátum vystavenia: {issued_at.strftime('%d.%m.%Y')}"
        )
        if invoice.due_date:
            pdf.drawString(
                L,
                height - 37 * mm,
                f"Dátum splatnosti: {invoice.due_date.strftime('%d.%m.%Y')}",
            )

        hline(height - 42 * mm)

        y = height - 49 * mm
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(L, y, "Dodávateľ")
        y -= 5 * mm
        pdf.setFont("Helvetica", 9)
        pdf.drawString(L, y, lab.name or "")
        if lab.address:
            y -= 4 * mm
            pdf.drawString(L, y, lab.address)
        if lab.city or lab.postal_code:
            y -= 4 * mm
            pdf.drawString(L, y, " ".join(filter(None, [lab.postal_code, lab.city])))
        if lab.tax_id:
            y -= 4 * mm
            pdf.drawString(L, y, f"IČO: {lab.tax_id}")
        if lab.vat_id:
            y -= 4 * mm
            pdf.drawString(L, y, f"IČ DPH: {lab.vat_id}")
        if lab.bank_account:
            y -= 4 * mm
            pdf.drawString(L, y, f"IBAN: {lab.bank_account}")
        if lab.bank_bic:
            y -= 4 * mm
            pdf.drawString(L, y, f"BIC: {lab.bank_bic}")

        col2 = width / 2 + 5 * mm
        yc = height - 49 * mm
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(col2, yc, "Odberateľ")
        yc -= 5 * mm
        pdf.setFont("Helvetica", 9)
        pdf.drawString(col2, yc, clinic.name if clinic else "")
        if clinic and clinic.address:
            yc -= 4 * mm
            pdf.drawString(col2, yc, clinic.address)
        if clinic and getattr(clinic, "ico", None):
            yc -= 4 * mm
            pdf.drawString(col2, yc, f"IČO: {clinic.ico}")

        table_top = min(y, yc) - 8 * mm
        hline(table_top)
        th = table_top - 6 * mm
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(L, th, "Popis")
        pdf.drawRightString(120 * mm, th, "Mn.")
        pdf.drawRightString(148 * mm, th, "Jed. cena")
        pdf.drawRightString(R, th, "Spolu")
        hline(th - 2 * mm)

        ty = th - 8 * mm
        pdf.setFont("Helvetica", 9)
        for item in items[:30]:
            if ty < 55 * mm:
                break
            pdf.drawString(L, ty, str(item.description or "")[:60])
            pdf.drawRightString(120 * mm, ty, str(item.quantity))
            pdf.drawRightString(148 * mm, ty, f"{Decimal(item.unit_price):.2f} EUR")
            pdf.drawRightString(R, ty, f"{Decimal(item.line_total):.2f} EUR")
            ty -= 5 * mm

        hline(ty)
        vat_rate = Decimal(str(invoice.vat_rate or 0))
        discount = Decimal(str(invoice.discount_percent or 0))
        total = Decimal(str(invoice.total_amount or 0))
        divisor = (
            (1 - discount / 100) * (1 + vat_rate / 100)
            if (1 - discount / 100) * (1 + vat_rate / 100) > 0
            else Decimal("1")
        )
        subtotal = (total / divisor).quantize(Decimal("0.01"))
        vat_amount = (total - subtotal).quantize(Decimal("0.01"))

        ty -= 6 * mm
        pdf.setFont("Helvetica", 9)
        pdf.drawRightString(160 * mm, ty, "Základ DPH:")
        pdf.drawRightString(R, ty, f"{subtotal:.2f} EUR")
        if discount > 0:
            ty -= 5 * mm
            pdf.drawRightString(160 * mm, ty, f"Zľava ({discount:.0f}%):")
            pdf.drawRightString(
                R,
                ty,
                f"-{(subtotal * discount / 100).quantize(Decimal('0.01')):.2f} EUR",
            )
        ty -= 5 * mm
        pdf.drawRightString(160 * mm, ty, f"DPH ({vat_rate:.0f}%):")
        pdf.drawRightString(R, ty, f"{vat_amount:.2f} EUR")
        ty -= 7 * mm
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawRightString(160 * mm, ty, "CELKOM:")
        pdf.drawRightString(R, ty, f"{total:.2f} EUR")

        if lab.payment_method:
            ty -= 8 * mm
            pdf.setFont("Helvetica", 8)
            pm_label = {
                "bank_transfer": "Bankový prevod",
                "cash": "Hotovosť",
                "card": "Karta",
            }.get(lab.payment_method, lab.payment_method)
            pdf.drawString(L, ty, f"Spôsob úhrady: {pm_label}")
        if lab.invoice_default_note:
            ty -= 6 * mm
            pdf.setFont("Helvetica", 8)
            pdf.drawString(L, ty, lab.invoice_default_note[:120])

        pdf.showPage()
        pdf.save()

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        invoice = self.get_object()
        self._sync_jobs_for_invoice_status(invoice, "cancelled")
        return super().destroy(request, *args, **kwargs)

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
                failed.append(
                    {"invoice": invoice.number, "reason": "No recipient email"}
                )
                continue

            buffer = BytesIO()
            self._render_invoice_pdf(invoice, buffer)
            pdf_bytes = buffer.getvalue()
            buffer.close()

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
                from_email=getattr(
                    django_settings, "DEFAULT_FROM_EMAIL", "noreply@dentalapp.sk"
                ),
                to=[recipient],
            )
            msg.attach(f"faktura_{invoice.number}.pdf", pdf_bytes, "application/pdf")
            try:
                msg.send(fail_silently=False)
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

        buf = StringIO()
        writer = csv.writer(buf)
        writer.writerow(
            [
                "number",
                "status",
                "clinic",
                "lab",
                "total_amount",
                "due_date",
                "issued_at",
                "paid_at",
                "created_at",
            ]
        )
        for inv in qs:
            writer.writerow(
                [
                    inv.number,
                    inv.status,
                    inv.clinic.name,
                    inv.lab.name,
                    str(inv.total_amount),
                    inv.due_date or "",
                    inv.issued_at.strftime("%Y-%m-%d") if inv.issued_at else "",
                    inv.paid_at.strftime("%Y-%m-%d") if inv.paid_at else "",
                    inv.created_at.strftime("%Y-%m-%d"),
                ]
            )

        response = HttpResponse(buf.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="invoices.csv"'
        return response


class SubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _assert_superadmin(self, user):
        if not is_superadmin(user):
            raise PermissionDenied("Superadmin only endpoint")

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
                {"detail": "No lab associated with user"},
                status=status.HTTP_404_NOT_FOUND,
            )

        subscription = Subscription.objects.filter(lab_id=user.lab_id).first()
        if not subscription:
            return Response(
                {"detail": "No subscription found"},
                status=status.HTTP_404_NOT_FOUND,
            )

        return Response(SubscriptionSerializer(subscription).data)


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
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        lab_id = getattr(user, "lab_id", None)

        if is_superadmin(user):
            qs = Invoice.objects.all()
        elif lab_id:
            qs = Invoice.objects.filter(lab_id=lab_id)
        else:
            return Response(
                {"detail": "No lab associated"}, status=status.HTTP_403_FORBIDDEN
            )

        total_revenue = qs.filter(status="paid").aggregate(total=Sum("total_amount"))[
            "total"
        ] or Decimal("0.00")
        pending_invoices = qs.filter(status="issued").count()

        today = timezone.localdate()
        overdue_qs = qs.filter(status="issued", due_date__lt=today)
        overdue_amount = overdue_qs.aggregate(total=Sum("total_amount"))[
            "total"
        ] or Decimal("0.00")

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
        average_payment_days = (
            round(sum(payment_days) / len(payment_days), 1) if payment_days else 0.0
        )

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

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if is_superadmin(user):
            qs = PriceList.objects.all()
        elif getattr(user, "lab_id", None):
            qs = PriceList.objects.filter(lab_id=user.lab_id)
        else:
            return Response(
                {"detail": "No lab associated"}, status=status.HTTP_403_FORBIDDEN
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
                    "label": "Uncategorized",
                    "items": uncategorized,
                }
            )

        return Response(result)


class InvoiceAgingView(APIView):
    """Buckets overdue issued invoices by age: 0-30, 31-60, 61-90, 90+ days."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        if is_superadmin(user):
            qs = Invoice.objects.filter(status="issued")
        elif getattr(user, "lab_id", None):
            qs = Invoice.objects.filter(status="issued", lab_id=user.lab_id)
        else:
            return Response(
                {"detail": "No lab associated"}, status=status.HTTP_403_FORBIDDEN
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
