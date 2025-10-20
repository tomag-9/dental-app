"""
Tests for vacation endpoints.
"""
import pytest
from datetime import date, timedelta


def test_create_vacation(client):
    """Test creating a vacation period."""
    today = date.today()
    next_week = today + timedelta(days=7)
    
    resp = client.post(
        "/vacations/",
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


def test_list_vacations(client):
    """Test listing all vacations."""
    # Create a vacation first
    today = date.today()
    next_week = today + timedelta(days=7)
    
    client.post(
        "/vacations/",
        json={
            "start": f"{today.isoformat()}T00:00:00",
            "end": f"{next_week.isoformat()}T23:59:59",
            "description": "Test vacation"
        }
    )
    
    # List all vacations
    resp = client.get("/vacations/")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(v["description"] == "Test vacation" for v in data)


def test_create_vacation_without_description(client):
    """Test creating a vacation without description (should work as it's optional)."""
    today = date.today()
    next_week = today + timedelta(days=7)
    
    resp = client.post(
        "/vacations/",
        json={
            "start": f"{today.isoformat()}T00:00:00",
            "end": f"{next_week.isoformat()}T23:59:59"
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] is None


def test_create_multiple_vacations(client):
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
        resp = client.post("/vacations/", json=vacation)
        assert resp.status_code == 200
    
    # Verify all are listed
    resp = client.get("/vacations/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 3


def test_vacation_date_format(client):
    """Test that vacation accepts proper datetime format."""
    resp = client.post(
        "/vacations/",
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
