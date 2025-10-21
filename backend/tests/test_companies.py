"""
Tests for company endpoints.
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


def test_create_company(client):
    """Test creating a company."""
    token = get_token(client)
    
    resp = client.post(
        "/companies/",
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


def test_list_companies(client):
    """Test listing companies."""
    token = get_token(client)
    
    # Create a company first
    client.post(
        "/companies/",
        headers=auth_headers(token),
        json={
            "name": "Another Lab",
            "address": "Test Street 1",
            "tax_id": "87654321"
        }
    )
    
    # List all companies
    resp = client.get("/companies/", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1


def test_get_company_by_id(client):
    """Test getting a specific company by ID."""
    token = get_token(client)
    
    # Create a company
    create_resp = client.post(
        "/companies/",
        headers=auth_headers(token),
        json={
            "name": "Specific Lab",
            "address": "Specific Street 1",
            "tax_id": "11223344"
        }
    )
    company_id = create_resp.json()["id"]
    
    # Get the company by ID
    resp = client.get(f"/companies/{company_id}", headers=auth_headers(token))
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == company_id
    assert data["name"] == "Specific Lab"


def test_update_company(client):
    """Test updating a company."""
    token = get_token(client)
    
    # Create a company
    create_resp = client.post(
        "/companies/",
        headers=auth_headers(token),
        json={
            "name": "Old Name",
            "address": "Old Address",
            "tax_id": "99887766"
        }
    )
    company_id = create_resp.json()["id"]
    
    # Update the company
    resp = client.put(
        f"/companies/{company_id}",
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


def test_delete_company(client):
    """Test deleting a company."""
    token = get_token(client)
    
    # Create a company
    create_resp = client.post(
        "/companies/",
        headers=auth_headers(token),
        json={
            "name": "To Be Deleted",
            "address": "Delete Street",
            "tax_id": "55443322"
        }
    )
    company_id = create_resp.json()["id"]
    
    # Delete the company
    resp = client.delete(f"/companies/{company_id}", headers=auth_headers(token))
    assert resp.status_code == 200
    assert "message" in resp.json()
    
    # Verify it's deleted
    resp = client.get(f"/companies/{company_id}", headers=auth_headers(token))
    assert resp.status_code == 404


def test_get_nonexistent_company(client):
    """Test getting a company that doesn't exist."""
    token = get_token(client)
    
    resp = client.get("/companies/999999", headers=auth_headers(token))
    assert resp.status_code == 404


def test_update_nonexistent_company(client):
    """Test updating a company that doesn't exist."""
    token = get_token(client)
    
    resp = client.put(
        "/companies/999999",
        headers=auth_headers(token),
        json={
            "name": "Doesn't exist",
            "address": "Nowhere",
            "tax_id": "00000000"
        }
    )
    assert resp.status_code == 404


def test_delete_nonexistent_company(client):
    """Test deleting a company that doesn't exist."""
    token = get_token(client)
    
    resp = client.delete("/companies/999999", headers=auth_headers(token))
    assert resp.status_code == 404


def test_company_requires_authentication(client):
    """Test that company endpoints require authentication."""
    # Try to list companies without auth
    resp = client.get("/companies/")
    assert resp.status_code == 401
    
    # Try to create without auth
    resp = client.post(
        "/companies/",
        json={
            "name": "No Auth Lab",
            "address": "Test",
            "tax_id": "12121212"
        }
    )
    assert resp.status_code == 401


def test_create_company_with_minimal_fields(client):
    """Test creating a company with only required fields."""
    token = get_token(client)
    
    resp = client.post(
        "/companies/",
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
