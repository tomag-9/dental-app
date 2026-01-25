import datetime
from io import BytesIO

import qrcode
from django.db.models import Count, Sum
from django.http import HttpResponse
from django.utils import timezone
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas
from rest_framework import permissions, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken

from .models import (
    Clinic,
    Doctor,
    Invoice,
    Job,
    Lab,
    Patient,
    PriceList,
    Subscription,
    Technician,
    User,
    Vacation,
    WarehouseItem,
)
from .serializers import (
    ClinicSerializer,
    DoctorSerializer,
    InvoiceSerializer,
    JobSerializer,
    LabSerializer,
    PatientSerializer,
    PriceListSerializer,
    SubscriptionSerializer,
    TechnicianSerializer,
    UserSerializer,
    VacationSerializer,
    WarehouseItemSerializer,
)


class BaseLabViewSet(viewsets.ModelViewSet):
    def get_queryset(self):
        u = self.request.user
        return self.queryset.all() if u.role == "superadmin" else self.queryset.filter(lab=u.lab)

    def perform_create(self, s):
        if self.request.user.role != "superadmin":
            s.save(lab=self.request.user.lab)
        else:
            s.save()


class LabViewSet(viewsets.ModelViewSet):
    queryset = Lab.objects.all()
    serializer_class = LabSerializer

    @action(detail=True, methods=["get"])
    def stats(self, r, pk=None):
        lab = self.get_object()
        last_30 = timezone.now() - datetime.timedelta(days=30)
        return Response(
            {
                "total_patients": lab.patients.count(),
                "active_jobs": lab.jobs.filter(status="in_progress").count(),
                "total_revenue": lab.invoices.filter(status="paid").aggregate(Sum("total_amount"))[
                    "total_amount__sum"
                ]
                or 0,
                "revenue_30d": lab.invoices.filter(status="paid", paid_at__gte=last_30).aggregate(
                    Sum("total_amount")
                )["total_amount__sum"]
                or 0,
                "job_distribution": lab.jobs.values("status").annotate(count=Count("id")),
                "clinic_revenue": lab.invoices.filter(status="paid")
                .values("clinic__name")
                .annotate(total=Sum("total_amount"))
                .order_by("-total")[:5],
            }
        )

    def get_queryset(self):
        return (
            Lab.objects.all()
            if self.request.user.role == "superadmin"
            else Lab.objects.filter(id=self.request.user.lab_id)
        )


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer

    @action(detail=False, methods=["get"])
    def me(self, r):
        return Response(self.get_serializer(r.user).data)

    def get_queryset(self):
        return (
            User.objects.all()
            if self.request.user.role == "superadmin"
            else User.objects.filter(lab=self.request.user.lab)
        )


class PatientViewSet(BaseLabViewSet):
    queryset = Patient.objects.all()
    serializer_class = PatientSerializer

    @action(detail=True, methods=["get"])
    def cumulative_tooth_map(self, r, pk=None):
        return Response(self.get_object().get_cumulative_tooth_map())


class ClinicViewSet(BaseLabViewSet):
    queryset = Clinic.objects.all()
    serializer_class = ClinicSerializer


class DoctorViewSet(BaseLabViewSet):
    queryset = Doctor.objects.all()
    serializer_class = DoctorSerializer


class WarehouseItemViewSet(BaseLabViewSet):
    queryset = WarehouseItem.objects.all()
    serializer_class = WarehouseItemSerializer


class TechnicianViewSet(BaseLabViewSet):
    queryset = Technician.objects.all()
    serializer_class = TechnicianSerializer


class PriceListViewSet(BaseLabViewSet):
    queryset = PriceList.objects.all()
    serializer_class = PriceListSerializer


class JobViewSet(BaseLabViewSet):
    queryset = Job.objects.all()
    serializer_class = JobSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        p_id = self.request.query_params.get("patient_id")
        return qs.filter(patient_id=p_id) if p_id else qs


class InvoiceViewSet(BaseLabViewSet):
    queryset = Invoice.objects.all()
    serializer_class = InvoiceSerializer

    @action(detail=True, methods=["get"])
    def pdf(self, r, pk=None):
        inv = self.get_object()
        lab, clinic, items = inv.lab, inv.clinic, inv.items.all()
        buf = BytesIO()
        p = canvas.Canvas(buf, pagesize=A4)
        w, h = A4
        qr = qrcode.make(f"INV|{inv.number}|{inv.total_amount}")
        qr_b = BytesIO()
        qr.save(qr_b, format="PNG")
        qr_b.seek(0)
        p.drawImage(ImageReader(qr_b), w - 50 * mm, h - 50 * mm, 30 * mm, 30 * mm)
        p.setFont("Helvetica-Bold", 16)
        p.drawString(20 * mm, h - 20 * mm, "FAKTÚRA")
        p.setFont("Helvetica", 10)
        p.drawString(20 * mm, h - 28 * mm, f"Číslo: {inv.number}")
        y = h - 56 * mm
        p.drawString(20 * mm, y, lab.name)
        y -= 5 * mm
        p.drawString(20 * mm, y, lab.address or "")
        y -= 5 * mm
        y = h - 56 * mm
        p.drawString(110 * mm, y, clinic.name)
        y -= 5 * mm
        p.drawString(110 * mm, y, clinic.address or "")
        y = h - 100 * mm
        p.setFont("Helvetica-Bold", 10)
        p.drawString(20 * mm, y, "Popis")
        p.drawString(170 * mm, y, "Spolu")
        y -= 10 * mm
        for it in items:
            p.drawString(20 * mm, y, it.description)
            p.drawString(170 * mm, y, f"{it.line_total} €")
            y -= 6 * mm
        p.setFont("Helvetica-Bold", 12)
        p.drawString(150 * mm, 30 * mm, f"Celkom: {inv.total_amount} €")
        p.showPage()
        p.save()
        buf.seek(0)
        return HttpResponse(buf, content_type="application/pdf")


class VacationViewSet(BaseLabViewSet):
    queryset = Vacation.objects.all()
    serializer_class = VacationSerializer


@api_view(["POST"])
@permission_classes([permissions.AllowAny])
def signup(request):
    try:
        lab = Lab.objects.create(name=request.data["lab_name"])
        u = User.objects.create_user(
            email=request.data["email"],
            password=request.data["password"],
            nickname=request.data.get("nickname"),
            role="admin",
            lab=lab,
        )
        return Response(
            {
                "user": UserSerializer(u).data,
                "token": {"access_token": str(RefreshToken.for_user(u).access_token)},
            },
            status=201,
        )
    except Exception as e:
        return Response({"detail": str(e)}, status=400)


class SubscriptionViewSet(viewsets.ModelViewSet):
    queryset = Subscription.objects.all()
    serializer_class = SubscriptionSerializer

    def get_queryset(self):
        u = self.request.user
        return (
            Subscription.objects.all() if u.role == "superadmin" else Subscription.objects.filter(lab=u.lab)
        )
