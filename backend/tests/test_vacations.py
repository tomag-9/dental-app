"""
Tests for vacation endpoints.
"""
import pytest
from datetime import date, timedelta
from conftest import admin_token


def test_create_vacation(client, admin_token):
    """Test creating a vacation period."""
    today = date.today()
    next_week = today + timedelta(days=7)
    
    token = admin_token
    resp = client.post(
        "/vacations/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "start": f"{today.isoformat()}T00:00:00",
            "end": f"{next_week.isoformat()}T23:59:59",
            "description": "Summer vacation"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Summer vacation"
    assert "id" in data
    assert "created_at" in data


def test_list_vacations(client, admin_token):
    """Test listing all vacations."""
    # Create a vacation first
    today = date.today()
    next_week = today + timedelta(days=7)
    
    token = admin_token
    client.post(
        "/vacations/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "start": f"{today.isoformat()}T00:00:00",
            "end": f"{next_week.isoformat()}T23:59:59",
            "description": "Test vacation"
        }
    )
    
    # List all vacations
    resp = client.get("/vacations/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(v["description"] == "Test vacation" for v in data)


def test_create_vacation_without_description(client, admin_token):
    """Test creating a vacation without description (should work as it's optional)."""
    today = date.today()
    next_week = today + timedelta(days=7)
    
    token = admin_token
    resp = client.post(
        "/vacations/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "start": f"{today.isoformat()}T00:00:00",
            "end": f"{next_week.isoformat()}T23:59:59"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] is None


def test_create_multiple_vacations(client, admin_token):
    """Test creating multiple vacation periods."""
    today = date.today()
    
    vacations = [
        {
            "start": f"{(today + timedelta(days=i*10)).isoformat()}T00:00:00",
            "end": f"{(today + timedelta(days=i*10 + 5)).isoformat()}T23:59:59",
            "description": f"Vacation {i+1}"
        }
        for i in range(3)
    ]
    
    for vacation in vacations:
        token = admin_token
        resp = client.post("/vacations/", headers={"Authorization": f"Bearer {token}"}, json=vacation)
        assert resp.status_code == 200
    
    # Verify all are listed
    token = admin_token
    resp = client.get("/vacations/", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 3


def test_vacation_date_format(client, admin_token):
    """Test that vacation accepts proper datetime format."""
    token = admin_token
    resp = client.post(
        "/vacations/",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "start": "2025-12-24T00:00:00",
            "end": "2025-12-31T23:59:59",
            "description": "Christmas vacation"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "2025-12-24" in data["start"]
    assert "2025-12-31" in data["end"]
