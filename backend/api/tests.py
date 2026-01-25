from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from .models import Lab, User, Patient

class ApiTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.lab = Lab.objects.create(name="Test Lab")
        self.user = User.objects.create_user(email="test@example.com", password="password", lab=self.lab)
        self.client.force_authenticate(user=self.user)

    def test_get_patients(self):
        Patient.objects.create(first_name="Janko", last_name="Hrasko", birth_number="9001011234", lab=self.lab)
        url = reverse('patient-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['first_name'], "Janko")

    def test_create_patient(self):
        url = reverse('patient-list')
        data = {"first_name": "Ferko", "last_name": "Mrkvicka", "birth_number": "8001011234"}
        response = self.client.post(url, data)
        if response.status_code != status.HTTP_201_CREATED:
            print(response.data)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Patient.objects.count(), 1)
        self.assertEqual(Patient.objects.first().first_name, "Ferko")
