from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.crm.models import Clinic, Patient
from apps.jobs.models import Job


class JobAttachmentTests(APITestCase):
    def setUp(self):
        self.lab = Lab.objects.create(name="Attach Lab")
        self.clinic = Clinic.objects.create(name="Attach Clinic", lab=self.lab)
        self.user = User.objects.create_user(
            username="attach_user",
            password="pw",
            email="attach@test.sk",
            role="admin",
            lab=self.lab,
        )
        self.regular = User.objects.create_user(
            username="attach_regular",
            password="pw",
            email="attach_regular@test.sk",
            role="user",
            lab=self.lab,
        )
        self.patient = Patient.objects.create(
            lab=self.lab,
            first_name="A",
            last_name="Patient",
        )
        self.job = Job.objects.create(
            lab=self.lab,
            clinic=self.clinic,
            patient=self.patient,
            status="new",
        )

    def test_list_attachments_empty(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get(f"/api/jobs/jobs/{self.job.id}/attachments/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data, [])

    def test_create_attachment(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f"/api/jobs/jobs/{self.job.id}/attachments/",
            {
                "file_name": "photo.jpg",
                "file_url": "https://example.com/photo.jpg",
                "file_type": "image/jpeg",
                "file_size": 1024,
            },
            format="json",
        )
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.data["file_name"], "photo.jpg")
        self.assertEqual(resp.data["uploaded_by"], self.user.id)
        self.assertNotIn("file_size", resp.data)

    def test_list_attachments_after_create(self):
        self.client.force_authenticate(user=self.user)
        self.client.post(
            f"/api/jobs/jobs/{self.job.id}/attachments/",
            {"file_name": "scan.pdf", "file_url": "https://example.com/scan.pdf"},
            format="json",
        )
        resp = self.client.get(f"/api/jobs/jobs/{self.job.id}/attachments/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]["file_name"], "scan.pdf")

    def test_unauthenticated_denied(self):
        resp = self.client.get(f"/api/jobs/jobs/{self.job.id}/attachments/")
        self.assertEqual(resp.status_code, 401)

    def test_regular_user_cannot_create_attachment(self):
        self.client.force_authenticate(user=self.regular)
        resp = self.client.post(
            f"/api/jobs/jobs/{self.job.id}/attachments/",
            {"file_name": "scan.pdf", "file_url": "https://example.com/scan.pdf"},
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(self.job.attachments.count(), 0)

    def test_attachment_rejects_non_https_url(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f"/api/jobs/jobs/{self.job.id}/attachments/",
            {
                "file_name": "scan.pdf",
                "file_url": "http://example.com/scan.pdf",
                "file_type": "application/pdf",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file_url", resp.data)

    def test_attachment_rejects_unsupported_file_type(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f"/api/jobs/jobs/{self.job.id}/attachments/",
            {
                "file_name": "script.html",
                "file_url": "https://example.com/script.html",
                "file_type": "text/html",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file_type", resp.data)

    def test_attachment_rejects_extension_mismatch(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f"/api/jobs/jobs/{self.job.id}/attachments/",
            {
                "file_name": "photo.png",
                "file_url": "https://example.com/photo.png",
                "file_type": "application/pdf",
            },
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file_name", resp.data)

    def test_attachment_rejects_oversized_file_size_hint(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f"/api/jobs/jobs/{self.job.id}/attachments/",
            {
                "file_name": "scan.pdf",
                "file_url": "https://example.com/scan.pdf",
                "file_type": "application/pdf",
                "file_size": 25 * 1024 * 1024 + 1,
            },
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("file_size", resp.data)

    def test_attachment_allows_dental_scan_type(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.post(
            f"/api/jobs/jobs/{self.job.id}/attachments/",
            {
                "file_name": "scan.stl",
                "file_url": "https://example.com/scan.stl",
                "file_type": "model/stl",
                "file_size": 2048,
            },
            format="json",
        )

        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["file_type"], "model/stl")
