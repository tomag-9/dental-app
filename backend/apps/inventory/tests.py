from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.core.models import Lab, User
from apps.inventory.models import WarehouseItem


class WarehouseItemCrudApiTests(APITestCase):
    """Test CRUD operations for WarehouseItem model."""

    def setUp(self):
        self.lab_a = Lab.objects.create(name="Lab A")
        self.lab_b = Lab.objects.create(name="Lab B")

        self.admin_a = User.objects.create_user(
            username="admin_a",
            email="warehouse_admin_a@example.com",
            password="password123",
            role="admin",
            lab=self.lab_a,
        )
        self.user_a = User.objects.create_user(
            username="user_a",
            email="warehouse_user_a@example.com",
            password="password123",
            role="user",
            lab=self.lab_a,
        )
        self.admin_b = User.objects.create_user(
            username="admin_b",
            email="warehouse_admin_b@example.com",
            password="password123",
            role="admin",
            lab=self.lab_b,
        )

    def test_create_warehouse_item(self):
        """Test creating a new warehouse item."""
        self.client.force_authenticate(user=self.admin_a)
        url = reverse("warehouseitem-list")
        payload = {
            "name": "Zircon blocks",
            "sku": "ZIR-001",
            "quantity": 50,
            "unit": "pcs",
            "min_threshold": 10,
            "category": "Materials",
            "location": "A1",
            "cost_price": 12.5,
            "notes": "High translucency",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Zircon blocks")
        self.assertEqual(response.data["sku"], "ZIR-001")
        self.assertEqual(float(response.data["quantity"]), 50.0)
        self.assertEqual(response.data["lab"], self.lab_a.id)

    def test_list_warehouse_items(self):
        """Test listing warehouse items scoped to lab."""
        WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Item A1",
            sku="SKU-A1",
            quantity=10,
        )
        WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Item A2",
            sku="SKU-A2",
            quantity=20,
        )
        WarehouseItem.objects.create(
            lab=self.lab_b,
            name="Item B1",
            sku="SKU-B1",
            quantity=30,
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse("warehouseitem-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)  # Only lab_a items

    def test_get_warehouse_item(self):
        """Test retrieving a specific warehouse item."""
        item = WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Test Item",
            sku="TEST-001",
            quantity=15,
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse("warehouseitem-detail", args=[item.id])

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["name"], "Test Item")

    def test_update_warehouse_item(self):
        """Test updating a warehouse item."""
        item = WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Zircon blocks",
            sku="ZIR-001",
            quantity=50,
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse("warehouseitem-detail", args=[item.id])
        payload = {
            "name": "Zircon blocks",
            "sku": "ZIR-001",
            "quantity": 42,
            "unit": "pcs",
        }

        response = self.client.put(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(float(response.data["quantity"]), 42.0)

    def test_delete_warehouse_item(self):
        """Test deleting a warehouse item."""
        item = WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Test Item",
            sku="DEL-001",
            quantity=10,
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse("warehouseitem-detail", args=[item.id])

        response = self.client.delete(url)

        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

        # Verify deletion
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_cross_lab_access_denied(self):
        """Test that users cannot access items from other labs."""
        item_b = WarehouseItem.objects.create(
            lab=self.lab_b,
            name="Lab B Item",
            sku="LB-001",
            quantity=5,
        )

        self.client.force_authenticate(user=self.admin_a)
        url = reverse("warehouseitem-detail", args=[item_b.id])

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_admin_can_list_items(self):
        """Test that regular users in the lab can list warehouse items."""
        WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Item A1",
            sku="SKU-A1",
            quantity=10,
        )

        self.client.force_authenticate(user=self.user_a)
        url = reverse("warehouseitem-list")

        response = self.client.get(url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
