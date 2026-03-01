import pytest
from app import models
from datetime import date
from app.auth import get_password_hash


def test_get_my_subscription(client, db):
    """Test getting current user's lab subscription."""
    # Create a new lab and user for this test
    test_lab = models.Lab(name="Subscription Test Lab", address="Test Address")
    db.add(test_lab)
    db.commit()

    test_user = models.User(
        nickname="subscriptionuser",
        email="subscription@test.local",
        hashed_password=get_password_hash("testpass"),
        role="user",
        is_active=True,
        lab_id=test_lab.id
    )
    db.add(test_user)
    db.commit()

    # Create a subscription for the lab
    subscription = models.Subscription(
        lab_id=test_lab.id,
        plan="pro",
        status="active",
        seats=10,
        current_period_start=date(2024, 1, 1),
        current_period_end=date(2024, 12, 31)
    )
    db.add(subscription)
    db.commit()

    # Test the endpoint
    resp = client.get("/subscriptions/my", headers={"Authorization": f"Bearer {client.post('/users/token', data={'username': 'subscription@test.local', 'password': 'testpass'}).json()['access_token']}"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["lab_id"] == test_lab.id
    assert data["plan"] == "pro"
    assert data["status"] == "active"
    assert data["seats"] == 10


def test_get_my_subscription_no_subscription(client, user_auth_headers):
    """Test getting subscription when lab has no subscription."""
    # Test the endpoint - should return 404
    resp = client.get("/subscriptions/my", headers=user_auth_headers)
    assert resp.status_code == 404
    assert "No subscription found" in resp.json()["detail"]


def test_get_subscription_by_id_superadmin(client, db):
    """Test getting subscription by ID as superadmin."""
    # Get admin token
    resp = client.post("/users/token", data={"username": "admin@test.local", "password": "password123"})
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create a new lab for this test
    lab = models.Lab(name="Test Lab 2", address="Lab Street 2")
    db.add(lab)
    db.commit()

    # Create a subscription for the new lab
    subscription = models.Subscription(
        lab_id=lab.id,
        plan="enterprise",
        status="active",
        seats=20
    )
    db.add(subscription)
    db.commit()

    # Test the endpoint
    resp = client.get(f"/subscriptions/{subscription.id}", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == subscription.id
    assert data["plan"] == "enterprise"
    assert data["seats"] == 20


def test_get_subscription_by_id_non_superadmin(client, user_auth_headers, db):
    """Test that non-superadmin cannot get subscription by ID."""
    # Create a new lab and subscription
    lab = models.Lab(name="Test Lab 3", address="Lab Street 3")
    db.add(lab)
    db.commit()

    subscription = models.Subscription(lab_id=lab.id, plan="free", status="inactive", seats=5)
    db.add(subscription)
    db.commit()

    # Try to get subscription as regular user
    resp = client.get(f"/subscriptions/{subscription.id}", headers=user_auth_headers)
    assert resp.status_code == 403  # Forbidden


def test_get_subscription_not_found(client, db):
    """Test getting non-existent subscription."""
    # Get admin token
    resp = client.post("/users/token", data={"username": "admin@test.local", "password": "password123"})
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Test the endpoint
    resp = client.get("/subscriptions/99999", headers=admin_headers)
    assert resp.status_code == 404
    assert "Subscription not found" in resp.json()["detail"]


def test_update_subscription(client, db):
    """Test updating subscription as superadmin."""
    # Get admin token
    resp = client.post("/users/token", data={"username": "admin@test.local", "password": "password123"})
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create a new lab for this test
    lab = models.Lab(name="Update Test Lab", address="Update Test Address")
    db.add(lab)
    db.commit()

    # Create a subscription for the new lab
    subscription = models.Subscription(
        lab_id=lab.id,
        plan="free",
        status="inactive",
        seats=5
    )
    db.add(subscription)
    db.commit()

    # Update the subscription
    update_data = {
        "plan": "pro",
        "status": "active",
        "seats": 15,
        "current_period_start": "2024-01-01",
        "current_period_end": "2024-12-31"
    }
    resp = client.put(f"/subscriptions/{subscription.id}", json=update_data, headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["plan"] == "pro"
    assert data["status"] == "active"
    assert data["seats"] == 15


def test_update_subscription_not_found(client, db):
    """Test updating non-existent subscription."""
    # Get admin token
    resp = client.post("/users/token", data={"username": "admin@test.local", "password": "password123"})
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Test the endpoint
    update_data = {"plan": "pro"}
    resp = client.put("/subscriptions/99999", json=update_data, headers=admin_headers)
    assert resp.status_code == 404
    assert "Subscription not found" in resp.json()["detail"]


def test_get_all_subscriptions(client, db):
    """Test getting all subscriptions as superadmin."""
    # Get admin token
    resp = client.post("/users/token", data={"username": "admin@test.local", "password": "password123"})
    assert resp.status_code == 200
    admin_token = resp.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Create multiple unique labs and subscriptions for this test
    lab1 = models.Lab(name="All Subs Lab 1", address="All Subs Address 1")
    lab2 = models.Lab(name="All Subs Lab 2", address="All Subs Address 2")
    db.add_all([lab1, lab2])
    db.commit()

    sub1 = models.Subscription(lab_id=lab1.id, plan="pro", status="active", seats=10)
    sub2 = models.Subscription(lab_id=lab2.id, plan="free", status="inactive", seats=5)
    db.add_all([sub1, sub2])
    db.commit()

    # Test the endpoint
    resp = client.get("/subscriptions/", headers=admin_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) >= 2  # At least the two we created
    plans = [sub["plan"] for sub in data]
    assert "pro" in plans
    assert "free" in plans


def test_get_all_subscriptions_non_superadmin(client, user_auth_headers):
    """Test that non-superadmin cannot get all subscriptions."""
    # Try to get all subscriptions as regular user
    resp = client.get("/subscriptions/", headers=user_auth_headers)
    assert resp.status_code == 403  # Forbidden