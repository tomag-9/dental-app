from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers as drf_serializers
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Doctor, Patient
from apps.crm.serializers import _validate_birth_number, _validate_dic, _validate_ico
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
            {"lab": self.lab_b.id, "name": "Super Clinic"},
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


class SlovakBirthNumberValidatorTests(APITestCase):
    def _ok(self, value):
        _validate_birth_number(value)

    def _err(self, value):
        with self.assertRaises(drf_serializers.ValidationError):
            _validate_birth_number(value)

    def test_valid_10_digit_with_slash(self):
        self._ok('900101/1234')

    def test_valid_10_digit_without_slash(self):
        self._ok('9001011234')

    def test_valid_9_digit(self):
        # pre-1954 format — 9 digits
        self._ok('490101123')

    def test_invalid_too_short(self):
        self._err('12345678')

    def test_invalid_letters(self):
        self._err('9001AB1234')

    def test_invalid_month(self):
        self._err('9013011234')

    def test_invalid_day(self):
        self._err('9001991234')

    def test_valid_female_month(self):
        # women get month + 50, so month 51 → January
        self._ok('9051011234')

    def test_api_rejects_invalid_birth_number(self):
        lab = Lab.objects.create(name='ValidatorLab')
        user = User.objects.create_user(username='vlabuser', password='pw', role='admin', lab=lab)
        Clinic.objects.create(lab=lab, name='C')
        self.client.force_authenticate(user=user)
        resp = self.client.post('/api/crm/patients/', {
            'first_name': 'Test', 'last_name': 'Patient', 'birth_number': 'badvalue',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('birth_number', resp.data)


class SlovakIcoValidatorTests(APITestCase):
    def _ok(self, value):
        _validate_ico(value)

    def _err(self, value):
        with self.assertRaises(drf_serializers.ValidationError):
            _validate_ico(value)

    def test_valid_ico(self):
        # weights [8,7,6,5,4,3,2] × [3,6,1,9,0,5,7] = 146, 146%11=3, check=8
        self._ok('36190578')

    def test_invalid_not_8_digits(self):
        self._err('1234567')

    def test_invalid_contains_letters(self):
        self._err('1234567A')

    def test_invalid_checksum(self):
        self._err('36190570')

    def test_empty_skipped(self):
        _validate_ico('')

    def test_api_rejects_invalid_ico(self):
        lab = Lab.objects.create(name='IcoLab')
        user = User.objects.create_user(username='icouser', password='pw', role='admin', lab=lab)
        self.client.force_authenticate(user=user)
        resp = self.client.post('/api/crm/clinics/', {
            'name': 'Test Clinic', 'ico': 'BADICO',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('ico', resp.data)


class SlovakDicValidatorTests(APITestCase):
    def _ok(self, value):
        _validate_dic(value)

    def _err(self, value):
        with self.assertRaises(drf_serializers.ValidationError):
            _validate_dic(value)

    def test_valid_10_digit(self):
        self._ok('2020123456')

    def test_valid_sk_prefix(self):
        self._ok('SK2020123456')

    def test_invalid_format(self):
        self._err('SK123')

    def test_invalid_letters_without_prefix(self):
        self._err('AB2020123456')

    def test_empty_skipped(self):
        _validate_dic('')

    def test_api_rejects_invalid_dic(self):
        lab = Lab.objects.create(name='DicLab')
        user = User.objects.create_user(username='dicuser', password='pw', role='admin', lab=lab)
        self.client.force_authenticate(user=user)
        resp = self.client.post('/api/crm/clinics/', {
            'name': 'Test Clinic', 'dic': 'BADDIC',
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('dic', resp.data)


class PatientAgeTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="AgeLab")
        self.user = User.objects.create_user(
            username="ageuser", password="pw", role="admin", lab=self.lab
        )

    def test_age_returned_in_patient_api(self):
        # birth_number 900101/1234 → year 1990, month 01, day 01
        patient = Patient.objects.create(
            lab=self.lab, first_name="A", last_name="B", birth_number="900101/1234"
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/crm/patients/{patient.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("age", resp.data)
        age = resp.data["age"]
        self.assertIsNotNone(age)
        self.assertGreater(age, 30)

    def test_age_none_for_unparseable_birth_number(self):
        from apps.crm.serializers import _age_from_birth_number
        self.assertIsNone(_age_from_birth_number("badvalue"))
        self.assertIsNone(_age_from_birth_number(""))

    def test_age_female_birth_number(self):
        # month 51 → January female
        from apps.crm.serializers import _age_from_birth_number
        age = _age_from_birth_number("900101/1234")
        self.assertIsNotNone(age)
        self.assertGreater(age, 30)

    def test_age_in_list_response(self):
        Patient.objects.create(
            lab=self.lab, first_name="X", last_name="Y", birth_number="900101/1234"
        )
        self.client.force_authenticate(user=self.user)
        resp = self.client.get("/api/crm/patients/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("age", resp.data[0])


class CrmSearchFilterTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Search Lab")
        self.user = User.objects.create_user(
            username="search_user", password="pw", role="admin", lab=self.lab
        )
        self.client.force_authenticate(user=self.user)
        Clinic.objects.create(lab=self.lab, name="Alfa Klinika", ico=None)
        Clinic.objects.create(lab=self.lab, name="Beta Centrum", ico=None)
        Doctor.objects.create(lab=self.lab, first_name="Jan", last_name="Novak")
        Doctor.objects.create(lab=self.lab, first_name="Maria", last_name="Horvatova")
        Patient.objects.create(lab=self.lab, first_name="Peter", last_name="Kral", birth_number="900101/1234")
        Patient.objects.create(lab=self.lab, first_name="Jana", last_name="Blahova", birth_number="910202/5678")

    def test_clinic_search_by_name(self):
        resp = self.client.get("/api/crm/clinics/?search=alfa")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["name"], "Alfa Klinika")

    def test_clinic_search_no_match(self):
        resp = self.client.get("/api/crm/clinics/?search=xyz")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 0)

    def test_clinic_search_empty_returns_all(self):
        resp = self.client.get("/api/crm/clinics/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 2)

    def test_doctor_search_by_last_name(self):
        resp = self.client.get("/api/crm/doctors/?search=novak")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["last_name"], "Novak")

    def test_doctor_search_by_first_name(self):
        resp = self.client.get("/api/crm/doctors/?search=maria")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)

    def test_patient_search_by_last_name(self):
        resp = self.client.get("/api/crm/patients/?search=kral")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["last_name"], "Kral")

    def test_patient_search_by_birth_number(self):
        resp = self.client.get("/api/crm/patients/?search=900101")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)


class PatientRevenueStatsTests(APITestCase):
    def setUp(self):
        from apps.finance.models import InvoiceSequence

        self.lab = Lab.objects.create(name="Revenue Stats Lab")
        self.user = User.objects.create_user(
            username="revstat_user", password="pw", email="revstat@test.sk",
            role="admin", lab=self.lab,
        )
        self.clinic = Clinic.objects.create(name="RevClinic", lab=self.lab)
        self.patient = Patient.objects.create(
            first_name="Test", last_name="Patient",
            birth_number="900101/1234", lab=self.lab,
        )
        self.job = Job.objects.create(
            lab=self.lab, clinic=self.clinic, patient=self.patient,
            description="Test job", status="completed", price=150,
        )
        InvoiceSequence.objects.create(lab=self.lab, last_number=0)
        self.invoice = Invoice.objects.create(
            lab=self.lab, clinic=self.clinic, number="INV-2026-0001",
            status="paid", total_amount="150.00",
        )
        InvoiceItem.objects.create(
            invoice=self.invoice, job=self.job,
            description="Test", quantity=1, unit_price="150.00", line_total="150.00",
        )
        self.client.force_authenticate(user=self.user)

    def test_patient_detail_includes_revenue_stats(self):
        resp = self.client.get(f"/api/crm/patients/{self.patient.id}/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("revenue_stats", resp.data)
        stats = resp.data["revenue_stats"]
        self.assertIn("total_revenue", stats)
        self.assertIn("jobs_count", stats)
        self.assertIn("avg_job_value", stats)
        self.assertEqual(stats["jobs_count"], 1)
        self.assertEqual(stats["total_revenue"], "150.00")


class CrmAdminOnlyWriteTests(APITestCase):
    """Only admin/superadmin can create, update, delete CRM records."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Write Guard Lab")
        self.admin = User.objects.create_user(
            username="crm_admin", password="pw", email="crm_admin@test.sk",
            role="admin", lab=self.lab,
        )
        self.regular = User.objects.create_user(
            username="crm_user", password="pw", email="crm_user@test.sk",
            role="user", lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Test Clinic")

    def test_admin_can_create_clinic(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/crm/clinics/", {"name": "New Clinic"})
        self.assertEqual(resp.status_code, 201)

    def test_user_cannot_create_clinic(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.post("/api/crm/clinics/", {"name": "Blocked Clinic"})
        self.assertEqual(resp.status_code, 403)

    def test_user_cannot_update_clinic(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.patch(f"/api/crm/clinics/{self.clinic.id}/", {"name": "Hacked"})
        self.assertEqual(resp.status_code, 403)

    def test_user_cannot_delete_clinic(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.delete(f"/api/crm/clinics/{self.clinic.id}/")
        self.assertEqual(resp.status_code, 403)

    def test_user_can_read_clinics(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.get("/api/crm/clinics/")
        self.assertEqual(resp.status_code, 200)

    def test_admin_can_create_patient(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post("/api/crm/patients/", {
            "first_name": "Jan", "last_name": "Novak", "birth_number": "9001015555",
        })
        self.assertEqual(resp.status_code, 201)

    def test_user_cannot_create_patient(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.post("/api/crm/patients/", {
            "first_name": "Eva", "last_name": "Nová", "birth_number": "9055215557",
        })
        self.assertEqual(resp.status_code, 403)


class CrmCsvExportTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Export Lab")
        self.admin = User.objects.create_user(
            username="export_admin", password="pw", email="export_admin@test.sk",
            role="admin", lab=self.lab,
        )
        self.regular = User.objects.create_user(
            username="export_user", password="pw", email="export@test.sk",
            role="user", lab=self.lab,
        )
        self.clinic = Clinic.objects.create(lab=self.lab, name="Export Clinic", ico="12345678")
        self.patient = Patient.objects.create(
            lab=self.lab, first_name="Jana", last_name="Novakova", birth_number="8555215556",
        )

    def test_admin_can_export_patients_csv(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/crm/patients/export/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/csv", resp["Content-Type"])
        content = resp.content.decode("utf-8")
        self.assertIn("first_name", content)
        self.assertIn("Novakova", content)

    def test_user_cannot_export_patients_csv(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.get("/api/crm/patients/export/")
        self.assertEqual(resp.status_code, 403)

    def test_clinics_export_returns_csv(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.get("/api/crm/clinics/export/")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("text/csv", resp["Content-Type"])
        content = resp.content.decode("utf-8")
        self.assertIn("name", content)
        self.assertIn("Export Clinic", content)

    def test_unauthenticated_export_denied(self):
        resp = self.client.get("/api/crm/patients/export/")
        self.assertEqual(resp.status_code, 401)
