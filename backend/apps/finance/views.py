from decimal import Decimal
from io import BytesIO

from django.db import transaction
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

from apps.crm.models import Clinic
from apps.jobs.models import Job

from .models import Invoice, InvoiceItem, PriceList, Subscription
from .serializers import (
    InvoiceCreateSerializer,
    InvoiceSerializer,
    InvoiceStatusUpdateSerializer,
    PriceListSerializer,
    SubscriptionSerializer,
)


def _is_superadmin(user):
    return bool(
        getattr(user, "is_superuser", False)
        or getattr(user, "role", None) == "superadmin"
    )


class PriceListViewSet(viewsets.ModelViewSet):
    queryset = PriceList.objects.all()
    serializer_class = PriceListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if hasattr(user, "lab") and user.lab:
            return PriceList.objects.filter(lab=user.lab)
        return PriceList.objects.none()

    def perform_create(self, serializer):
        if hasattr(self.request.user, "lab"):
            serializer.save(lab=self.request.user.lab)


class InvoiceViewSet(viewsets.ModelViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _invoice_number(self):
        count = Invoice.objects.count() + 1
        stamp = timezone.now().strftime("%Y%m%d%H%M%S")
        return f"INV-{stamp}-{count:04d}"

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
        if _is_superadmin(user):
            return qs
        if getattr(user, "lab_id", None):
            return qs.filter(lab_id=user.lab_id)
        return qs.none()

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
        if not _is_superadmin(user) and clinic.lab_id != getattr(user, "lab_id", None):
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
        invoice = Invoice.objects.create(
            clinic=clinic,
            lab_id=clinic.lab_id,
            number=self._invoice_number(),
            status="issued",
            issued_at=now,
        )

        total = Decimal("0.00")
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
                total += item.line_total
                continue

            for code in procedures:
                quantity = int(quantities.get(code, 1))
                unit_price = (
                    Decimal(str(job.price or 0)) if len(procedures) == 1 else Decimal("0")
                )
                item = InvoiceItem.objects.create(
                    invoice=invoice,
                    job=job,
                    description=str(code),
                    quantity=quantity,
                    unit_price=unit_price,
                    line_total=unit_price * quantity,
                )
                total += item.line_total

        invoice.total_amount = total
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
        items = invoice.items.select_related("job__patient").all()

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        payload = (
            f"INVOICE|{invoice.number}|"
            f"{Decimal(invoice.total_amount):.2f}|{invoice.status}"
        )
        _, qr_drawing = self._build_qr_svg(payload, size=90)
        renderPDF.draw(qr_drawing, pdf, width - 55 * mm, height - 55 * mm)

        pdf.setFont("Helvetica-Bold", 16)
        pdf.drawString(20 * mm, height - 20 * mm, "INVOICE")
        pdf.setFont("Helvetica", 10)
        pdf.drawString(20 * mm, height - 28 * mm, f"Number: {invoice.number}")
        issued_at = invoice.issued_at or timezone.now()
        pdf.drawString(
            20 * mm,
            height - 34 * mm,
            f"Issued: {issued_at.strftime('%Y-%m-%d')}",
        )
        pdf.drawString(20 * mm, height - 40 * mm, f"Status: {invoice.status}")

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(20 * mm, height - 52 * mm, "Clinic")
        pdf.setFont("Helvetica", 10)
        pdf.drawString(20 * mm, height - 58 * mm, invoice.clinic.name)
        if invoice.clinic.address:
            pdf.drawString(20 * mm, height - 64 * mm, invoice.clinic.address)

        y = height - 84 * mm
        pdf.setFont("Helvetica-Bold", 10)
        pdf.drawString(20 * mm, y, "Description")
        pdf.drawString(120 * mm, y, "Qty")
        pdf.drawString(140 * mm, y, "Unit")
        pdf.drawString(165 * mm, y, "Line")
        y -= 6 * mm

        pdf.setFont("Helvetica", 10)
        for item in items[:25]:
            pdf.drawString(20 * mm, y, str(item.description)[:50])
            pdf.drawRightString(135 * mm, y, str(item.quantity))
            pdf.drawRightString(160 * mm, y, f"{Decimal(item.unit_price):.2f}")
            pdf.drawRightString(190 * mm, y, f"{Decimal(item.line_total):.2f}")
            y -= 6 * mm
            if y < 25 * mm:
                break

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawRightString(190 * mm, 18 * mm, f"Total: {Decimal(invoice.total_amount):.2f}")

        pdf.showPage()
        pdf.save()
        pdf_bytes = buffer.getvalue()
        buffer.close()

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = (
            f'inline; filename="invoice_{invoice.number}.pdf"'
        )
        return response

    @transaction.atomic
    def destroy(self, request, *args, **kwargs):
        invoice = self.get_object()
        self._sync_jobs_for_invoice_status(invoice, "cancelled")
        return super().destroy(request, *args, **kwargs)


class SubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _assert_superadmin(self, user):
        if not _is_superadmin(user):
            raise PermissionDenied("Superadmin only endpoint")

    def get_queryset(self):
        if _is_superadmin(self.request.user):
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
