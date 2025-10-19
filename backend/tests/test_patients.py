def test_patients_crud(client, auth_headers):
    # create patient
    payload = {"first_name": "Test", "last_name": "Patient", "birth_number": "910101/1111"}
    resp = client.post("/patients/", headers=auth_headers, json=payload)
    assert resp.status_code == 200
    data = resp.json()
    pid = data["id"]

    # list
    resp = client.get("/patients/", headers=auth_headers)
    assert resp.status_code == 200
    assert any(p["id"] == pid for p in resp.json())

    # get
    resp = client.get(f"/patients/{pid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Test"

    # update
    resp = client.put(f"/patients/{pid}", headers=auth_headers, json={"first_name": "Updated", "last_name": "Patient", "birth_number": "910101/1111"})
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Updated"

    # delete
    resp = client.delete(f"/patients/{pid}", headers=auth_headers)
    assert resp.status_code == 200
    assert "Pacient vymazan" in resp.text or resp.json().get("message")

    # get after delete
    resp = client.get(f"/patients/{pid}", headers=auth_headers)
    assert resp.status_code == 404

