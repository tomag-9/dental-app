def test_doctors_and_technicians_crud(client, auth_headers):
    # create doctor
    d_payload = {"first_name": "Alice", "last_name": "Doctor", "clinic_id": 1}
    resp = client.post("/doctors/", headers=auth_headers, json=d_payload)
    assert resp.status_code == 200
    doc = resp.json()
    did = doc["id"]

    # get
    resp = client.get(f"/doctors/{did}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Alice"

    # update
    resp = client.put(f"/doctors/{did}", headers=auth_headers, json={"first_name": "Alice", "last_name": "Updated", "clinic_id": 1})
    assert resp.status_code == 200
    assert resp.json()["last_name"] == "Updated"

    # delete
    resp = client.delete(f"/doctors/{did}", headers=auth_headers)
    assert resp.status_code == 200

    # technician
    t_payload = {"first_name": "Techie", "last_name": "Two"}
    resp = client.post("/technicians/", headers=auth_headers, json=t_payload)
    assert resp.status_code == 200
    tech = resp.json()
    tid = tech["id"]

    resp = client.get(f"/technicians/{tid}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["first_name"] == "Techie"

    resp = client.put(f"/technicians/{tid}", headers=auth_headers, json={"first_name": "Techie", "last_name": "Updated"})
    assert resp.status_code == 200
    assert resp.json()["last_name"] == "Updated"

    resp = client.delete(f"/technicians/{tid}", headers=auth_headers)
    assert resp.status_code == 200

