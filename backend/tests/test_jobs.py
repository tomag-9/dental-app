def test_jobs_crud_and_validation(client, auth_headers):
    # create a valid job using existing seeded patient/clinic/doctor/technician and price list
    payload = {
        "patient_id": 1,
        "clinic_id": 1,
        "doctor_id": 1,
        "technician_id": 1,
        "price": 150.0,
        "procedure_codes": ["TEST"],
        "procedure_quantities": {"TEST": 1},
        "description": "Job from test",
        "tooth_color": "A2",
    }
    resp = client.post("/jobs/", headers=auth_headers, json=payload)
    assert resp.status_code == 200
    job = resp.json()
    jid = job["id"]

    # get job
    resp = client.get(f"/jobs/{jid}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Job from test"
    assert data["tooth_color"] == "A2"

    # update job
    payload_update = payload.copy()
    payload_update["description"] = "Updated job"
    payload_update["tooth_color"] = "B3"
    resp = client.put(f"/jobs/{jid}", headers=auth_headers, json=payload_update)
    assert resp.status_code == 200
    data = resp.json()
    assert data["description"] == "Updated job"
    assert data["tooth_color"] == "B3"

    # invalid procedure code should return 400
    bad_payload = payload.copy()
    bad_payload["procedure_codes"] = ["NONEXISTENT_CODE"]
    resp = client.post("/jobs/", headers=auth_headers, json=bad_payload)
    assert resp.status_code == 400

    # invalid tooth color should return 422 (pydantic validation)
    bad_payload2 = payload.copy()
    bad_payload2["tooth_color"] = "E9"
    resp = client.post("/jobs/", headers=auth_headers, json=bad_payload2)
    assert resp.status_code == 422

    # delete job
    resp = client.delete(f"/jobs/{jid}", headers=auth_headers)
    assert resp.status_code == 200

    # get after delete
    resp = client.get(f"/jobs/{jid}", headers=auth_headers)
    assert resp.status_code == 404

