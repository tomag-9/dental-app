import os
import json
import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def get_token(username: str = "admin", password: str = "password123") -> str:
	resp = client.post("/users/token", data={"username": username, "password": password})
	assert resp.status_code == 200, resp.text
	return resp.json()["access_token"]


def auth_headers(token: str) -> dict:
	return {"Authorization": f"Bearer {token}"}


@pytest.mark.order(1)
def test_login_ok():
	resp = client.post("/users/token", data={"username": "admin", "password": "password123"})
	assert resp.status_code == 200
	data = resp.json()
	assert "access_token" in data


@pytest.mark.order(2)
def test_create_invoice_and_list():
	token = get_token()
	# create invoice for existing seeded jobs 1 and 2 and clinic 1
	resp = client.post(
		"/invoices/",
		headers=auth_headers(token),
		json={"clinic_id": 1, "job_ids": [1, 2]},
	)
	assert resp.status_code in (200, 201)
	inv = resp.json()
	assert inv["id"] >= 1
	assert inv["status"] in ("issued", "draft")

	# list
	resp = client.get("/invoices/", headers=auth_headers(token))
	assert resp.status_code == 200
	lst = resp.json()
	assert any(i["id"] == inv["id"] for i in lst)


@pytest.mark.order(3)
def test_update_status_and_get_qr():
	token = get_token()
	# list invoices and pick one
	resp = client.get("/invoices/", headers=auth_headers(token))
	assert resp.status_code == 200
	invoices = resp.json()
	assert invoices, "No invoices found to update"
	inv_id = invoices[0]["id"]

	# update status to paid
	resp = client.put(f"/invoices/{inv_id}/status", headers=auth_headers(token), json={"status": "paid"})
	assert resp.status_code == 200
	assert resp.json()["status"] == "paid"

	# fetch QR
	resp = client.get(f"/invoices/{inv_id}/qr", headers=auth_headers(token))
	assert resp.status_code == 200
	assert resp.headers.get("content-type", "").startswith("image/svg+xml")
	assert resp.text.startswith("<")
