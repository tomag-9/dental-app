from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.finance.models import Invoice, InvoiceItem
from apps.jobs.models import Job, Technician


class PatientCumulativeToothMapApiTests(APITestCase):
    def setUp(self):
        self.lab_a = Lab.objects.create(name="Lab A")
        self.lab_b = Lab.objects.create(name="Lab B")

        self.admin_a = User.objects.create_user(
            username="admin_a",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )

        self.clinic_a = Clinic.objects.create(lab=self.lab_a, name="Clinic A")
        self.doctor_a = Doctor.objects.create(
            lab=self.lab_a, clinic=self.clinic_a, first_name="John", last_name="Doe"
        )
        self.tech_a = Technician.objects.create(
            lab=self.lab_a, first_name="Tech", last_name="One"
        )
        self.patient_a = Patient.objects.create(
            lab=self.lab_a,
            first_name="Alice",
            last_name="Patient",
            birth_number="123456/7890",
        )

        self.clinic_b = Clinic.objects.create(lab=self.lab_b, name="Clinic B")
        self.doctor_b = Doctor.objects.create(
            lab=self.lab_b, clinic=self.clinic_b, first_name="Jane", last_name="Doe"
        )
        self.tech_b = Technician.objects.create(
            lab=self.lab_b, first_name="Tech", last_name="Two"
        )
        self.patient_b = Patient.objects.create(
            lab=self.lab_b,
            first_name="Bob",
            last_name="Patient",
            birth_number="223456/7890",
        )

    def _endpoint(self, patient_id):
        return f"/api/crm/patients/{patient_id}/cumulative_tooth_map/"

    def test_cumulative_tooth_map_merges_completed_jobs_with_newer_overrides(self):
        Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.tech_a,
            status="completed",
            output_tooth_procedures={"11": "crown", "12": "veneer"},
            created_at=timezone.now() - timezone.timedelta(days=2),
        )
        Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.tech_a,
            status="completed",
            output_tooth_procedures={"11": "bridge", "13": "implant"},
            created_at=timezone.now() - timezone.timedelta(days=1),
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(self._endpoint(self.patient_a.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response.data, {"11": "bridge", "12": "veneer", "13": "implant"}
        )

    def test_cumulative_tooth_map_ignores_non_completed_jobs(self):
        Job.objects.create(
            lab=self.lab_a,
            patient=self.patient_a,
            clinic=self.clinic_a,
            doctor=self.doctor_a,
            technician=self.tech_a,
            status="new",
            output_tooth_procedures={"21": "temporary"},
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(self._endpoint(self.patient_a.id))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data, {})

    def test_cumulative_tooth_map_respects_lab_scoping(self):
        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(self._endpoint(self.patient_b.id))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class PatientCrudApiTests(APITestCase):
    """Test CRUD operations for Patient model."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Test Lab")
        self.lab_b = Lab.objects.create(name="Other Lab")
        self.user = User.objects.create_user(
            username="testuser",
            email="test@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )
        self.superadmin = User.objects.create_user(
            username="patient_superadmin",
            email="patient_superadmin@example.com",
            password="password123",
            role="superadmin",
            is_superuser=True,
        )

    def test_create_patient(self):
        """Test creating a new patient."""
        self.client.force_authenticate(user=self.user)
        url = reverse("patient-list")
        payload = {
            "first_name": "Test",
            "last_name": "Patient",
            "birth_number": "910101/1111",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["first_name"], "Test")
        self.assertEqual(response.data["last_name"], "Patient")
        self.assertEqual(response.data["birth_number"], "910101/1111")
        self.assertEqual(response.data["lab"], self.lab.id)

    def test_superadmin_can_create_patient_for_selected_lab(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.post(
            reverse("patient-list"),
            {
                "lab": self.lab_b.id,
                "first_name": "Super",
                "last_name": "Patient",
                "birth_number": "991212/1234",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["lab"], self.lab_b.id)

    def test_list_patients(self):
        """Test listing patients."""
        patient = Patient.objects.create(
            lab=self.lab,
            first_name="Alice",
            last_name="Smith",
            birth_number="900101/1234",
        )
        Patient.objects.create(
            lab=self.lab,
            first_name="Bob",
            last_name="Jones",
            birth_number="910202/5678",
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("patient-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)
        by_id = {item["id"]: item for item in response.data}
        self.assertEqual(by_id[patient.id]["jobs_count"], 0)
        self.assertEqual(by_id[patient.id]["active_jobs"], 0)
        self.assertEqual(by_id[patient.id]["ytd_revenue"], "0.00")

    def test_patient_aggregates_jobs_and_revenue(self):
        clinic = Clinic.objects.create(lab=self.lab, name="Clinic A")
        patient = Patient.objects.create(
            lab=self.lab,
            first_name="Alice",
            last_name="Smith",
            birth_number="900101/1234",
        )
        active_job = Job.objects.create(
            lab=self.lab,
            patient=patient,
            clinic=clinic,
            status="in_progress",
            description="Active job",
        )
        Job.objects.create(
            lab=self.lab,
            patient=patient,
            clinic=clinic,
            status="completed",
            description="Done job",
        )
        invoice = Invoice.objects.create(
            lab=self.lab,
            clinic=clinic,
            number="CRM-PAT-001",
            status="paid",
            total_amount="120.00",
            paid_at=timezone.now(),
        )
        InvoiceItem.objects.create(
            invoice=invoice,
            job=active_job,
            description="Work",
            quantity=1,
            unit_price="120.00",
        )

        self.client.force_authenticate(user=self.user)
        response = self.client.get(reverse("patient-detail", args=[patient.id]))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["jobs_count"], 2)
        self.assertEqual(response.data["active_jobs"], 1)
        self.assertEqual(response.data["ytd_revenue"], "120.00")

    def test_superadmin_lists_patients_across_labs(self):
        Patient.objects.create(
            lab=self.lab,
            first_name="Alice",
            last_name="Smith",
            birth_number="900101/1234",
        )
        Patient.objects.create(
            lab=self.lab_b,
            first_name="Bob",
            last_name="Jones",
            birth_number="900101/1234",
        )

        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get(reverse("patient-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_duplicate_birth_number_allowed_across_labs(self):
        Patient.objects.create(
            lab=self.lab,
            first_name="Alice",
            last_name="Smith",
            birth_number="900101/1234",
        )

        patient = Patient.objects.create(
            lab=self.lab_b,
            first_name="Bob",
            last_name="Jones",
            birth_number="900101/1234",
        )

        self.assertEqual(patient.birth_number, "900101/1234")

    def test_get_patient(self):
        """Test retrieving a specific patient."""
        patient = Patient.objects.create(
            lab=self.lab,
            first_name="Test",
            last_name="Patient",
            birth_number="920303/9876",
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("patient-detail", args=[patient.id])

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "Test")

    def test_update_patient(self):
        """Test updating a patient."""
        patient = Patient.objects.create(
            lab=self.lab,
            first_name="Test",
            last_name="Patient",
            birth_number="930404/4321",
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("patient-detail", args=[patient.id])
        payload = {
            "first_name": "Updated",
            "last_name": "Patient",
            "birth_number": "930404/4321",
        }

        response = self.client.put(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "Updated")

    def test_delete_patient(self):
        """Test deleting a patient."""
        patient = Patient.objects.create(
            lab=self.lab,
            first_name="Test",
            last_name="Patient",
            birth_number="940505/1111",
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("patient-detail", args=[patient.id])

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify deletion
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class ClinicCrudApiTests(APITestCase):
    """Test CRUD operations for Clinic model."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Test Lab")
        self.lab_b = Lab.objects.create(name="Other Lab")
        self.user = User.objects.create_user(
            username="testuser",
            email="clinic_test@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )
        self.superadmin = User.objects.create_user(
            username="clinic_superadmin",
            email="clinic_superadmin@example.com",
            password="password123",
            role="superadmin",
            is_superuser=True,
        )

    def test_create_clinic(self):
        """Test creating a new clinic."""
        self.client.force_authenticate(user=self.user)
        url = reverse("clinic-list")
        payload = {
            "name": "New Clinic",
            "address": "1 Test Rd",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "New Clinic")
        self.assertEqual(response.data["address"], "1 Test Rd")
        self.assertEqual(response.data["lab"], self.lab.id)

    def test_superadmin_can_create_clinic_for_selected_lab(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.post(
            reverse("clinic-list"),
            {"lab": self.lab_b.id, "name": "Super Clinic", "ico": "87654321"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["lab"], self.lab_b.id)

    def test_list_clinics(self):
        """Test listing clinics."""
        Clinic.objects.create(lab=self.lab, name="Clinic A")
        Clinic.objects.create(lab=self.lab, name="Clinic B")

        self.client.force_authenticate(user=self.user)
        url = reverse("clinic-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_duplicate_ico_allowed_across_labs(self):
        Clinic.objects.create(lab=self.lab, name="Clinic A", ico="12345678")
        clinic = Clinic.objects.create(
            lab=self.lab_b,
            name="Clinic B",
            ico="12345678",
        )

        self.assertEqual(clinic.ico, "12345678")

    def test_blank_ico_allowed_multiple_times_within_lab(self):
        Clinic.objects.create(lab=self.lab, name="Clinic A", ico="")
        clinic = Clinic.objects.create(lab=self.lab, name="Clinic B", ico="")

        self.assertEqual(clinic.ico, "")

    def test_get_clinic(self):
        """Test retrieving a specific clinic."""
        clinic = Clinic.objects.create(lab=self.lab, name="Test Clinic")
        patient = Patient.objects.create(
            lab=self.lab,
            first_name="Clinic",
            last_name="Patient",
            birth_number="940101/1111",
        )
        active_job = Job.objects.create(
            lab=self.lab,
            patient=patient,
            clinic=clinic,
            status="new",
            description="Active clinic job",
        )
        Job.objects.create(
            lab=self.lab,
            patient=patient,
            clinic=clinic,
            status="completed",
            description="Done clinic job",
        )
        invoice = Invoice.objects.create(
            lab=self.lab,
            clinic=clinic,
            number="CRM-CLINIC-001",
            status="paid",
            total_amount="75.00",
            paid_at=timezone.now(),
        )
        InvoiceItem.objects.create(
            invoice=invoice,
            job=active_job,
            description="Work",
            quantity=1,
            unit_price="75.00",
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("clinic-detail", args=[clinic.id])

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Test Clinic")
        self.assertEqual(response.data["jobs_count"], 2)
        self.assertEqual(response.data["active_jobs"], 1)
        self.assertEqual(response.data["ytd_revenue"], "75.00")

    def test_update_clinic(self):
        """Test updating a clinic."""
        clinic = Clinic.objects.create(lab=self.lab, name="Test Clinic")

        self.client.force_authenticate(user=self.user)
        url = reverse("clinic-detail", args=[clinic.id])
        payload = {
            "name": "Updated Clinic",
            "address": "1 Test Rd",
        }

        response = self.client.put(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Updated Clinic")

    def test_delete_clinic(self):
        """Test deleting a clinic."""
        clinic = Clinic.objects.create(lab=self.lab, name="Test Clinic")

        self.client.force_authenticate(user=self.user)
        url = reverse("clinic-detail", args=[clinic.id])

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify deletion
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class DoctorCrudApiTests(APITestCase):
    """Test CRUD operations for Doctor model."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Test Lab")
        self.user = User.objects.create_user(
            username="testuser",
            email="doctor_test@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Test Clinic")

    def test_create_doctor(self):
        """Test creating a new doctor."""
        self.client.force_authenticate(user=self.user)
        url = reverse("doctor-list")
        payload = {
            "first_name": "Alice",
            "last_name": "Doctor",
            "clinic": self.clinic.id,
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["first_name"], "Alice")
        self.assertEqual(response.data["last_name"], "Doctor")
        self.assertEqual(response.data["lab"], self.lab.id)

    def test_list_doctors(self):
        """Test listing doctors."""
        Doctor.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            first_name="Alice",
            last_name="Smith",
        )
        Doctor.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            first_name="Bob",
            last_name="Jones",
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("doctor-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_get_doctor(self):
        """Test retrieving a specific doctor."""
        doctor = Doctor.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            first_name="Test",
            last_name="Doctor",
        )
        patient = Patient.objects.create(
            lab=self.lab,
            first_name="Doctor",
            last_name="Patient",
            birth_number="950101/1111",
        )
        active_job = Job.objects.create(
            lab=self.lab,
            patient=patient,
            clinic=self.clinic,
            doctor=doctor,
            status="in_progress",
            description="Active doctor job",
        )
        invoice = Invoice.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            number="CRM-DOCTOR-001",
            status="paid",
            total_amount="90.00",
            paid_at=timezone.now(),
        )
        InvoiceItem.objects.create(
            invoice=invoice,
            job=active_job,
            description="Work",
            quantity=1,
            unit_price="90.00",
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("doctor-detail", args=[doctor.id])

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["first_name"], "Test")
        self.assertEqual(response.data["jobs_count"], 1)
        self.assertEqual(response.data["active_jobs"], 1)
        self.assertEqual(response.data["ytd_revenue"], "90.00")

    def test_update_doctor(self):
        """Test updating a doctor."""
        doctor = Doctor.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            first_name="Alice",
            last_name="Doctor",
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("doctor-detail", args=[doctor.id])
        payload = {
            "first_name": "Alice",
            "last_name": "Updated",
            "clinic": self.clinic.id,
        }

        response = self.client.put(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["last_name"], "Updated")

    def test_delete_doctor(self):
        """Test deleting a doctor."""
        doctor = Doctor.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            first_name="Test",
            last_name="Doctor",
        )

        self.client.force_authenticate(user=self.user)
        url = reverse("doctor-detail", args=[doctor.id])

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify deletion
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
