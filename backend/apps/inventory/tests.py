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
        self.superadmin = User.objects.create_user(
            username="warehouse_superadmin",
            email="warehouse_superadmin@example.com",
            password="password123",
            role="superadmin",
            is_superuser=True,
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
            "supplier": "Dental Supplier",
            "cost_price": 12.5,
            "notes": "High translucency",
        }

        response = self.client.post(url, payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["name"], "Zircon blocks")
        self.assertEqual(response.data["sku"], "ZIR-001")
        self.assertEqual(float(response.data["quantity"]), 50.0)
        self.assertEqual(response.data["supplier"], "Dental Supplier")
        self.assertEqual(response.data["lab"], self.lab_a.id)

    def test_superadmin_can_create_warehouse_item_for_selected_lab(self):
        self.client.force_authenticate(user=self.superadmin)
        response = self.client.post(
            reverse("warehouseitem-list"),
            {
                "lab": self.lab_b.id,
                "name": "Superadmin item",
                "sku": "SUPER-001",
                "quantity": 5,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["lab"], self.lab_b.id)

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

    def test_superadmin_can_list_items_across_labs(self):
        WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Item A1",
            sku="SKU-A1",
            quantity=10,
        )
        WarehouseItem.objects.create(
            lab=self.lab_b,
            name="Item B1",
            sku="SKU-B1",
            quantity=20,
        )

        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get(reverse("warehouseitem-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_stats_are_scoped_to_authenticated_lab(self):
        WarehouseItem.objects.create(
            lab=self.lab_a,
            name="In stock",
            category="Materials",
            quantity="10.00",
            min_threshold="3.00",
            cost_price="2.50",
        )
        WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Low stock",
            category="Materials",
            quantity="2.00",
            min_threshold="5.00",
            cost_price="10.00",
        )
        WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Out of stock",
            category="Tools",
            quantity="0.00",
            min_threshold="1.00",
            cost_price="7.00",
        )
        WarehouseItem.objects.create(
            lab=self.lab_b,
            name="Other lab stock",
            category="Materials",
            quantity="100.00",
            min_threshold="5.00",
            cost_price="1.00",
        )

        self.client.force_authenticate(user=self.admin_a)
        response = self.client.get(reverse("warehouseitem-stats"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_items"], 3)
        self.assertEqual(response.data["total_value"], "45.00")
        self.assertEqual(response.data["low_stock_count"], 1)
        self.assertEqual(response.data["out_of_stock_count"], 1)
        self.assertEqual(
            response.data["categories"],
            [
                {"category": "Materials", "count": 2},
                {"category": "Tools", "count": 1},
            ],
        )

    def test_superadmin_stats_include_all_labs(self):
        WarehouseItem.objects.create(
            lab=self.lab_a,
            name="Item A",
            quantity="1.00",
            cost_price="5.00",
        )
        WarehouseItem.objects.create(
            lab=self.lab_b,
            name="Item B",
            quantity="2.00",
            cost_price="3.00",
        )

        self.client.force_authenticate(user=self.superadmin)
        response = self.client.get(reverse("warehouseitem-stats"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["total_items"], 2)
        self.assertEqual(response.data["total_value"], "11.00")


class WarehouseBulkImportTests(APITestCase):
    """Tests for POST /warehouse/import/ and /warehouse/import-partial/."""

    def setUp(self):
        self.lab = Lab.objects.create(name="Bulk Lab")
        self.admin = User.objects.create_user(
            username="bulk_admin",
            email="bulk_admin@example.com",
            password="password123",
            role="admin",
            lab=self.lab,
        )
        self.no_lab_user = User.objects.create_user(
            username="bulk_no_lab",
            email="bulk_no_lab@example.com",
            password="password123",
            role="user",
        )
        self.import_url = reverse("warehouseitem-bulk-import")
        self.import_partial_url = reverse("warehouseitem-bulk-import-partial")

    def _valid_items(self):
        return [
            {
                "name": "Item A",
                "sku": "SKU-A",
                "quantity": "10.00",
                "unit": "pcs",
                "supplier": "Supplier A",
                "cost_price": "5.50",
            },
            {"name": "Item B", "sku": "SKU-B", "quantity": "20.00", "unit": "pcs"},
        ]

    def test_bulk_import_happy_path(self):
        """All valid items are created atomically."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.import_url, self._valid_items(), format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["imported"], 2)
        self.assertEqual(WarehouseItem.objects.filter(lab=self.lab).count(), 2)

    def test_bulk_import_validation_error_rolls_back(self):
        """Any invalid row causes the entire import to fail (no rows created)."""
        self.client.force_authenticate(user=self.admin)
        items = self._valid_items()
        items.append({"quantity": "bad"})  # missing required name

        response = self.client.post(self.import_url, items, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("errors", response.data)
        self.assertEqual(WarehouseItem.objects.filter(lab=self.lab).count(), 0)

    def test_bulk_import_lab_scoping(self):
        """Imported items are assigned to the authenticated user's lab."""
        self.client.force_authenticate(user=self.admin)
        self.client.post(self.import_url, self._valid_items(), format="json")

        items = WarehouseItem.objects.filter(lab=self.lab)
        self.assertEqual(items.count(), 2)
        for item in items:
            self.assertEqual(item.lab_id, self.lab.id)

    def test_bulk_import_no_lab_denied(self):
        """Users without a lab must receive 403."""
        self.client.force_authenticate(user=self.no_lab_user)
        response = self.client.post(self.import_url, self._valid_items(), format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_bulk_import_requires_list(self):
        """Sending a dict instead of a list returns 400."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(self.import_url, {"name": "x"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_bulk_import_partial_skips_invalid(self):
        """Partial import skips invalid rows and imports the valid ones."""
        self.client.force_authenticate(user=self.admin)
        items = self._valid_items()
        items.append({"quantity": "bad"})  # invalid row

        response = self.client.post(self.import_partial_url, items, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["imported"], 2)
        self.assertEqual(response.data["skipped"], 1)
        self.assertEqual(WarehouseItem.objects.filter(lab=self.lab).count(), 2)

    def test_bulk_import_decimal_precision(self):
        """Decimal fields are stored without float rounding artifacts."""
        self.client.force_authenticate(user=self.admin)
        items = [{"name": "Precise Item", "quantity": "1.10", "cost_price": "9.99"}]

        self.client.post(self.import_url, items, format="json")

        item = WarehouseItem.objects.get(lab=self.lab, name="Precise Item")
        self.assertEqual(str(item.quantity), "1.10")
        self.assertEqual(str(item.cost_price), "9.99")

    def test_bulk_import_supplier_field(self):
        self.client.force_authenticate(user=self.admin)
        items = [{"name": "Supplier Item", "supplier": "Dental Depot"}]

        response = self.client.post(self.import_url, items, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        item = WarehouseItem.objects.get(lab=self.lab, name="Supplier Item")
        self.assertEqual(item.supplier, "Dental Depot")
