"""
Tests for lab endpoints.
"""
import pytest


def get_token(client, username="admin@test.local", password="password123"):
    """Helper to get auth token (email as username)."""
    resp = client.post("/users/token", data={"username": username, "password": password})
    assert resp.status_code == 200
    return resp.json()["access_token"]


def auth_headers(token):
    """Helper to create auth headers."""
    return {"Authorization": f"Bearer {token}"}


def test_create_lab(client):
    """Test creating a lab."""
    token = get_token(client)
    
    resp = client.post(
        "/labs/",
        headers=auth_headers(token),
        json={
            "name": "Test Dental Lab s.r.o.",
            "address": "Hlavná 123",
            "city": "Bratislava",
            "postal_code": "81000",
            "tax_id": "12345678",  # IČO
            "vat_id": "SK2023456789",  # IČ DPH
            "bank_account": "SK1234567890123456789012",
            "email": "info@testlab.sk",
            "phone": "+421901234567"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Test Dental Lab s.r.o."
    assert data["tax_id"] == "12345678"
    assert "id" in data


def test_list_labs(client):
    """Test listing labs."""
    token = get_token(client)
    
    # Create a lab first
    client.post(
        "/labs/",
        headers=auth_headers(token),
        json={
            "name": "Another Lab",
            "address": "Test Street 1",
            "tax_id": "87654321"
        }
    )
    
    # List all labs
    resp = client.get("/labs/", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_lab_by_id(client):
    """Test getting a specific lab by ID."""
    token = get_token(client)
    
    # Create a lab
    create_resp = client.post(
        "/labs/",
        headers=auth_headers(token),
        json={
            "name": "Specific Lab",
            "address": "Specific Street 1",
            "tax_id": "11223344"
        }
    )
    lab_id = create_resp.json()["id"]
    
    # Get the lab by ID
    resp = client.get(f"/labs/{lab_id}", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == lab_id
    assert data["name"] == "Specific Lab"


def test_update_lab(client):
    """Test updating a lab."""
    token = get_token(client)
    
    # Create a lab
    create_resp = client.post(
        "/labs/",
        headers=auth_headers(token),
        json={
            "name": "Old Name",
            "address": "Old Address",
            "tax_id": "99887766"
        }
    )
    lab_id = create_resp.json()["id"]
    
    # Update the lab
    resp = client.put(
        f"/labs/{lab_id}",
        headers=auth_headers(token),
        json={
            "name": "New Name",
            "address": "New Address",
            "tax_id": "99887766",
            "email": "updated@lab.sk"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Name"
    assert data["address"] == "New Address"
    assert data["email"] == "updated@lab.sk"


def test_delete_lab(client):
    """Test deleting a lab."""
    token = get_token(client)
    
    # Create a lab
    create_resp = client.post(
        "/labs/",
        headers=auth_headers(token),
        json={
            "name": "To Be Deleted",
            "address": "Delete Street",
            "tax_id": "55443322"
        }
    )
    lab_id = create_resp.json()["id"]
    
    # Delete the lab
    resp = client.delete(f"/labs/{lab_id}", headers=auth_headers(token))
    assert resp.status_code == 200
    assert "message" in resp.json()
    
    # Verify it's deleted
    resp = client.get(f"/labs/{lab_id}", headers=auth_headers(token))
    assert resp.status_code == 404


def test_get_nonexistent_lab(client):
    """Test getting a lab that doesn't exist."""
    token = get_token(client)
    
    resp = client.get("/labs/999999", headers=auth_headers(token))
    assert resp.status_code == 404


def test_update_nonexistent_lab(client):
    """Test updating a lab that doesn't exist."""
    token = get_token(client)
    
    resp = client.put(
        "/labs/999999",
        headers=auth_headers(token),
        json={
            "name": "Doesn't exist",
            "address": "Nowhere",
            "tax_id": "00000000"
        }
    )
    assert resp.status_code == 404


def test_delete_nonexistent_lab(client):
    """Test deleting a lab that doesn't exist."""
    token = get_token(client)
    
    resp = client.delete("/labs/999999", headers=auth_headers(token))
    assert resp.status_code == 404


def test_lab_requires_authentication(client):
    """Test that lab endpoints require authentication."""
    # Try to list labs without auth
    resp = client.get("/labs/")
    assert resp.status_code == 401
    
    # Try to create without auth
    resp = client.post(
        "/labs/",
        json={
            "name": "No Auth Lab",
            "address": "Test",
            "tax_id": "12121212"
        }
    )
    assert resp.status_code == 401


def test_create_lab_with_minimal_fields(client):
    """Test creating a lab with only required fields."""
    token = get_token(client)
    
    resp = client.post(
        "/labs/",
        headers=auth_headers(token),
        json={
            "name": "Minimal Lab",
            "address": "Min Street"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Minimal Lab"
    # Optional fields should be None or empty
    assert data.get("email") is None or data.get("email") == ""


def test_lab_access_control_non_superadmin(client):
    """Test that non-superadmin users can only see their own lab."""
    # Get superadmin token
    superadmin_token = get_token(client)
    
    # Create lab 1 using signup (which creates lab + admin user)
    signup1_resp = client.post(
        "/users/signup",
        json={
            "lab_name": "Access Control Lab 1",
            "lab_address": "Address 1",
            "lab_city": "City 1",
            "email": "admin1@lab1.local",
            "password": "password123",
            "nickname": "admin1"
        }
    )
    assert signup1_resp.status_code == 200
    signup1_data = signup1_resp.json()
    lab1_id = signup1_data["lab"]["id"]
    admin1_token = signup1_data["token"]["access_token"]
    
    # Create lab 2 using superadmin
    lab2_resp = client.post(
        "/labs/",
        headers=auth_headers(superadmin_token),
        json={"name": "Access Control Lab 2", "address": "Address 2", "tax_id": "22222222"}
    )
    assert lab2_resp.status_code == 200
    lab2_id = lab2_resp.json()["id"]
    
    # Admin1 should be able to access their own lab
    resp = client.get(f"/labs/{lab1_id}", headers=auth_headers(admin1_token))
    assert resp.status_code == 200
    
    # Admin1 should NOT be able to access another lab
    resp = client.get(f"/labs/{lab2_id}", headers=auth_headers(admin1_token))
    assert resp.status_code == 403
